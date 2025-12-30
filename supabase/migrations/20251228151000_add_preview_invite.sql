-- Preview invite metadata before joining

create or replace function public.preview_invite(
  p_token text
)
returns table (
  intervention_id uuid,
  title text,
  incident_number text,
  address_line1 text,
  street_number text,
  street_name text,
  postal_code text,
  city text
)
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

  select
    v.intervention_id,
    v.expires_at,
    v.max_uses,
    v.uses_count,
    i.title,
    i.incident_number,
    i.address_line1,
    i.street_number,
    i.street_name,
    i.postal_code,
    i.city
  into v_invite
  from public.intervention_invites v
  join public.interventions i on i.id = v.intervention_id
  where v.token = p_token;

  if not found then
    raise exception 'Invite not found';
  end if;

  if v_invite.expires_at is not null and v_invite.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses then
    raise exception 'Invite max uses reached';
  end if;

  return query
  select
    v_invite.intervention_id,
    v_invite.title,
    v_invite.incident_number,
    v_invite.address_line1,
    v_invite.street_number,
    v_invite.street_name,
    v_invite.postal_code,
    v_invite.city;
end;
$$;
