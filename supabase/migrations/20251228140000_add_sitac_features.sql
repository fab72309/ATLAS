-- Current SITAC state (shared between intervention members)

create table if not exists public.sitac_features (
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  feature_id text not null,
  symbol_type text not null,
  lat double precision not null,
  lng double precision not null,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id) on delete restrict,
  primary key (intervention_id, feature_id)
);

create index if not exists idx_sitac_features_intervention_id
  on public.sitac_features (intervention_id);

create index if not exists idx_sitac_features_props_gin
  on public.sitac_features using gin (props);

create trigger trg_sitac_features_updated_at
before update on public.sitac_features
for each row execute procedure extensions.moddatetime(updated_at);

alter table public.sitac_features enable row level security;

create policy "sitac_features_select_if_member"
on public.sitac_features
for select
to authenticated
using (public.is_intervention_member(intervention_id));

create policy "sitac_features_insert_own_if_member"
on public.sitac_features
for insert
to authenticated
with check (
  updated_by = auth.uid()
  and public.is_intervention_member(intervention_id)
);

create policy "sitac_features_update_own_if_member"
on public.sitac_features
for update
to authenticated
using (public.is_intervention_member(intervention_id))
with check (updated_by = auth.uid());

create policy "sitac_features_delete_if_member"
on public.sitac_features
for delete
to authenticated
using (public.is_intervention_member(intervention_id));
