-- Tornamesa / PR #15 / annual + customized Top shared read-only engine.
-- MANUAL MIGRATION. Back up the database first. No historical data is changed.
-- Confirm schema and indexes separately in Supabase before applying.
BEGIN;

-- Each UTC period is computed from the profile owner's timezone by the
-- server using zonedMonthRange(). No overlapping ranges may be supplied.
-- This RPC is deliberately NOT accessible via anon/authenticated roles.
-- It must only be called by server endpoints after canViewWithFollows().
CREATE OR REPLACE FUNCTION public.top_albums(
  p_user_id uuid,
  p_ranges jsonb,
  p_sort text DEFAULT 'listens',
  p_min_listens integer DEFAULT 1,
  p_min_rating numeric DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_artist text DEFAULT NULL
)
RETURNS TABLE (
  rank integer,
  album_id text,
  listen_count bigint,
  rating numeric,
  first_listened_at timestamptz,
  last_listened_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_range jsonb;
  v_start timestamptz;
  v_end timestamptz;
  v_starts text;
  v_ends text;
  v_previous tstzrange[] := '{}'::tstzrange[];
  v_prior tstzrange;
BEGIN
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles AS p WHERE p.id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Unknown top owner' USING ERRCODE = '22023';
  END IF;
  IF p_ranges IS NULL OR jsonb_typeof(p_ranges) <> 'array' THEN
    RAISE EXCEPTION 'Invalid top ranges' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_ranges) NOT BETWEEN 1 AND 24 THEN
    RAISE EXCEPTION 'Select 1 to 24 months' USING ERRCODE = '22023';
  END IF;
  IF p_sort IS NULL OR p_sort NOT IN ('listens', 'rating', 'repeats') OR
     p_min_listens IS NULL OR p_min_listens NOT BETWEEN 1 AND 1000000 OR
     (p_min_rating IS NOT NULL AND (p_min_rating < 1 OR p_min_rating > 10)) OR
     p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 OR
     (p_artist IS NOT NULL AND (length(btrim(p_artist)) < 1 OR
                                length(p_artist) > 120)) THEN
    RAISE EXCEPTION 'Invalid top filters' USING ERRCODE = '22023';
  END IF;

  FOR v_range IN SELECT value FROM jsonb_array_elements(p_ranges)
  LOOP
    IF jsonb_typeof(v_range) <> 'object' THEN
      RAISE EXCEPTION 'Invalid range item' USING ERRCODE = '22023';
    END IF;
    v_starts := v_range->>'start';
    v_ends := v_range->>'end';
    -- Require explicit UTC offsets. Both JS-generated boundaries end with Z.
    IF v_starts IS NULL OR v_ends IS NULL OR
       v_starts !~ 'Z$' OR v_ends !~ 'Z$' THEN
      RAISE EXCEPTION 'UTC timestamps required' USING ERRCODE = '22023';
    END IF;
    v_start := v_starts::timestamptz;
    v_end := v_ends::timestamptz;
    IF v_start >= v_end OR v_end > v_start + interval '35 days' THEN
      RAISE EXCEPTION 'Invalid month boundaries' USING ERRCODE = '22023';
    END IF;
    FOREACH v_prior IN ARRAY v_previous LOOP
      IF tstzrange(v_start, v_end, '[)') && v_prior THEN
        RAISE EXCEPTION 'Overlapping months are not allowed'
          USING ERRCODE = '22023';
      END IF;
    END LOOP;
    v_previous := array_append(v_previous, tstzrange(v_start, v_end, '[)'));
  END LOOP;

  RETURN QUERY
  WITH bounds AS MATERIALIZED (
    SELECT (v.value->>'start')::timestamptz AS start_at,
           (v.value->>'end')::timestamptz AS end_at
    FROM jsonb_array_elements(p_ranges) AS v(value)
  ),
  selected AS MATERIALIZED (
    SELECT l.album_id, l.listened_at
    FROM public.listens AS l
    WHERE l.user_id = p_user_id
      AND l.album_id IS NOT NULL
      AND l.listened_at IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM bounds AS b
        WHERE l.listened_at >= b.start_at AND l.listened_at < b.end_at
      )
  ),
  aggregated AS (
    SELECT s.album_id,
           count(*) AS listen_count,
           min(s.listened_at) AS first_listened_at,
           max(s.listened_at) AS last_listened_at
    FROM selected AS s
    GROUP BY s.album_id
  ),
  eligible AS (
    SELECT a.album_id, a.listen_count, a.first_listened_at,
           a.last_listened_at, rv.rating::numeric AS album_rating
    FROM aggregated AS a
    LEFT JOIN public.reviews AS rv
      ON rv.user_id = p_user_id AND rv.album_id = a.album_id
    LEFT JOIN public.albums AS album
      ON album.spotify_id = a.album_id
    WHERE a.listen_count >= p_min_listens
      AND (p_sort <> 'repeats' OR a.listen_count > 1)
      AND (p_min_rating IS NULL OR rv.rating >= p_min_rating)
      -- Only the stored primary artist is indexed in the catalog. This
      -- optional exact-name filter intentionally avoids fuzzy false matches.
      AND (p_artist IS NULL OR
           lower(album.artist) = lower(btrim(p_artist)))
  ),
  ranked AS (
    SELECT
      row_number() OVER (
        ORDER BY
          CASE WHEN p_sort = 'listens' THEN e.listen_count END DESC NULLS LAST,
          CASE WHEN p_sort = 'rating' THEN e.album_rating END DESC NULLS LAST,
          CASE WHEN p_sort = 'repeats' THEN greatest(0::bigint, e.listen_count - 1)
            END DESC NULLS LAST,
          e.listen_count DESC,
          e.first_listened_at ASC,
          e.album_id ASC
      )::integer AS position,
      e.*
    FROM eligible AS e
  )
  SELECT r.position, r.album_id::text, r.listen_count, r.album_rating,
         r.first_listened_at, r.last_listened_at
  FROM ranked AS r
  ORDER BY r.position ASC
  LIMIT p_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)
  TO service_role;

COMMIT;

-- Read-only post-deployment checks:
-- SELECT has_function_privilege(
--   'anon','public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)','EXECUTE'
-- ) AS anon_exec,
-- has_function_privilege(
--   'authenticated','public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)','EXECUTE'
-- ) AS authenticated_exec,
-- has_function_privilege(
--   'service_role','public.top_albums(uuid,jsonb,text,integer,numeric,integer,text)','EXECUTE'
-- ) AS service_exec;
-- Inspect the existing indexes before proposing new ones:
-- SELECT tablename, indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename IN ('listens','reviews')
-- ORDER BY tablename, indexname;
-- Manual rollback (only if unused by future PRs):
-- DROP FUNCTION public.top_albums(uuid,jsonb,text,integer,numeric,integer,text);
