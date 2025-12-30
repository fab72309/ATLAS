-- Add append-only user events for non-intervention telemetry

create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  client_recorded_at timestamptz null,
  logical_id uuid null
);

create index if not exists idx_user_events_user_created_at
  on public.user_events (user_id, created_at desc);

create index if not exists idx_user_events_event_type
  on public.user_events (event_type);

create index if not exists idx_user_events_payload_gin
  on public.user_events using gin (payload);

alter table public.user_events enable row level security;

create policy "user_events_select_own"
on public.user_events
for select
to authenticated
using (user_id = auth.uid());

create policy "user_events_insert_own"
on public.user_events
for insert
to authenticated
with check (user_id = auth.uid());

-- IMPORTANT: append-only (no update/delete policies)
