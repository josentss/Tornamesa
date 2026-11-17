# PR #11 — Fresh Spotify searches with a protected shared catalog

## Why the previous threshold was wrong

PR #10 skipped Spotify whenever `searchLocalAlbums` returned >=8 results.
An artist with many old saved albums could therefore hide a new release unless
the user clicked a separate refresh button. The number of local hits does
not tell the application when Spotify was last searched.

## New behavior

- All users share the same Supabase album catalog. New users do NOT have an empty personal music catalog.
- Search reads Supabase first and, if the normalized query has NOT been successfully checked against Spotify within 6 hours, makes at most one remote request for up to 10 search results.
- This applies whether the local catalog has 0, 8, 50 or more matching albums.
- A successful Spotify result is considered fresh only after its basic catalog rows have been persisted.
- Ordered IDs of the last remote Spotify matches are kept for 6 hours in Upstash (per-instance memory fallback), and rehydrated from Supabase for subsequent searches. Thus recently discovered albums do not disappear on immediate refresh.
- The user can request 'Check Spotify for newer albums'. It bypasses the 6-hour freshness window, but never the 2-minute per-query attempt window nor the existing global Spotify request limiter / 429 cooldown.
- A network failure, quota issue, or Spotify 429 never creates a false freshness stamp. Existing local results stay visible.
- If Upstash is configured but coordination fails, search works in local-only mode until coordination recovers (fail closed). When Upstash isn't configured, an in-memory per-instance freshness stamp offers best-effort throttling. Shared Upstash is strongly recommended for multiple Vercel instances.
- Search responses remain arrays. `X-Search-Freshness` and `X-Search-Source` describe how results were obtained, and Search UI shows a small status line.

## Constraints

- A query can be up to 6 hours behind newly published Spotify search results in automatic mode; manual refresh can be requested subject to safe throttling.
- Spotify search ranks results itself and its Development Mode endpoint caps a single request at 10. A new release outside Spotify's first 10 may still require searching its album title directly or following a Spotify album link.
- Under an exhausted quota, no application can guarantee immediate discovery of uncached albums. Search correctly shows local catalog results instead of inventing data.
- This change does not bulk import, delete, or rewrite historical albums, listens or reviews.
- No additional Supabase SQL migration is required. PR #10's import ledger and permissions stay unchanged.
- Spotify developer terms restrict indefinite local caching of Spotify metadata; the per-query freshness state and ID ordering here expire after 6 hours. The existing persistent album catalog retention deserves separate compliance review.

## QA with zero *deliberate* Spotify calls

1. Verify the code does not depend on local.length < 8 (automated test).
2. Tests simulate a first query, freshness skip, manual attempt throttling, stale query expiration, failed remote requests and preserved recent IDs — they do not call Spotify.
3. Use local/Preview browser while Spotify is limited. Search a familiar artist and inspect X-Search-Freshness and X-Search-Source. Local albums should appear even when Spotify cannot be consulted.
4. Without connecting to Spotify, test Import logs as specified in docs/import-spotify-phase2-cutover.md; Import Preview stays offline by default.
5. With a healthy rate budget only, search a particular artist once and check X-Search-Freshness=updated; immediate repetition should be recently-refreshed, with the same first remote albums and zero additional Spotify requests.
6. Test manual refresh: within two minutes shows recently attempted; later may make one new call if quota is available. Repeated clicks must not trigger a burst.

References:
- https://developer.spotify.com/documentation/web-api/concepts/rate-limits
- https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide
- https://developer.spotify.com/terms
