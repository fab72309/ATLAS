-- Unified mode: allow draft snapshots for members (no training gate)
-- and optionally scope ISA ratings to intervention membership.

-- Draft snapshots: own rows + membership only
DROP POLICY IF EXISTS "draft_snapshots_insert_own" ON public.intervention_draft_snapshots;
CREATE POLICY "draft_snapshots_insert_own"
ON public.intervention_draft_snapshots
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = intervention_draft_snapshots.intervention_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "draft_snapshots_update_own" ON public.intervention_draft_snapshots;
CREATE POLICY "draft_snapshots_update_own"
ON public.intervention_draft_snapshots
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = intervention_draft_snapshots.intervention_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = intervention_draft_snapshots.intervention_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "draft_snapshots_delete_own" ON public.intervention_draft_snapshots;
CREATE POLICY "draft_snapshots_delete_own"
ON public.intervention_draft_snapshots
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = intervention_draft_snapshots.intervention_id
      AND m.user_id = auth.uid()
  )
);

-- ISA ratings: own rows + membership only (service_role select stays intact)
DROP POLICY IF EXISTS "ml_isa_select_own" ON public.ml_isa_ratings;
CREATE POLICY "ml_isa_select_own"
ON public.ml_isa_ratings
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = ml_isa_ratings.intervention_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ml_isa_insert_own" ON public.ml_isa_ratings;
CREATE POLICY "ml_isa_insert_own"
ON public.ml_isa_ratings
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = ml_isa_ratings.intervention_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ml_isa_update_own" ON public.ml_isa_ratings;
CREATE POLICY "ml_isa_update_own"
ON public.ml_isa_ratings
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = ml_isa_ratings.intervention_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = ml_isa_ratings.intervention_id
      AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "ml_isa_delete_own" ON public.ml_isa_ratings;
CREATE POLICY "ml_isa_delete_own"
ON public.ml_isa_ratings
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.intervention_members m
    WHERE m.intervention_id = ml_isa_ratings.intervention_id
      AND m.user_id = auth.uid()
  )
);
