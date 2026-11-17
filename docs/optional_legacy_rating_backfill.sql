-- OPTIONAL, USER-APPROVED DATA MIGRATION — never run without auditing.
--
-- This intentionally CREATES new public.reviews ratings from the most recent
-- rated listen for each user+album that has no canonical review. It makes those
-- ratings visible wherever the corresponding album reviews are visible.
-- It does NOT publish/transfer the old per-listen notes. It never overwrites
-- any existing album reviews and does not remove historical listen columns.
--
-- First run the read-only impact query in docs/canonical-album-rating-cutover.md
-- and review the totals. Make a Supabase backup before executing this script.
-- If ratings in the same album differ across historical listens, the most
-- recent listened_at date (and largest listen ID for ties) is chosen.
BEGIN;

WITH chosen AS (
  SELECT DISTINCT ON (l.user_id, l.album_id)
    l.user_id, l.album_id, l.rating
  FROM public.listens AS l
  WHERE l.album_id IS NOT NULL AND l.rating IS NOT NULL
  ORDER BY l.user_id, l.album_id, l.listened_at DESC NULLS LAST, l.id DESC
),
created AS (
  INSERT INTO public.reviews (user_id, album_id, rating, review_text)
  SELECT c.user_id, c.album_id, c.rating, NULL
  FROM chosen AS c
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reviews AS r
    WHERE r.user_id = c.user_id AND r.album_id = c.album_id
  )
  ON CONFLICT (user_id, album_id) DO NOTHING
  RETURNING id
)
SELECT count(*) AS album_ratings_imported FROM created;

COMMIT;
