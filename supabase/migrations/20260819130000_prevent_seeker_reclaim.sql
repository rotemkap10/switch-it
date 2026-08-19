-- Seekers who voluntarily released a listing cannot reclaim that same
-- parking_spot_id. Other seekers still can. A later new listing is unaffected.
-- Credits still move only on complete_claim. No penalties.

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
  v_claim_expires timestamptz;
  v_h double precision;
  v_distance_m double precision;
  v_constraint_name text;
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

  -- Serialize concurrent claims on this listing.
  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = p_spot_id
  for update;

  if not found then
    raise exception 'SPOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_spot.expires_at <= pg_catalog.now() then
    raise exception 'SPOT_EXPIRED' using errcode = 'P0001';
  end if;

  -- Unstarted listings are not claimable at/after the promised departure.
  -- Started listings (Now) remain claimable until expires_at.
  if v_spot.handoff_started_at is null
    and pg_catalog.now() >= v_spot.available_at then
    raise exception 'SPOT_EXPIRED' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'available' then
    raise exception 'SPOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.owner_id = v_uid then
    raise exception 'SELF_CLAIM' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.claims as previous_claims
    where previous_claims.spot_id = v_spot.id
      and previous_claims.seeker_id = v_uid
      and previous_claims.status = 'cancelled'
      and previous_claims.cancelled_by = 'seeker'
  ) then
    raise exception 'ALREADY_RELEASED_THIS_SPOT' using errcode = 'P0001';
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

  if v_spot.handoff_started_at is null then
    v_claim_expires := v_spot.available_at + interval '3 minutes';
  else
    v_claim_expires := v_spot.expires_at;
  end if;

  begin
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
      v_claim_expires
    )
    returning id into v_claim_id;
  exception
    when unique_violation then
      get stacked diagnostics
        v_constraint_name = constraint_name;

      if v_constraint_name = 'claims_one_active_per_seeker' then
        raise exception 'ACTIVE_CLAIM_EXISTS' using errcode = 'P0001';
      elsif v_constraint_name = 'claims_one_active_per_spot' then
        raise exception 'SPOT_UNAVAILABLE' using errcode = 'P0001';
      else
        raise;
      end if;
  end;

  perform public.create_claim_handoff_secret(v_claim_id);

  update public.parking_spots as spots
  set
    status = 'claimed',
    expires_at = v_claim_expires,
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id
    and spots.status = 'available';

  if not found then
    raise exception 'SPOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  return query
  select
    v_claim_id,
    v_spot.id,
    v_claim_expires;
end;
$$;

comment on function public.claim_spot(uuid, double precision, double precision) is
  'Atomic claim: locks the spot row, then inserts the only active claim. Future spots must be claimed before available_at. Seekers who voluntarily released this listing cannot reclaim it. No credits.';

revoke all on function public.claim_spot(uuid, double precision, double precision) from public;
revoke all on function public.claim_spot(uuid, double precision, double precision) from anon;
grant execute on function public.claim_spot(uuid, double precision, double precision) to authenticated;
