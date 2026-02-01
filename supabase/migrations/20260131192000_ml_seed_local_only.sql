-- ============================================================
-- LOCAL/DEV ONLY SEED - ML TRAINING DATA (DO NOT RUN IN PROD)
-- Requires: current_setting('app.env', true) in ('local','development')
-- ============================================================

do $$
declare
  app_env text := current_setting('app.env', true);
  seed_user_id uuid;
  seed_user_email text;
  instance_id uuid;
  hashed_password text;
  cols text[] := '{}'::text[];
  vals text[] := '{}'::text[];
  col text;
  intervention_a uuid;
  intervention_b uuid;
  base_ts timestamptz := now() - interval '8 hours';
begin
  if app_env is null or app_env not in ('local', 'development') then
    raise notice 'ML seed skipped: set app.env=local (or development) to run this migration.';
    return;
  end if;

  -- Pick an existing profile if available
  select id into seed_user_id
  from public.profiles
  limit 1;

  -- If no profile exists, attempt to create a local auth user + profile
  if seed_user_id is null then
    seed_user_id := gen_random_uuid();
    seed_user_email := 'local-dev-' || replace(seed_user_id::text, '-', '') || '@atlas.local';
    hashed_password := crypt('local-dev-password', gen_salt('bf'));

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'instance_id'
    ) then
      if exists (
        select 1
        from information_schema.tables
        where table_schema = 'auth'
          and table_name = 'instances'
      ) then
        select id into instance_id
        from auth.instances
        limit 1;
      end if;
    end if;

    cols := '{}'::text[];
    vals := '{}'::text[];

    for col in
      select column_name
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and is_nullable = 'NO'
        and column_default is null
        and is_identity = 'NO'
        and is_generated = 'NEVER'
      order by ordinal_position
    loop
      case col
        when 'id' then
          cols := array_append(cols, col);
          vals := array_append(vals, quote_literal(seed_user_id::text));
        when 'instance_id' then
          if instance_id is null then
            raise exception 'ML seed aborted: auth.users.instance_id is required but no auth.instances row found.';
          end if;
          cols := array_append(cols, col);
          vals := array_append(vals, quote_literal(instance_id::text));
        when 'aud' then
          cols := array_append(cols, col);
          vals := array_append(vals, quote_literal('authenticated'));
        when 'role' then
          cols := array_append(cols, col);
          vals := array_append(vals, quote_literal('authenticated'));
        when 'email' then
          cols := array_append(cols, col);
          vals := array_append(vals, quote_literal(seed_user_email));
        when 'encrypted_password' then
          cols := array_append(cols, col);
          vals := array_append(vals, quote_literal(hashed_password));
        when 'created_at' then
          cols := array_append(cols, col);
          vals := array_append(vals, 'now()');
        when 'updated_at' then
          cols := array_append(cols, col);
          vals := array_append(vals, 'now()');
        when 'is_sso_user' then
          cols := array_append(cols, col);
          vals := array_append(vals, 'false');
        when 'is_anonymous' then
          cols := array_append(cols, col);
          vals := array_append(vals, 'false');
        else
          raise exception 'ML seed aborted: unsupported required auth.users column: %', col;
      end case;
    end loop;

    if array_length(cols, 1) is null then
      raise exception 'ML seed aborted: unable to detect required auth.users columns.';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'raw_app_meta_data'
    ) and not ('raw_app_meta_data' = any(cols)) then
      cols := array_append(cols, 'raw_app_meta_data');
      vals := array_append(
        vals,
        quote_literal('{"provider":"email","providers":["email"]}') || '::jsonb'
      );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'raw_user_meta_data'
    ) and not ('raw_user_meta_data' = any(cols)) then
      cols := array_append(cols, 'raw_user_meta_data');
      vals := array_append(
        vals,
        quote_literal('{"first_name":"Local","last_name":"Seed"}') || '::jsonb'
      );
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'email_confirmed_at'
    ) and not ('email_confirmed_at' = any(cols)) then
      cols := array_append(cols, 'email_confirmed_at');
      vals := array_append(vals, 'now()');
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'confirmed_at'
    ) and not ('confirmed_at' = any(cols)) then
      cols := array_append(cols, 'confirmed_at');
      vals := array_append(vals, 'now()');
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'auth'
        and table_name = 'users'
        and column_name = 'is_super_admin'
    ) and not ('is_super_admin' = any(cols)) then
      cols := array_append(cols, 'is_super_admin');
      vals := array_append(vals, 'false');
    end if;

    execute format(
      'insert into auth.users (%s) values (%s) on conflict (id) do nothing',
      array_to_string(cols, ', '),
      array_to_string(vals, ', ')
    );

    -- Ensure profile exists (trigger might already have created it)
    insert into public.profiles (id, first_name, last_name, employment_level)
    values (seed_user_id, 'Local', 'Seed', null)
    on conflict (id) do nothing;
  end if;

  if seed_user_id is null then
    raise exception 'ML seed aborted: no profile/user available to own seed interventions.';
  end if;

  -- Seed interventions (reuse if already created)
  select id into intervention_a
  from public.interventions
  where title = 'ML Seed - Training Alpha'
  limit 1;

  if intervention_a is null then
    insert into public.interventions (
      title,
      status,
      created_by,
      address_line1,
      street_number,
      street_name,
      city,
      incident_number,
      is_training,
      training_set_at,
      training_set_by
    )
    values (
      'ML Seed - Training Alpha',
      'open',
      seed_user_id,
      '10 Rue des Tests',
      '10',
      'Rue des Tests',
      'Paris',
      'ML-001',
      true,
      now(),
      seed_user_id
    )
    returning id into intervention_a;
  end if;

  select id into intervention_b
  from public.interventions
  where title = 'ML Seed - Training Bravo'
  limit 1;

  if intervention_b is null then
    insert into public.interventions (
      title,
      status,
      created_by,
      address_line1,
      street_number,
      street_name,
      city,
      incident_number,
      is_training,
      training_set_at,
      training_set_by
    )
    values (
      'ML Seed - Training Bravo',
      'open',
      seed_user_id,
      '24 Avenue du Drill',
      '24',
      'Avenue du Drill',
      'Lyon',
      'ML-002',
      true,
      now(),
      seed_user_id
    )
    returning id into intervention_b;
  end if;

  insert into public.intervention_members (intervention_id, user_id, role, command_level)
  values
    (intervention_a, seed_user_id, 'owner', 'group'),
    (intervention_b, seed_user_id, 'owner', 'group')
  on conflict (intervention_id, user_id) do nothing;

  -- Clean previous ML seed data for idempotency
  delete from public.ml_feature_snapshots
  where intervention_id in (intervention_a, intervention_b);

  delete from public.ml_isa_ratings
  where intervention_id in (intervention_a, intervention_b)
    and user_id = seed_user_id;

  -- Insert ~500 feature snapshots per intervention (1/min over ~8h20)
  with seed_interventions as (
    select unnest(array[intervention_a, intervention_b]) as intervention_id
  ),
  series as (
    select
      i.intervention_id,
      base_ts + (g || ' minutes')::interval as ts,
      g,
      (1 + floor(random() * 4))::int as objective_count,
      (1 + floor(random() * 3))::int as sector_count,
      (1 + floor(random() * 3))::int as maneuver_per_objective_max,
      (2 + floor(random() * 10))::int as selected_means_count,
      (10 + floor(random() * 60))::int as sitac_object_count,
      (floor(random() * 15))::int as sitac_edit_rate_5m,
      (floor(random() * 20))::int as event_rate_5m,
      (floor(random() * 8))::int as request_rate_5m,
      case
        when random() < 0.65 then 0
        when random() < 0.85 then 1
        else 2
      end as stability_state_code
    from seed_interventions i
    cross join generate_series(0, 499) as g
  ),
  computed as (
    select
      *,
      case
        when extract(hour from ts) between 7 and 18 then 0
        when extract(hour from ts) between 19 and 22 then 1
        else 2
      end as night_bucket,
      (objective_count + floor(random() * 3))::int as maneuver_count,
      round((random() * 1.8 + 0.6)::numeric, 2) as domain_weight_sum
    from series
  ),
  scored as (
    select
      *,
      (
        domain_weight_sum * 0.6
        + objective_count * 0.5
        + maneuver_count * 0.2
        + sector_count * 0.35
        + event_rate_5m * 0.08
        + request_rate_5m * 0.12
        + night_bucket * 0.4
        + stability_state_code * 0.3
        + random() * 0.7
      ) as stress
    from computed
  ),
  labeled as (
    select
      *,
      case
        when stress < 1.8 then 1
        when stress < 3.0 then 2
        when stress < 4.2 then 3
        when stress < 5.4 then 4
        else 5
      end as isa
    from scored
  )
  insert into public.ml_feature_snapshots (
    intervention_id,
    ts,
    feature_version,
    features,
    isa_label,
    overload_label
  )
  select
    intervention_id,
    ts,
    'v1.0.0',
    jsonb_build_object(
      'domain_weight_sum', domain_weight_sum,
      'night_bucket', night_bucket,
      'objective_count', objective_count,
      'maneuver_count', maneuver_count,
      'maneuver_per_objective_max', maneuver_per_objective_max,
      'sector_count', sector_count,
      'selected_means_count', selected_means_count,
      'sitac_object_count', sitac_object_count,
      'sitac_edit_rate_5m', sitac_edit_rate_5m,
      'event_rate_5m', event_rate_5m,
      'request_rate_5m', request_rate_5m,
      'stability_state_code', stability_state_code
    ),
    case when (g % 2 = 0) then isa else null end,
    case when (g % 2 = 0) then (isa >= 4) else null end
  from labeled
  on conflict (intervention_id, ts, feature_version) do nothing;

  -- Insert ISA ratings every ~2 minutes aligned to snapshot timestamps
  insert into public.ml_isa_ratings (
    intervention_id,
    user_id,
    recorded_at,
    isa,
    source,
    notes
  )
  select
    intervention_id,
    seed_user_id,
    ts + make_interval(secs => floor(random() * 30)::int),
    isa_label,
    case when random() < 0.7 then 'prompted' else 'manual' end,
    null
  from public.ml_feature_snapshots
  where intervention_id in (intervention_a, intervention_b)
    and isa_label is not null;
end $$;
