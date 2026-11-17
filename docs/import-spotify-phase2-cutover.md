# Tornamesa — PR #10: Import logs and Spotify resilience

## Starting database state (November 2026)

- 3,677 albums; 3,541 without positive duration (96.3%).
- 136 albums with positive duration; 0 albums missing cover.
- 373 album IDs occur in listens; no persistent tracklist table exists.
- No bulk refresh/backfill is performed by this PR.

## Server behavior

- Import Preview defaults to local-only. It makes ZERO Spotify requests.
- Remote discovery is optional and visible: Find missing on Spotify (limited).
- This option requires working Upstash Redis; without it, remote import fails closed.
- Redis allows at most 3 searches per user/source file per hour (2 per chunk).
- Each unresolved line uses one Spotify search, maximum 10 results, not three searches.
- 429, QUOTA_EXCEEDED and Retry-After activate a shared cooldown; no retry loop.
- The Spotify outbound budget defaults to 5 calls per rolling 30 seconds and can be configured via SPOTIFY_CALLS_PER_30S (1–12). This is an application safety cap, not Spotify's published quota.
- Normal search reads Supabase first. With 8 or more local results it skips Spotify; a small link offers explicit additional Spotify discovery.
- Remote search results are persisted in one awaited batch, without overwriting existing positive durations.
- Album pages have a one-hour temporary metadata cache (Upstash when available, otherwise per-instance memory). At most two additional pages of tracks are requested. The artist/genres request has been removed.
- On Spotify failure, only genuine local metadata is displayed; no invented tracklist/duration. Offline testing: GET /api/albums/<spotify-id>?local=1.
- No permanent track mirror is created because Spotify restricts indefinite metadata storage.

## Required database migration BEFORE enabling Import Commit

1. Back up Supabase.
2. Manually apply supabase/migrations/20261117_02_safe_import_note_rows.sql in Supabase SQL Editor.
3. The migration creates public.import_note_rows and public.commit_note_import_atomic(uuid,text,jsonb). It does not delete or update old listens, reviews, albums or monthly summaries.
4. New ledger tracks user + SHA256 of original named .txt + source line index. Security-definer RPC is executable only by service_role, not anon/authenticated.
5. All selected, validated lines insert into listens in one SQL transaction. Replaying the same file safely skips previously imported lines; newly selected lines can still be added later.
6. The insert triggers from PR #7 still mark affected months dirty. A post-commit rebuild failure is reported and the summary remains dirty for the next authorized read.
7. IMPORTANT: imports done before this PR were not recorded in the new ledger. Reimporting such old source files can duplicate historical listens. Use a new dedicated .txt for QA.
8. Deleting an imported listen intentionally does not delete its ledger claim; replaying the same file will not silently re-create a deliberately removed test listen.

## Read-only verification

After applying SQL, check:

    SELECT to_regclass('public.import_note_rows') IS NOT NULL AS ledger_exists;
    SELECT has_function_privilege('anon', 'public.commit_note_import_atomic(uuid,text,jsonb)', 'EXECUTE') AS anon_exec,
           has_function_privilege('authenticated', 'public.commit_note_import_atomic(uuid,text,jsonb)', 'EXECUTE') AS authenticated_exec,
           has_function_privilege('service_role', 'public.commit_note_import_atomic(uuid,text,jsonb)', 'EXECUTE') AS server_exec;
    SELECT count(*) AS imported_lines FROM public.import_note_rows;
    SELECT count(*) AS total_listens FROM public.listens;

Expected: ledger_exists true; privileges false/false/true; ledger count 0 before the first new import. Existing listens count must be unchanged immediately after migration.

## Zero-Spotify acceptance test

1. Create a fresh test file named 2026-02.txt containing one local known album, such as: 1- Boris at Last - Feedbacker, Boris. The album must already exist in Supabase.
2. Record the February Monthly Top listens, unique albums and generatedAt before import.
3. Upload the file in Import month logs; expect Offline preview · 0 Spotify requests.
4. If the album needs review, choose its correct match explicitly. Do not press Find missing on Spotify for this test.
5. Commit once; expect inserted=1, linesImported=1, linesAlreadyImported=0, with +1 listen in February. Any monthly rebuild errors must be clearly shown.
6. Upload and commit the identical source again; expect inserted=0, linesAlreadyImported=1, and no duplicate listen.
7. Confirm generatedAt stability after repeat reads, then delete only the new test listen and verify totals return to baseline.
8. Open /api/albums/<known-id>?local=1 to test the metadata fallback with zero Spotify requests.
9. Check a known positive duration remains unchanged after ordinary search. Do not run a mass catalog backfill.
10. Only later, after verifying Upstash, optionally test ONE missing album with bounded remote discovery. Stop on 429 or quota exhaustion.

## Limits and caveats

- A successful Vercel build does not validate the SQL migration or live Spotify integration.
- Import idempotency applies only to files imported through this version, not older imports.
- Without Upstash, normal website searches have per-instance best-effort throttling; remote discovery during imports is disabled for safety.
- The original 3,541 albums with missing durations cannot magically gain tracks when Spotify is down; avoid expensive bulk backfills.
- Spotify allows temporary metadata/cover caching as necessary for the app, and restricts indefinite storing. Review retention of preexisting persistent catalog records separately.

References: https://developer.spotify.com/documentation/web-api/concepts/rate-limits
https://developer.spotify.com/documentation/web-api/concepts/quota-modes
https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
https://developer.spotify.com/terms
