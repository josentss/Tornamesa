# Phase 2 — Monthly Top atomic rebuild and cutover

This PR is **not self-deploying**. The application calls new PostgreSQL RPCs.
**Apply and verify the migration before testing this branch in Preview, and
before merging to main.** The database is shared by the Preview and production
deployments in the current testing workflow.

## Existing diagnostic (provided by Supabase SQL Editor)

- 1,555 listens; 207 reviews; 51 monthly summaries; 2,436 top entries.
- No duplicated summaries, ranking positions or positive-listen summaries missing a monthly top.
- Largest user+UTC-month: 107 listens; no period above 1,000 listens.
- Existing btree `(user_id, listened_at DESC)` covers monthly lookups.
- Two provably duplicate nonunique indexes are removed; their identical peers remain.
- `monthly_summaries` has no `total_minutes`, `top_artist` or `most_listened_album_id`
  columns. The old `summaries/generate` API attempted to update them and is replaced.

## Operational sequence — IMPORTANT

1. Take a Supabase backup/snapshot. Keep the current `main` deployment.
2. Review and execute **only** `supabase/migrations/20261116_02_monthly_top_atomic.sql`
   in Supabase SQL Editor. It uses one BEGIN/COMMIT transaction; creates
   three invalidation triggers, three restricted functions, a dirty bit
   (initially true for existing summaries) and removes two redundant indices.
   It does not delete listens, reviews or existing top rows.
3. Run the **read-only** checks below. The three functions must be
   SECURITY DEFINER but **not executable by anon/authenticated**.
4. Test the final branch Preview (Vercel should build without requiring SQL,
   but runtime top routes require the new RPCs). Never merge before steps 2–3.
5. Verify A (owner), B (authorized mutual), C (stranger) and anonymous privacy.
6. Merge after successful tests. Do not run bulk destructive reset scripts.

## Read-only verification after manual SQL

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'monthly_summaries' AND column_name = 'is_dirty';

SELECT p.proname, p.prosecdef AS security_definer,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN (
  'monthly_top_timezone', 'rebuild_monthly_top_atomic',
  'list_listen_months'
);

SELECT tgname, tgrelid::regclass::text AS table_name
FROM pg_trigger
WHERE NOT tgisinternal AND tgname LIKE 'trg_monthly_top_dirty_%'
ORDER BY tgname;

SELECT
  has_function_privilege('anon',
    'public.rebuild_monthly_top_atomic(uuid,integer,integer)', 'EXECUTE') AS anon_rebuild,
  has_function_privilege('authenticated',
    'public.rebuild_monthly_top_atomic(uuid,integer,integer)', 'EXECUTE') AS authenticated_rebuild,
  has_function_privilege('service_role',
    'public.rebuild_monthly_top_atomic(uuid,integer,integer)', 'EXECUTE') AS service_rebuild;

SELECT is_dirty, count(*) AS summaries
FROM public.monthly_summaries
GROUP BY is_dirty ORDER BY is_dirty;

SELECT count(*) AS duplicated_ranks
FROM (
  SELECT summary_id, week, rank
  FROM public.monthly_top_entries
  GROUP BY summary_id, week, rank
  HAVING count(*) > 1
) AS repeated;
```

Expected: `anon_rebuild=false`, `authenticated_rebuild=false`,
`service_rebuild=true`, three invalidation triggers, no duplicate ranks.
Initially the 51 existing summaries are dirty (until accessed and rebuilt).
No new RLS policy is added, and old privacy policies are untouched.

## Preview acceptance tests

- A top for current month: first load may rebuild; repeated load should
  keep `generatedAt` stable while no data changed.
- Log, edit, delete a listen: month is invalidated; the next top visit
  rebuilds once; if moved to another month, both affected periods update.
- Change a review rating only (listen count unchanged): `avg_rating`
  is updated after visiting the top. Editing review text only should not
  invalidate rankings.
- Perform a notes import: exactly the touched local months are rebuilt;
  any failures appear in `monthsFailed`, not as successful rebuilds.
- Month boundary: America/Bogota, America/Caracas, UTC and a DST zone.
  Import month labels must match the user's *local* chosen month.
- Compare weekly 1–5 and full-month album rank/count/rating against
  a small existing account; ties resolve by count, first listen date, album ID.
- Test `/api/og/wrapped?username=PRIVATE&year=2026&month=11` anonymously:
  403 and no image. Public diary/open account still renders images.
- Viewer without `refresh` may access only authorized tops. Explicit
  `refresh=1` is owner-only and rate limited.
- Existing profile stats, private/mutual follower access, monthly Wrapped,
  share and CSV/JSON exports remain usable.
- With the available data no >1,000-listen real-month test is possible.
  PostgreSQL aggregation itself is not limited by PostgREST row pagination.

## Rollback considerations

If SQL install fails, its transaction rolls back. If the migration succeeds
but Preview has problems, keep the old main deployed and do not merge.
The DB additions are designed to coexist with the old code, though marking
summaries dirty can create extra work until this PR is deployed.

**Do not blindly drop the new functions/triggers** if this PR was already
merged: the new application depends on them. Coordinate any manual rollback
of both the application and schema together.

SQL has not been applied by this PR; it must be tested against Supabase
before anyone claims production-level transactional correctness.
