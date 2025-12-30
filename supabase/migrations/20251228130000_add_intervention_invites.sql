-- Add invitation flow for joining interventions

alter table public.intervention_members
  add column if not exists command_level text;

create table if not exists public.intervention_invites (
  id uuid primary key default gen_random_uuid(),
  intervention_id uuid not null references public.interventions(id) on delete cascade,
  token text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  max_uses integer null,
  uses_count integer not null default 0,
  constraint intervention_invites_token_unique unique (token)
);

create index if not exists idx_invites_intervention_id
  on public.intervention_invites (intervention_id);

create index if not exists idx_invites_created_by
  on public.intervention_invites (created_by);

create index if not exists idx_invites_expires_at
  on public.intervention_invites (expires_at);

alter table public.intervention_invites enable row level security;

create policy "invites_select_owner_admin"
on public.intervention_invites
for select
to authenticated
using (public.is_intervention_owner_admin(intervention_id));

create policy "invites_insert_owner_admin"
on public.intervention_invites
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_intervention_owner_admin(intervention_id)
);

-- SECURITY DEFINER helpers for invite creation/joining
create or replace function public.create_invite(
  p_intervention_id uuid,
  p_expires_at timestamptz default null,
  p_max_uses integer default null
)
returns table (
  token text,
  invite_id uuid,
  expires_at timestamptz,
  max_uses integer,
  uses_count integer
)
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_token text;
  v_invite_id uuid;
  v_max_uses integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_intervention_owner_admin(p_intervention_id) then
    raise exception 'Not authorized';
  end if;

  v_max_uses := case when p_max_uses is not null and p_max_uses > 0 then p_max_uses else null end;

  loop
    v_token := encode(gen_random_bytes(32), 'hex');
    begin
      insert into public.intervention_invites (
        intervention_id,
        token,
        created_by,
        expires_at,
        max_uses
      )
      values (
        p_intervention_id,
        v_token,
        auth.uid(),
        p_expires_at,
        v_max_uses
      )
      returning id into v_invite_id;
      exit;
    exception when unique_violation then
      -- retry token generation
    end;
  end loop;

  return query
    select v_token, v_invite_id, p_expires_at, v_max_uses, 0;
end;
$$;

create or replace function public.join_by_token(
  p_token text,
  p_command_level text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set row_security = off
as $$
declare
  v_invite record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'Invalid token';
  end if;
  if p_command_level not in ('group', 'column', 'site', 'communication') then
    raise exception 'Invalid command_level';
  end if;

  select *
  into v_invite
  from public.intervention_invites
  where token = p_token
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses then
    raise exception 'Invite max uses reached';
  end if;

  insert into public.intervention_members (
    intervention_id,
    user_id,
    role,
    command_level
  )
  values (
    v_invite.intervention_id,
    auth.uid(),
    'member',
    p_command_level
  )
  on conflict (intervention_id, user_id)
  do update set command_level = excluded.command_level;

  update public.intervention_invites
  set uses_count = uses_count + 1
  where id = v_invite.id;

  return v_invite.intervention_id;
end;
$$;
