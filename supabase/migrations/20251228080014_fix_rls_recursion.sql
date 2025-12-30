-- Fix RLS recursion on intervention_members by using SECURITY DEFINER helper functions

-- 1) Helper functions (bypass RLS safely for membership checks)
create or replace function public.is_intervention_member(i uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = i
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_intervention_owner_admin(i uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
set row_security = off
as $$
  select exists (
    select 1
    from public.intervention_members m
    where m.intervention_id = i
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

-- 2) Drop old policies (to avoid conflicts/recursion)
drop policy if exists "members can read interventions" on public.interventions;
drop policy if exists "users can create interventions" on public.interventions;
drop policy if exists "owner_admin can update interventions" on public.interventions;

drop policy if exists "members can read members" on public.intervention_members;
drop policy if exists "owner_admin can add members; creator can bootstrap" on public.intervention_members;

drop policy if exists "members can read events" on public.intervention_events;
drop policy if exists "members can insert validated own events" on public.intervention_events;

-- 3) Recreate policies without self-referencing recursion

-- Interventions
create policy "interventions_select_member_or_creator"
on public.interventions
for select
to authenticated
using (
  created_by = auth.uid()
  or public.is_intervention_member(id)
);

create policy "interventions_insert_creator"
on public.interventions
for insert
to authenticated
with check (created_by = auth.uid());

create policy "interventions_update_owner_admin"
on public.interventions
for update
to authenticated
using (public.is_intervention_owner_admin(id))
with check (true);

-- Membership
create policy "members_select_if_member"
on public.intervention_members
for select
to authenticated
using (public.is_intervention_member(intervention_id));

create policy "members_insert_bootstrap_or_owner_admin"
on public.intervention_members
for insert
to authenticated
with check (
  (
    -- bootstrap: creator adds themself
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
    -- owner/admin adds someone
    public.is_intervention_owner_admin(intervention_id)
  )
);

-- Events
create policy "events_select_if_member"
on public.intervention_events
for select
to authenticated
using (public.is_intervention_member(intervention_id));

create policy "events_insert_validated_own_if_member"
on public.intervention_events
for insert
to authenticated
with check (
  user_id = auth.uid()
  and is_validated = true
  and public.is_intervention_member(intervention_id)
);

-- (append-only) no UPDATE/DELETE policies on intervention_events