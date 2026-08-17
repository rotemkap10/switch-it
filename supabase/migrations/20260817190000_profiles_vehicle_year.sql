-- Optional model year for catalog image matching (CarImages generation).
-- Existing rows stay valid with vehicle_year NULL.

alter table public.profiles
  add column if not exists vehicle_year integer;

alter table public.profiles
  drop constraint if exists profiles_vehicle_year_check;

alter table public.profiles
  add constraint profiles_vehicle_year_check
  check (
    vehicle_year is null
    or (
      vehicle_year >= 1990
      and vehicle_year <= (extract(year from current_date)::integer + 1)
    )
  );

comment on column public.profiles.vehicle_year is
  'Optional model year for catalog image matching. NULL for profiles created before this column.';

revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  license_plate,
  vehicle_make,
  vehicle_model,
  vehicle_year,
  vehicle_color,
  vehicle_type,
  vehicle_photo_path
) on table public.profiles to authenticated;

-- Recreate counterpart RPC with vehicle year (return type change requires drop).
drop function if exists public.get_handoff_counterpart_vehicle(uuid);

create function public.get_handoff_counterpart_vehicle(p_claim_id uuid)
returns table (
  vehicle_license_plate text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_color text,
  vehicle_type text,
  vehicle_photo_path text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_claim public.claims%rowtype;
  v_spot public.parking_spots%rowtype;
  v_counterpart_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select *
  into v_claim
  from public.claims as claims
  where claims.id = p_claim_id;

  if not found then
    return;
  end if;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id;

  if not found then
    return;
  end if;

  if v_claim.seeker_id is distinct from v_uid
    and v_spot.owner_id is distinct from v_uid then
    return;
  end if;

  if v_claim.status is distinct from 'active' then
    return;
  end if;

  if v_spot.status is distinct from 'claimed' then
    return;
  end if;

  if v_claim.expires_at <= pg_catalog.now() then
    return;
  end if;

  if v_spot.expires_at <= pg_catalog.now() then
    return;
  end if;

  if v_uid = v_claim.seeker_id then
    v_counterpart_id := v_spot.owner_id;
  else
    v_counterpart_id := v_claim.seeker_id;
  end if;

  return query
  select
    profiles.license_plate,
    profiles.vehicle_make,
    profiles.vehicle_model,
    profiles.vehicle_year,
    profiles.vehicle_color,
    profiles.vehicle_type,
    profiles.vehicle_photo_path
  from public.profiles as profiles
  where profiles.id = v_counterpart_id;
end;
$$;

comment on function public.get_handoff_counterpart_vehicle(uuid) is
  'Return the opposite participant vehicle fields for an active claim, including optional year and photo path. Seeker or spot owner only; no profile ids.';

revoke all on function public.get_handoff_counterpart_vehicle(uuid) from public;
revoke all on function public.get_handoff_counterpart_vehicle(uuid) from anon;
grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated;
