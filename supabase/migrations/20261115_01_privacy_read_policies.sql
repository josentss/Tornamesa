-- Tornamesa / Privacy, Fase 1 / review manually before execution.
-- Findings: "Reviews are viewable by everyone" made reviews_select ineffective.
-- Monthly summaries and entries must respect diary_public as well as is_private.
BEGIN;
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;

DROP POLICY IF EXISTS monthly_summaries_select ON public.monthly_summaries;
CREATE POLICY monthly_summaries_select ON public.monthly_summaries
FOR SELECT TO public
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.profiles p
  WHERE p.id = monthly_summaries.user_id
    AND p.is_private = false AND p.diary_public = true
));

DROP POLICY IF EXISTS monthly_top_entries_select ON public.monthly_top_entries;
CREATE POLICY monthly_top_entries_select ON public.monthly_top_entries
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM public.monthly_summaries s
  WHERE s.id = monthly_top_entries.summary_id
    AND (s.user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = s.user_id
        AND p.is_private = false AND p.diary_public = true
    ))
));
COMMIT;

-- Manual rollback (do not execute automatically):
-- BEGIN;
-- CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
--   FOR SELECT TO public USING (true);
-- DROP POLICY IF EXISTS monthly_summaries_select ON public.monthly_summaries;
-- CREATE POLICY monthly_summaries_select ON public.monthly_summaries
--   FOR SELECT TO public
--   USING (user_id = auth.uid() OR EXISTS (
--     SELECT 1 FROM public.profiles p WHERE p.id = monthly_summaries.user_id
--       AND p.is_private = false
--   ));
-- DROP POLICY IF EXISTS monthly_top_entries_select ON public.monthly_top_entries;
-- CREATE POLICY monthly_top_entries_select ON public.monthly_top_entries
--   FOR SELECT TO public
--   USING (EXISTS (
--     SELECT 1 FROM public.monthly_summaries s
--     WHERE s.id = monthly_top_entries.summary_id AND
--       (s.user_id = auth.uid() OR EXISTS (
--         SELECT 1 FROM public.profiles p
--         WHERE p.id = s.user_id AND p.is_private = false
--       ))
--   ));
-- COMMIT;
