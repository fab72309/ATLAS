-- Add command_level for onboarding without breaking existing employment_level usage.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name text,
  employment_level text null,
  command_level text generated always as (
    case employment_level
      when 'chef_de_groupe' then 'chef_groupe'
      when 'chef_de_colonne' then 'chef_colonne'
      when 'chef_de_site' then 'chef_site'
      else null
    end
  ) stored,
  shortcut_keys text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_employment_level_check
    check (employment_level in ('chef_de_groupe', 'chef_de_colonne', 'chef_de_site') or employment_level is null),
  constraint profiles_command_level_check
    check (command_level in ('chef_groupe', 'chef_colonne', 'chef_site') or command_level is null)
);

alter table public.profiles enable row level security;

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'command_level'
  ) then
    alter table public.profiles
      add column command_level text generated always as (
        case employment_level
          when 'chef_de_groupe' then 'chef_groupe'
          when 'chef_de_colonne' then 'chef_colonne'
          when 'chef_de_site' then 'chef_site'
          else null
        end
      ) stored;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_command_level_check'
  ) then
    alter table public.profiles
      add constraint profiles_command_level_check
      check (command_level in ('chef_groupe', 'chef_colonne', 'chef_site') or command_level is null);
  end if;
end;
$$;
