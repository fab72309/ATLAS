-- Current means/sector state for interventions

create table if not exists public.intervention_means_state (
  intervention_id uuid primary key references public.interventions(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict
);

create trigger trg_means_state_updated_at
before update on public.intervention_means_state
for each row execute procedure extensions.moddatetime(updated_at);

alter table public.intervention_means_state enable row level security;

create policy "means_state_select_if_member"
on public.intervention_means_state
for select
to authenticated
using (public.is_intervention_member(intervention_id));

create policy "means_state_insert_own_if_member"
on public.intervention_means_state
for insert
to authenticated
with check (
  updated_by = auth.uid()
  and public.is_intervention_member(intervention_id)
);

create policy "means_state_update_own_if_member"
on public.intervention_means_state
for update
to authenticated
using (public.is_intervention_member(intervention_id))
with check (updated_by = auth.uid());
