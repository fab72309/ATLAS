-- ML schema: training mode, ISA ratings, feature snapshots, models, draft snapshots
-- Additive only (no breaking changes).

create extension if not exists pgcrypto;

-- -------------------------
-- Interventions: training flag
-- -------------------------
alter table public.interventions
  add column if not exists is_training boolean not null default true,
  add column if not exists training_set_at timestamptz not null default now(),
  add column if not exists training_set_by uuid null references public.profiles(id) on delete set null;

update public.interventions
set training_set_at = coalesce(training_set_at, created_at)
where training_set_at is null;

-- -------------------------
-- ISA ratings (supervised labels)
-- -------------------------
create table if not exists public.ml_isa_ratings (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null,
  isa smallint not null,
  source text not null default 'manual',
  notes text null,
  created_at timestamptz not null default now(),
  constraint ml_isa_ratings_isa_check check (isa between 1 and 5),
  constraint ml_isa_ratings_source_check check (source in ('manual', 'prompted'))
);

create index if not exists idx_ml_isa_ratings_intervention_recorded_at
  on public.ml_isa_ratings (intervention_id, recorded_at);

create index if not exists idx_ml_isa_ratings_user_recorded_at
  on public.ml_isa_ratings (user_id, recorded_at);

-- -------------------------
-- Feature snapshots (time-series)
-- -------------------------
create table if not exists public.ml_feature_snapshots (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  ts timestamptz not null,
  feature_version text not null default 'v1.0.0',
  features jsonb not null,
  isa_label smallint null,
  overload_label boolean null,
  created_at timestamptz not null default now(),
  constraint ml_feature_snapshots_unique unique (intervention_id, ts, feature_version),
  constraint ml_feature_snapshots_features_object check (jsonb_typeof(features) = 'object'),
  constraint ml_feature_snapshots_isa_label_check check (isa_label between 1 and 5 or isa_label is null)
);

create index if not exists idx_ml_feature_snapshots_intervention_ts
  on public.ml_feature_snapshots (intervention_id, ts);

create index if not exists idx_ml_feature_snapshots_feature_version
  on public.ml_feature_snapshots (feature_version);

-- -------------------------
-- Model registry
-- -------------------------
create table if not exists public.ml_models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  feature_version text not null,
  scaler jsonb not null,
  thresholds jsonb not null,
  artifact_path text null,
  created_at timestamptz not null default now(),
  constraint ml_models_unique unique (name, version),
  constraint ml_models_scaler_object check (jsonb_typeof(scaler) = 'object'),
  constraint ml_models_thresholds_object check (jsonb_typeof(thresholds) = 'object')
);

create index if not exists idx_ml_models_name_version
  on public.ml_models (name, version);

create index if not exists idx_ml_models_feature_version
  on public.ml_models (feature_version);

-- -------------------------
-- Draft snapshots (training only)
-- -------------------------
create table if not exists public.intervention_draft_snapshots (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  recorded_at timestamptz not null,
  draft jsonb not null,
  source text not null default 'oi_draft',
  created_at timestamptz not null default now(),
  constraint intervention_draft_snapshots_draft_object check (jsonb_typeof(draft) = 'object')
);

create index if not exists idx_draft_snapshots_intervention_recorded_at
  on public.intervention_draft_snapshots (intervention_id, recorded_at);

create index if not exists idx_draft_snapshots_user_recorded_at
  on public.intervention_draft_snapshots (user_id, recorded_at);

-- -------------------------
-- Optional additive: client-recorded timestamp for means state
-- -------------------------
alter table public.intervention_means_state
  add column if not exists client_recorded_at timestamptz;

create index if not exists idx_means_state_intervention_client_recorded_at
  on public.intervention_means_state (intervention_id, client_recorded_at);
