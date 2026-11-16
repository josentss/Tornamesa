-- Tornamesa / Fase 1 / Social relationship read privacy.
-- Apply manually in Supabase SQL Editor AFTER reviewing the Preview tests.
-- Reviewed starting policy: follows_select FOR SELECT TO public USING (true).
-- Other policies on follows (insert/delete own) are not changed.
--
-- Public relationships remain readable when both accounts are public.
-- A signed-in participant can see their own follow relationship, even if
-- the other participant has a private profile.
-- This restriction also applies to direct queries subject to RLS;
-- server routes using service_role must still check canView separately.
BEGIN;

DROP POLICY IF EXISTS follows_select ON public.follows;

CREATE POLICY follows_select ON public.follows
  FOR SELECT TO public
  USING (
    follower_id = auth.uid()
    OR following_id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = follows.follower_id AND p.is_private = false
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = follows.following_id AND p.is_private = false
      )
    )
  );

COMMIT;

-- Manual rollback - SECURITY WARNING: restores unrestricted reads of follows.
-- Run only after understanding the privacy impact, not automatically.
-- BEGIN;
-- DROP POLICY IF EXISTS follows_select ON public.follows;
-- CREATE POLICY follows_select ON public.follows
--   FOR SELECT TO public USING (true);
-- COMMIT;

-- Post-apply read-only verification:
-- SELECT policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'follows'
-- ORDER BY policyname;
