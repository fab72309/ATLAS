-- ML RLS policies (safe defaults)

-- -------------------------
-- ISA ratings: users can read/write only their own rows
-- -------------------------
alter table public.ml_isa_ratings enable row level security;

drop policy if exists "ml_isa_select_own" on public.ml_isa_ratings;
create policy "ml_isa_select_own"
on public.ml_isa_ratings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "ml_isa_insert_own" on public.ml_isa_ratings;
create policy "ml_isa_insert_own"
on public.ml_isa_ratings
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "ml_isa_update_own" on public.ml_isa_ratings;
create policy "ml_isa_update_own"
on public.ml_isa_ratings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "ml_isa_delete_own" on public.ml_isa_ratings;
create policy "ml_isa_delete_own"
on public.ml_isa_ratings
for delete
to authenticated
using (user_id = auth.uid());

-- -------------------------
-- Draft snapshots: users can read/write only their own rows
-- -------------------------
alter table public.intervention_draft_snapshots enable row level security;

drop policy if exists "draft_snapshots_select_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_select_own"
on public.intervention_draft_snapshots
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "draft_snapshots_insert_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_insert_own"
on public.intervention_draft_snapshots
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "draft_snapshots_update_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_update_own"
on public.intervention_draft_snapshots
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "draft_snapshots_delete_own" on public.intervention_draft_snapshots;
create policy "draft_snapshots_delete_own"
on public.intervention_draft_snapshots
for delete
to authenticated
using (user_id = auth.uid());

-- Optional: service_role read access for training pipelines
drop policy if exists "draft_snapshots_select_service_role" on public.intervention_draft_snapshots;
create policy "draft_snapshots_select_service_role"
on public.intervention_draft_snapshots
for select
to service_role
using (true);

-- -------------------------
-- Feature snapshots: read-only for members, write-only for service_role
-- -------------------------
alter table public.ml_feature_snapshots enable row level security;

drop policy if exists "ml_feature_snapshots_select_if_member" on public.ml_feature_snapshots;
create policy "ml_feature_snapshots_select_if_member"
on public.ml_feature_snapshots
for select
to authenticated
using (public.is_intervention_member(intervention_id));

drop policy if exists "ml_feature_snapshots_service_role_all" on public.ml_feature_snapshots;
create policy "ml_feature_snapshots_service_role_all"
on public.ml_feature_snapshots
for all
to service_role
using (true)
with check (true);

-- -------------------------
-- Models: read-only for authenticated, write-only for service_role
-- -------------------------
alter table public.ml_models enable row level security;

drop policy if exists "ml_models_select_authenticated" on public.ml_models;
create policy "ml_models_select_authenticated"
on public.ml_models
for select
to authenticated
using (true);

drop policy if exists "ml_models_service_role_write" on public.ml_models;
create policy "ml_models_service_role_write"
on public.ml_models
for insert
to service_role
with check (true);

drop policy if exists "ml_models_service_role_update" on public.ml_models;
create policy "ml_models_service_role_update"
on public.ml_models
for update
to service_role
using (true)
with check (true);

drop policy if exists "ml_models_service_role_delete" on public.ml_models;
create policy "ml_models_service_role_delete"
on public.ml_models
for delete
to service_role
using (true);
