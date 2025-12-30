-- Add address fields + logical document ids to interventions

alter table public.interventions
  add column if not exists address_line1 text,
  add column if not exists street_number text,
  add column if not exists street_name text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists incident_number text,
  add column if not exists oi_logical_id uuid default gen_random_uuid(),
  add column if not exists conduite_logical_id uuid default gen_random_uuid();

update public.interventions
set
  oi_logical_id = coalesce(oi_logical_id, gen_random_uuid()),
  conduite_logical_id = coalesce(conduite_logical_id, gen_random_uuid());
