-- ML RLS patch: safe membership check, training-only draft writes, service_role selects

-- ------------------------------------------------------------
-- A) Ensure ml_feature_snapshots SELECT policy does not depend
--    on a missing helper function
-- ------------------------------------------------------------
do $$
declare
  fn_exists boolean;
begin
  select exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_intervention_member'
      and n.nspname = 'public'
  ) into fn_exists;

  if not fn_exists then
    execute 'drop policy if exists "ml_feature_snapshots_select_if_member" on public.ml_feature_snapshots;';
    execute
      'create policy "ml_feature_snapshots_select_if_member"
       on public.ml_feature_snapshots
       for select
       to authenticated
       using (
         exists (
           select 1
           from public.intervention_members m
           where m.intervention_id = ml_feature_snapshots.intervention_id
             and m.user_id = auth.uid()
         )
       );';
  end if;
end $$;

-- ------------------------------------------------------------
-- B) Training-only writes for intervention_draft_snapshots
-- ------------------------------------------------------------
drop policy if exists "draft_snapshots_insert_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_insert_own"
on public.intervention_draft_snapshots
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.interventions i
    where i.id = intervention_draft_snapshots.intervention_id
      and i.is_training = true
  )
);

drop policy if exists "draft_snapshots_update_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_update_own"
on public.intervention_draft_snapshots
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.interventions i
    where i.id = intervention_draft_snapshots.intervention_id
      and i.is_training = true
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.interventions i
    where i.id = intervention_draft_snapshots.intervention_id
      and i.is_training = true
  )
);

drop policy if exists "draft_snapshots_delete_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_delete_own"
on public.intervention_draft_snapshots
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.interventions i
    where i.id = intervention_draft_snapshots.intervention_id
      and i.is_training = true
  )
);

-- ------------------------------------------------------------
-- C) service_role SELECT access for ml_models + ml_isa_ratings
-- ------------------------------------------------------------
drop policy if exists "ml_models_select_service_role" on public.ml_models;
create policy "ml_models_select_service_role"
on public.ml_models
for select
to service_role
using (true);

drop policy if exists "ml_isa_select_service_role" on public.ml_isa_ratings;
create policy "ml_isa_select_service_role"
on public.ml_isa_ratings
for select
to service_role
using (true);
