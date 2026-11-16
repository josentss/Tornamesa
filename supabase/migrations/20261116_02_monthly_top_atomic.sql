-- Tornamesa / Phase 2 / transactional monthly tops and change-driven invalidation.
-- MANUAL MIGRATION. Apply via Supabase SQL Editor before validating/deploying the
-- application code in this PR. All statements are transactional.
-- The initial DEFAULT true intentionally marks existing 51 summaries stale for
-- one-time reconciliation on the first access to each month.
BEGIN;

ALTER TABLE public.monthly_summaries
  ADD COLUMN IF NOT EXISTS is_dirty boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.monthly_summaries.is_dirty IS
  'True after a relevant listen/review/timezone change; rebuilt lazily on the next authorized read.';

-- Validate timezone names in the database, with UTC fallback for empty/invalid
-- profile values. The trigger and rebuild use the SAME calendar boundaries.
CREATE OR REPLACE FUNCTION public.monthly_top_timezone(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tz text;
BEGIN
  SELECT NULLIF(p.timezone, '') INTO v_tz
  FROM public.profiles AS p
  WHERE p.id = p_user_id;

  IF v_tz IS NULL OR NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_timezone_names AS z WHERE z.name = v_tz
  ) THEN
    RETURN 'UTC';
  END IF;
  RETURN v_tz;
END;
$$;

-- This service-role-only RPC locks each user/month, reads the complete period
-- in PostgreSQL (no 1000-row PostgREST response cap), then atomically replaces
-- the monthly and weekly entries. Any error rolls back ALL writes.
CREATE OR REPLACE FUNCTION public.rebuild_monthly_top_atomic(
  p_user_id uuid,
  p_year integer,
  p_month integer
)
RETURNS SETOF public.monthly_summaries
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_tz text;
  v_start timestamptz;
  v_end timestamptz;
  v_summary_id uuid;
  v_total integer;
  v_unique integer;
BEGIN
  IF p_user_id IS NULL OR p_year IS NULL OR p_month IS NULL
     OR p_year NOT BETWEEN 1900 AND 2100 OR p_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Invalid monthly top period' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM public.profiles AS p WHERE p.id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found' USING ERRCODE = '22023';
  END IF;

  -- Lock before reading the source rows; concurrent rebuilds serialize.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_user_id::text || ':' || p_year::text || '-' || p_month::text,
      0::bigint
    )
  );

  v_tz := public.monthly_top_timezone(p_user_id);
  v_start := make_date(p_year, p_month, 1)::timestamp AT TIME ZONE v_tz;
  v_end := (make_date(p_year, p_month, 1) + interval '1 month')::timestamp AT TIME ZONE v_tz;

  SELECT count(*)::integer, count(DISTINCT l.album_id)::integer
    INTO v_total, v_unique
  FROM public.listens AS l
  WHERE l.user_id = p_user_id
    AND l.listened_at >= v_start AND l.listened_at < v_end;

  INSERT INTO public.monthly_summaries AS s
    (user_id, year, month, total_listens, unique_albums, generated_at, is_dirty)
  VALUES
    (p_user_id, p_year, p_month, v_total, v_unique, now(), false)
  ON CONFLICT (user_id, year, month) DO UPDATE SET
    total_listens = EXCLUDED.total_listens,
    unique_albums = EXCLUDED.unique_albums,
    generated_at = EXCLUDED.generated_at,
    is_dirty = false
  RETURNING s.id INTO v_summary_id;

  DELETE FROM public.monthly_top_entries AS e
  WHERE e.summary_id = v_summary_id;

  WITH listened AS MATERIALIZED (
    SELECT l.album_id, l.listened_at, l.rating,
      ceil(extract(DAY FROM (l.listened_at AT TIME ZONE v_tz)) / 7.0)::integer AS week
    FROM public.listens AS l
    WHERE l.user_id = p_user_id
      AND l.listened_at >= v_start AND l.listened_at < v_end
      AND l.album_id IS NOT NULL
  ),
  aggregated AS (
    SELECT NULL::integer AS week, album_id,
      count(*)::integer AS listen_count,
      min(listened_at) AS first_at,
      avg(rating::numeric) AS listen_avg
    FROM listened
    GROUP BY album_id
    UNION ALL
    SELECT week, album_id,
      count(*)::integer AS listen_count,
      min(listened_at) AS first_at,
      avg(rating::numeric) AS listen_avg
    FROM listened
    GROUP BY week, album_id
  ),
  ranked AS (
    SELECT a.*,
      row_number() OVER (
        PARTITION BY a.week
        ORDER BY a.listen_count DESC, a.first_at ASC, a.album_id ASC
      )::integer AS rank
    FROM aggregated AS a
  )
  INSERT INTO public.monthly_top_entries
    (summary_id, week, rank, album_id, listen_count, avg_rating)
  SELECT v_summary_id, r.week, r.rank, r.album_id, r.listen_count,
    CASE
      WHEN rv.rating IS NOT NULL THEN rv.rating::numeric
      ELSE round(r.listen_avg, 2)
    END
  FROM ranked AS r
  LEFT JOIN public.reviews AS rv
    ON rv.user_id = p_user_id AND rv.album_id = r.album_id
  WHERE (r.week IS NULL AND r.rank <= 500)
     OR (r.week IS NOT NULL AND r.rank <= 100);

  RETURN QUERY
    SELECT s.* FROM public.monthly_summaries AS s WHERE s.id = v_summary_id;
END;
$$;

-- Every INSERT/UPDATE/DELETE that changes an album, date or rating invalidates
-- the old and/or new user-local month, even when the total count stays equal.
CREATE OR REPLACE FUNCTION public.mark_monthly_top_dirty_on_listen()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id
    AND OLD.album_id IS NOT DISTINCT FROM NEW.album_id
    AND OLD.listened_at IS NOT DISTINCT FROM NEW.listened_at
    AND OLD.rating IS NOT DISTINCT FROM NEW.rating THEN
    RETURN NEW;
  END IF;

  IF TG_OP <> 'INSERT' AND OLD.listened_at IS NOT NULL THEN
    UPDATE public.monthly_summaries AS s
    SET is_dirty = true
    WHERE s.user_id = OLD.user_id
      AND s.year = extract(YEAR FROM (
        OLD.listened_at AT TIME ZONE public.monthly_top_timezone(OLD.user_id)
      ))::integer
      AND s.month = extract(MONTH FROM (
        OLD.listened_at AT TIME ZONE public.monthly_top_timezone(OLD.user_id)
      ))::integer;
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.listened_at IS NOT NULL THEN
    UPDATE public.monthly_summaries AS s
    SET is_dirty = true
    WHERE s.user_id = NEW.user_id
      AND s.year = extract(YEAR FROM (
        NEW.listened_at AT TIME ZONE public.monthly_top_timezone(NEW.user_id)
      ))::integer
      AND s.month = extract(MONTH FROM (
        NEW.listened_at AT TIME ZONE public.monthly_top_timezone(NEW.user_id)
      ))::integer;
  END IF;

  RETURN NULL; -- AFTER trigger: result is ignored
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_top_dirty_listens ON public.listens;
CREATE TRIGGER trg_monthly_top_dirty_listens
AFTER INSERT OR UPDATE OR DELETE ON public.listens
FOR EACH ROW EXECUTE FUNCTION public.mark_monthly_top_dirty_on_listen();

-- Rating changes can affect ANY month that contains that album, even when
-- number of listens and timestamps are unchanged.
CREATE OR REPLACE FUNCTION public.mark_monthly_top_dirty_on_review()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id
    AND OLD.album_id IS NOT DISTINCT FROM NEW.album_id
    AND OLD.rating IS NOT DISTINCT FROM NEW.rating THEN
    RETURN NULL;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    UPDATE public.monthly_summaries AS s
    SET is_dirty = true
    WHERE s.user_id = OLD.user_id
      AND EXISTS (
        SELECT 1 FROM public.listens AS l
        WHERE l.user_id = OLD.user_id AND l.album_id = OLD.album_id
          AND l.listened_at IS NOT NULL
          AND extract(YEAR FROM (
            l.listened_at AT TIME ZONE public.monthly_top_timezone(OLD.user_id)
          ))::integer = s.year
          AND extract(MONTH FROM (
            l.listened_at AT TIME ZONE public.monthly_top_timezone(OLD.user_id)
          ))::integer = s.month
      );
  END IF;

  IF TG_OP <> 'DELETE' THEN
    UPDATE public.monthly_summaries AS s
    SET is_dirty = true
    WHERE s.user_id = NEW.user_id
      AND EXISTS (
        SELECT 1 FROM public.listens AS l
        WHERE l.user_id = NEW.user_id AND l.album_id = NEW.album_id
          AND l.listened_at IS NOT NULL
          AND extract(YEAR FROM (
            l.listened_at AT TIME ZONE public.monthly_top_timezone(NEW.user_id)
          ))::integer = s.year
          AND extract(MONTH FROM (
            l.listened_at AT TIME ZONE public.monthly_top_timezone(NEW.user_id)
          ))::integer = s.month
      );
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_top_dirty_reviews ON public.reviews;
CREATE TRIGGER trg_monthly_top_dirty_reviews
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.mark_monthly_top_dirty_on_review();

-- Changing the time zone can move a listen across a month boundary.
CREATE OR REPLACE FUNCTION public.mark_monthly_top_dirty_on_timezone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.monthly_summaries AS s
  SET is_dirty = true
  WHERE s.user_id = NEW.id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_monthly_top_dirty_timezone ON public.profiles;
CREATE TRIGGER trg_monthly_top_dirty_timezone
AFTER UPDATE OF timezone ON public.profiles
FOR EACH ROW
WHEN (OLD.timezone IS DISTINCT FROM NEW.timezone)
EXECUTE FUNCTION public.mark_monthly_top_dirty_on_timezone();

-- Discover activity months directly from the full data set, without a
-- 5,000-listen fallback or the PostgREST result-row cap.
CREATE OR REPLACE FUNCTION public.list_listen_months(p_user_id uuid)
RETURNS TABLE (
  year integer, month integer, total_listens bigint, unique_albums bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  WITH zoned AS (
    SELECT l.album_id,
      l.listened_at AT TIME ZONE public.monthly_top_timezone(p_user_id) AS local_at
    FROM public.listens AS l
    WHERE l.user_id = p_user_id AND l.listened_at IS NOT NULL
  )
  SELECT extract(YEAR FROM z.local_at)::integer,
    extract(MONTH FROM z.local_at)::integer,
    count(*)::bigint,
    count(DISTINCT z.album_id)::bigint
  FROM zoned AS z
  GROUP BY 1, 2
  ORDER BY 1 DESC, 2 DESC;
$$;

-- SECURITY DEFINER functions must never be callable by browser Supabase users.
REVOKE ALL ON FUNCTION public.monthly_top_timezone(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rebuild_monthly_top_atomic(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.list_listen_months(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_monthly_top_dirty_on_listen()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_monthly_top_dirty_on_review()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mark_monthly_top_dirty_on_timezone()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.monthly_top_timezone(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.rebuild_monthly_top_atomic(uuid, integer, integer)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.list_listen_months(uuid) TO service_role;

COMMIT;

-- Read-only post-apply verification:
-- SELECT proname, pg_get_function_identity_arguments(p.oid) AS args,
--        p.prosecdef AS security_definer
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public'
--   AND p.proname IN (
--     'rebuild_monthly_top_atomic','list_listen_months','monthly_top_timezone'
--   );
-- SELECT tgname, tgrelid::regclass AS on_table
-- FROM pg_trigger
-- WHERE tgname LIKE 'trg_monthly_top_dirty_%' AND NOT tgisinternal;
-- SELECT is_dirty, count(*) FROM public.monthly_summaries GROUP BY is_dirty;
-- NEVER call the rebuild function or write data as part of verification before
-- reviewing the changes and backing up the database.
