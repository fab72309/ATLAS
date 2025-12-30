-- ATLAS core schema (Supabase Auth native)
-- Objectif : multi-utilisateur, multi-intervention, journal append-only,
--            saisies "validées" tracées + horodatage serveur + RLS.
--
-- Hypothèse : l'app utilise Supabase Auth (supabase-js) et RLS s'appuie sur auth.uid().

create extension if not exists pgcrypto;
create extension if not exists moddatetime schema extensions;

-- =========================
-- 1) Interventions
-- =========================
create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  title text,
  status text not null default 'open',

  created_by uuid not null references auth.users(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_interventions_updated_at
before update on public.interventions
for each row execute procedure extensions.moddatetime(updated_at);

-- =========================
-- 2) Membership (accès à une intervention)
-- =========================
create table if not exists public.intervention_members (
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  role text not null default 'member',  -- owner | admin | member
  joined_at timestamptz not null default now(),

  primary key (intervention_id, user_id)
);

create index if not exists idx_members_user_intervention
  on public.intervention_members (user_id, intervention_id);

create index if not exists idx_members_intervention_role
  on public.intervention_members (intervention_id, role);

-- =========================
-- 3) Journal des saisies (append-only)
-- =========================
create table if not exists public.intervention_events (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,

  user_id uuid not null references auth.users(id) on delete restrict,

  -- Typage d'événement (ex : "OI_VALIDATED", "NOTE_VALIDATED", "ACTION_VALIDATED", etc.)
  event_type text not null,

  -- Contenu libre structuré : { schema_version, data, metrics }
  payload jsonb not null default '{}'::jsonb,

  -- Horodatage serveur (source de vérité)
  created_at timestamptz not null default now(),

  -- Horodatage côté client (utile pour offline / latence réseau)
  client_recorded_at timestamptz null,

  -- Validation utilisateur (on ne veut stocker ici que du validé)
  is_validated boolean not null default true,
  validated_at timestamptz not null default now(),

  -- Lier plusieurs versions d'une même entrée logique (révisions successives)
  logical_id uuid null,

  constraint chk_events_validated_only check (is_validated = true and validated_at is not null)
);

create index if not exists idx_events_intervention_created_at
  on public.intervention_events (intervention_id, created_at desc);

create index if not exists idx_events_user_created_at
  on public.intervention_events (user_id, created_at desc);

create index if not exists idx_events_event_type
  on public.intervention_events (event_type);

create index if not exists idx_events_payload_gin
  on public.intervention_events using gin (payload);

-- =========================
-- 4) RLS (sécurité par utilisateur + intervention)
-- =========================
alter table public.interventions enable row level security;
alter table public.intervention_members enable row level security;
alter table public.intervention_events enable row level security;

-- ---------
-- Interventions
-- ---------

-- Lecture si membre
create policy "members can read interventions"
on public.interventions
for select
to authenticated
using (
  exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = id
      and m.user_id = auth.uid()
  )
);

-- Création si created_by = utilisateur courant
create policy "users can create interventions"
on public.interventions
for insert
to authenticated
with check (created_by = auth.uid());

-- Modification réservée owner/admin
create policy "owner_admin can update interventions"
on public.interventions
for update
to authenticated
using (
  exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (true);

-- ---------
-- Membership
-- ---------

-- Lecture de la liste des membres si je suis membre
create policy "members can read members"
on public.intervention_members
for select
to authenticated
using (
  exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = intervention_id
      and m.user_id = auth.uid()
  )
);

-- Ajout de membres :
-- - bootstrap : le créateur s’ajoute lui-même (typ. role='owner')
-- - ou owner/admin ajoute quelqu’un
create policy "owner_admin can add members; creator can bootstrap"
on public.intervention_members
for insert
to authenticated
with check (
  (
    -- bootstrap : l'utilisateur s'ajoute lui-même s'il est créateur
    user_id = auth.uid()
    and exists (
      select 1
      from public.interventions i
      where i.id = intervention_id
        and i.created_by = auth.uid()
    )
  )
  or
  (
    -- owner/admin ajoute un membre
    exists (
      select 1
      from public.intervention_members m
      where m.intervention_id = intervention_id
        and m.user_id = auth.uid()
        and m.role in ('owner','admin')
    )
  )
);

-- ---------
-- Events (append-only)
-- ---------

-- Lecture des events si membre
create policy "members can read events"
on public.intervention_events
for select
to authenticated
using (
  exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = intervention_id
      and m.user_id = auth.uid()
  )
);

-- Insertion d'events validés uniquement si :
-- (a) user_id = auth.uid()
-- (b) l'utilisateur est membre
-- (c) is_validated = true
create policy "members can insert validated own events"
on public.intervention_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and is_validated = true
  and exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = intervention_id
      and m.user_id = auth.uid()
  )
);

-- IMPORTANT : append-only
-- AUCUNE policy UPDATE/DELETE sur intervention_events.
-- Sans policy, Postgres refusera update/delete via l'API pour authenticated.