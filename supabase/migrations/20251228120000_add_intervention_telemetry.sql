-- Add intervention telemetry batches (append-only)

create table if not exists public.intervention_telemetry (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  stream text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  client_batch_started_at timestamptz null,
  client_batch_ended_at timestamptz null
);

create index if not exists idx_telemetry_intervention_created_at
  on public.intervention_telemetry (intervention_id, created_at desc);

create index if not exists idx_telemetry_user_created_at
  on public.intervention_telemetry (user_id, created_at desc);

create index if not exists idx_telemetry_stream
  on public.intervention_telemetry (stream);

create index if not exists idx_telemetry_payload_gin
  on public.intervention_telemetry using gin (payload);

alter table public.intervention_telemetry enable row level security;

create policy "telemetry_select_if_member"
on public.intervention_telemetry
for select
to authenticated
using (public.is_intervention_member(intervention_id));

create policy "telemetry_insert_own_if_member"
on public.intervention_telemetry
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_intervention_member(intervention_id)
);

-- IMPORTANT: append-only (no update/delete policies).

-- Retention (manual, optional):
-- delete from public.intervention_telemetry
-- where created_at < now() - interval '30 days';
-- delete from public.intervention_telemetry
-- where created_at < now() - interval '90 days';
