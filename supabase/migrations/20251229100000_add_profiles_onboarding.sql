-- Profiles table for onboarding and editable user profile
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  employment_level text null,
  shortcut_keys text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_employment_level_check
    check (employment_level in ('chef_de_groupe', 'chef_de_colonne', 'chef_de_site') or employment_level is null)
);

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute procedure extensions.moddatetime(updated_at);

alter table public.profiles enable row level security;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

create policy "users can insert own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_level text;
begin
  if new.raw_user_meta_data ? 'employment_level' then
    allowed_level := lower(new.raw_user_meta_data->>'employment_level');
  end if;

  if allowed_level not in ('chef_de_groupe', 'chef_de_colonne', 'chef_de_site') then
    allowed_level := null;
  end if;

  insert into public.profiles (id, first_name, last_name, employment_level)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'first_name','')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'last_name','')), ''),
    allowed_level
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_handle_new_user_profile on auth.users;
create trigger trg_handle_new_user_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();
