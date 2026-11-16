# Tornamesa — Phase 1 privacy closeout

This document records the intended product privacy contract after PRs #1–#6.
Privacy authorization remains enforced by the server, not by browser-supplied user IDs.

## Access contract

| Situation | Profile and social directories | Diary / monthly tops / stats | Recent listens in profile or feeds |
| --- | --- | --- | --- |
| Public profile; Public diary ON; activity ON | Visible | Visible | Visible |
| Public profile; diary ON; activity OFF | Visible | Visible | Hidden |
| Public profile; diary OFF | Visible | Hidden | Hidden, regardless of stored activity preference |
| Private profile; visitor not followed mutually | Limited profile; its own lists blocked | Hidden | Hidden |
| Private profile; verified mutual follower | Visible; its lists accessible | Controlled by Public diary | Requires both Public diary and activity ON |
| Profile owner | Full access | Full access | Full access |

- A private account can appear in the followers/following lists of a public account.
- Follower/following counters include all relationships; private account directories remain restricted.
- Reciprocal follow verification requires both directions on the server. Removing either follow revokes the exception.
- `Show recent activity` keeps its stored value when `Public diary` is switched off and is paused in settings, not reset.
- Album reviews and user-created lists are separate from the diary/Recent Activity switches and follow profile-access authorization.

## Data rules and delivery

- RLS read migrations `20261115_01_privacy_read_policies.sql` and `20261116_01_follows_read_privacy.sql` were executed and verified manually during the phase.
- Direct Supabase RLS reads can be more restrictive than API responses where verified mutual access is granted; do not treat a `service_role` client as authorization.
- PR #6 adds no new migration, schema change or dependency.

## Merge acceptance checklist

- [ ] Settings: the three switches persist; activity is disabled *visually* when diary is off without changing its saved value.
- [ ] Settings: save success and failure/uncertain-network states are correct; no overlapping writes.
- [ ] Visitor / one-way follower / mutual follower / owner access matrix remains correct.
- [ ] Diary OFF, activity ON: no recent activities are visible to other users, but the preference stays ON and resumes when the diary is re-enabled.
- [ ] Diary ON, activity OFF: diary/tops/stats remain visible to authorized visitors, recent activity is hidden.
- [ ] Mutual access revoked by unfollowing takes effect without special refresh; public social lists still include private account identities.
- [ ] Desktop and mobile layouts remain usable; Vercel Preview build and unit tests pass.

## Deferred volume test

The “Load more” behavior for more than 40 relationships could not be verified with the current small user base. Test it when a suitably sized dataset exists, before claiming load pagination is fully validated at scale.
