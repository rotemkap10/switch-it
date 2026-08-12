-- Phase: claim_spot max aerial distance (1.5 km Haversine).
-- Extends the atomic claim RPC with seeker coordinates. Does not store them.
-- Keep MAX_CLAIM_DISTANCE_METERS = 1500 in sync with src/lib/map/distance.ts.

drop function if exists public.claim_spot(uuid);

create or replace function public.claim_spot(
  p_spot_id uuid,
  p_seeker_latitude double precision,
  p_seeker_longitude double precision
)
returns table (
  claim_id uuid,
  spot_id uuid,
  claim_expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_spot public.parking_spots%rowtype;
  v_credits integer;
  v_claim_id uuid;
  v_h double precision;
  v_distance_m double precision;
  -- WGS84 mean Earth radius in meters — matches src/lib/map/distance.ts
  c_earth_radius_m constant double precision := 6371000;
  c_max_claim_distance_m constant double precision := 1500;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_seeker_latitude is null
     or p_seeker_longitude is null
     or p_seeker_latitude < -90
     or p_seeker_latitude > 90
     or p_seeker_longitude < -180
     or p_seeker_longitude > 180 then
    raise exception 'LOCATION_REQUIRED' using errcode = 'P0001';
  end if;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = p_spot_id
  for update;

  if not found then
    raise exception 'SPOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Consistent boundary: claim requires now < expires_at
  if v_spot.expires_at <= pg_catalog.now() then
    raise exception 'SPOT_EXPIRED' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'available' then
    raise exception 'SPOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.owner_id = v_uid then
    raise exception 'SELF_CLAIM' using errcode = 'P0001';
  end if;

  select profiles.credits
  into v_credits
  from public.profiles as profiles
  where profiles.id = v_uid
  for update;

  if v_credits is null or v_credits < 1 then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.claims as existing_claims
    where existing_claims.seeker_id = v_uid
      and existing_claims.status = 'active'
  ) then
    raise exception 'ACTIVE_CLAIM_EXISTS' using errcode = 'P0001';
  end if;

  -- Straight-line Haversine (meters). Not ETA / road distance.
  v_h :=
    power(
      sin(radians((v_spot.latitude - p_seeker_latitude) / 2)),
      2
    )
    + cos(radians(p_seeker_latitude))
      * cos(radians(v_spot.latitude))
      * power(
        sin(radians((v_spot.longitude - p_seeker_longitude) / 2)),
        2
      );

  v_distance_m :=
    2 * c_earth_radius_m * asin(least(1.0, sqrt(v_h)));

  if v_distance_m > c_max_claim_distance_m then
    raise exception 'CLAIM_TOO_FAR' using errcode = 'P0001';
  end if;

  insert into public.claims (
    spot_id,
    seeker_id,
    status,
    expires_at
  )
  values (
    v_spot.id,
    v_uid,
    'active',
    v_spot.expires_at
  )
  returning id into v_claim_id;

  perform public.create_claim_handoff_secret(v_claim_id);

  update public.parking_spots as spots
  set
    status = 'claimed',
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id;

  return query
  select
    v_claim_id,
    v_spot.id,
    v_spot.expires_at;
end;
$$;

comment on function public.claim_spot(uuid, double precision, double precision) is
  'Atomic claim with max aerial distance 1500 m. Seeker lat/lng are transient inputs only.';

revoke all on function public.claim_spot(uuid, double precision, double precision) from public;
revoke all on function public.claim_spot(uuid, double precision, double precision) from anon;
grant execute on function public.claim_spot(uuid, double precision, double precision) to authenticated;
