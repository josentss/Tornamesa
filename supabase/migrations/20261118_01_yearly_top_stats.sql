-- Tornamesa / PR #16 / read-only yearly summary, independent of Monthly Top.
-- MANUAL MIGRATION. Apply only after reviewing SQL in Supabase.
-- No existing tables, rows, triggers, or indexes are modified.
BEGIN;

CREATE OR REPLACE FUNCTION public.yearly_top_stats(
  p_user_id uuid,
  p_year integer
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
BEGIN
  IF p_user_id IS NULL OR p_year IS NULL
     OR p_year NOT BETWEEN 1900 AND 2100
     OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id)
  THEN
    RAISE EXCEPTION 'Invalid yearly top owner or year' USING ERRCODE = '22023';
  END IF;

  -- Use the same user-local year boundaries as top_albums and Monthly Top.
  v_tz := public.monthly_top_timezone(p_user_id);
  v_start := make_date(p_year, 1, 1)::timestamp AT TIME ZONE v_tz;
  v_end := make_date(p_year + 1, 1, 1)::timestamp AT TIME ZONE v_tz;

  WITH year_listens AS MATERIALIZED (
    SELECT l.album_id,
           l.listened_at,
           extract(MONTH FROM (l.listened_at AT TIME ZONE v_tz))::integer AS month
    FROM public.listens AS l
    WHERE l.user_id = p_user_id
      AND l.listened_at >= v_start
      AND l.listened_at < v_end
  ),
  album_counts AS (
    SELECT album_id, count(*)::bigint AS listens
    FROM year_listens
    WHERE album_id IS NOT NULL
    GROUP BY album_id
  ),
  month_counts AS (
    SELECT month, count(*)::bigint AS listens,
           count(DISTINCT album_id)::bigint AS albums
    FROM year_listens
    GROUP BY month
  ),
  artist_counts AS (
    -- albums.artist contains a primary artist only, not every collaborator.
    SELECT min(a.artist) AS name,
           sum(ac.listens)::bigint AS listens,
           count(*)::bigint AS albums
    FROM album_counts AS ac
    JOIN public.albums AS a ON a.spotify_id = ac.album_id
    WHERE nullif(btrim(a.artist), '') IS NOT NULL
    GROUP BY lower(a.artist)
  )
  SELECT jsonb_build_object(
    'totalListens', (SELECT count(*) FROM year_listens),
    'uniqueAlbums', (SELECT count(*) FROM album_counts),
    'uniqueArtists', (SELECT count(*) FROM artist_counts),
    'repeatListens', (
      SELECT coalesce(sum(greatest(ac.listens - 1, 0)), 0)
      FROM album_counts AS ac
    ),
    'discoveries', (
      -- First-ever registered listen for this album was within this year.
      -- Historical imported dates are used as recorded; never manufactured.
      SELECT count(*)
      FROM album_counts AS ac
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.listens AS older
        WHERE older.user_id = p_user_id
          AND older.album_id = ac.album_id
          AND older.listened_at < v_start
      )
    ),
    'ratedAlbums', (
      SELECT count(*)
      FROM album_counts AS ac
      JOIN public.reviews AS rv
        ON rv.user_id = p_user_id AND rv.album_id = ac.album_id
      WHERE rv.rating IS NOT NULL
    ),
    'monthly', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'month', m.month,
          'listens', coalesce(mc.listens, 0),
          'albums', coalesce(mc.albums, 0)
        ) ORDER BY m.month
      ), '[]'::jsonb)
      FROM generate_series(1,12) AS m(month)
      LEFT JOIN month_counts AS mc ON mc.month = m.month
    ),
    'topArtists', (
      SELECT coalesce(jsonb_agg(
        jsonb_build_object(
          'name', ranked.name,
          'listens', ranked.listens,
          'albums', ranked.albums
        ) ORDER BY ranked.listens DESC, ranked.name ASC
      ), '[]'::jsonb)
      FROM (
        SELECT name, listens, albums
        FROM artist_counts
        ORDER BY listens DESC, name ASC
        LIMIT 5
      ) AS ranked
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.yearly_top_stats(uuid, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.yearly_top_stats(uuid, integer)
  TO service_role;

COMMIT;

-- Read-only verification after manual application:
-- SELECT
--   has_function_privilege('anon',
--     'public.yearly_top_stats(uuid,integer)', 'EXECUTE') AS anon_exec,
--   has_function_privilege('authenticated',
--     'public.yearly_top_stats(uuid,integer)', 'EXECUTE') AS authenticated_exec,
--   has_function_privilege('service_role',
--     'public.yearly_top_stats(uuid,integer)', 'EXECUTE') AS service_exec;
--
-- Manual rollback (only before PR #16 is enabled on production):
-- DROP FUNCTION public.yearly_top_stats(uuid, integer);
