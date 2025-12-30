-- Ensure pgcrypto is available and gen_random_bytes resolves inside SECURITY DEFINER functions

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

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
set search_path = extensions, public, pg_temp
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
