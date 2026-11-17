# Tornamesa — One rating per album: review/diary cutover

## Decision

- Each user has **one overall rating and review per album**: `public.reviews`
  (unique constraint `unique_user_album` already exists).
- `public.listens` records *events* and their dates. Its legacy `rating`
  and `review` columns are preserved for archival/export, but new
  application reads and new rating writes no longer use them.
- Editing an **Album rating / Album review** from any Diary entry updates
  `public.reviews`, and every diary entry for that album displays it,
  regardless of date. The album page, filtered diary, feed, statistics and
  monthly ranking use that same rating.
- Deleting an individual listen does **not** delete the overall album rating.
- The existing `reviews` trigger invalidates any months containing the
  album so monthly tops refresh only once on the next authorized read.
- Date and album review edits from one Diary Save are atomic through a
  service-role-only RPC. No user-supplied ID grants authorization.
- The Diary's historical personal log note, if present, is shown to the
  owner as read-only archival information. It is not copied to the
  general album review, which is visible to others allowed to view reviews.

## Important: historical data and visibility

Before applying the OPTIONAL legacy backfill, unreviewed albums with only
old `listens.rating` values will show **unrated** in Diary, album page,
stats and monthly ranking. The old ratings remain safely in the database.

The optional backfill creates real album review ratings from old logs.
**This changes their audience:** a historic per-listen score can become
visible in album reviews where the user previously had no review.
For this reason, it is **NOT** part of the required migration. Never
run it without checking counts and approving that increased visibility.

### Read-only impact preview — run before choosing backfill

```sql
WITH per_album AS (
  SELECT l.user_id, l.album_id,
    count(DISTINCT l.rating) AS distinct_old_ratings
  FROM public.listens AS l
  WHERE l.album_id IS NOT NULL AND l.rating IS NOT NULL
  GROUP BY l.user_id, l.album_id
),
without_review AS (
  SELECT p.* FROM per_album AS p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.reviews AS r
    WHERE r.user_id = p.user_id AND r.album_id = p.album_id
  )
)
SELECT
  count(*) AS albums_without_general_rating,
  count(DISTINCT user_id) AS users_affected,
  count(*) FILTER (WHERE distinct_old_ratings > 1)
    AS albums_with_conflicting_old_ratings
FROM without_review;
```

After reviewing the totals and backing up, the separately reviewed
`docs/optional_legacy_rating_backfill.sql` can be run **manually**.
It chooses the most recent rated listen per album, preserves existing
`reviews`, and never transfers old note text. Existing review triggers
will invalidate affected monthly tops. This backfill is idempotent.

## Required deployment sequence

1. Keep `main` on the currently working version; create Supabase backup.
2. Review/run only `supabase/migrations/20261117_01_canonical_album_review.sql`
   in SQL Editor. It creates `update_listen_and_album_review`, restricted
   to `service_role`, updates the existing transactional monthly rebuild to
   use **only reviews.rating**, and marks old monthly summaries dirty for
   lazy reconciliation. No listens/reviews are deleted or migrated.
3. Verify the function and grants with the query below. **SQL needs
   to be applied before running the Preview's edited Diary.**
4. Decide on the optional backfill *separately*, after running the preview
   count query. Do not execute it automatically.
5. Test the Preview with real test users and reviews, then merge the PR.

### Read-only post-install verification

```sql
SELECT p.proname, p.prosecdef AS security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS user_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'update_listen_and_album_review';

SELECT count(*) AS duplicate_album_reviews
FROM (
  SELECT user_id, album_id FROM public.reviews
  GROUP BY user_id, album_id HAVING count(*) > 1
) AS duplicates;

SELECT count(*) AS dirty_summaries
FROM public.monthly_summaries WHERE is_dirty = true;
```

Expected: 1 function, `security_definer=true`,
`anon_execute=false`, `user_execute=false`, `service_execute=true`.
Zero duplicated album reviews. Dirty count is variable and expected.

## Acceptance tests

1. For an album with an existing general rating, change its rating in
   **Diary → Edit log**. Save, reload, check the same album on multiple
   diary dates, filter results, and open the album page: **all match**.
2. Change the rating from the album page, refresh the Diary: **all match**.
   Edit the review text from either surface and verify identical text.
3. In Monthly Top, **listen count and unique albums remain unchanged**;
   rating updates and `generatedAt` advances once in every affected month.
   Subsequent refreshes keep the timestamp unchanged.
4. Edit only the listen date: review stays unchanged. Moving between
   months continues to update both affected totals and their rankings.
5. Test a previously unrated album from Diary: Save rating+text creates
   one review; adding additional listens never creates another review.
6. Delete a single listen: only its log disappears; overall album rating
   persists. Do not expect a review deletion when removing a listen.
7. Check album page, Diary, profile recent activity, feed, reviews and stats
   on PC and mobile. Confirm private diary/review access remains unchanged.
8. Test unauthorized PATCH and direct RPC invocation as anon/authenticated:
   ownership checks/EXECUTE grants must block them.
9. Test a database write failure with date + rating in one Save:
   the transaction rolls back both instead of making a partial edit.

The original migration for monthly top optimization remains in force.
No new schema table or new JavaScript package is required.
