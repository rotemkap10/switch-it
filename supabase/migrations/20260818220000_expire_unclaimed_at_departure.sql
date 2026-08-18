-- Unclaimed listings end at the promised departure (available_at).
-- The 3-minute window is only for an already-matched claimed handoff.
-- Seekers cannot newly claim after available_at unless the live handoff
-- already started (Now). Credits still move only on complete_claim.

comment on column public.parking_spots.available_at is
  'Promised departure. Unclaimed listings expire here. Claimed handoffs auto-start here.';
comment on column public.parking_spots.expires_at is
  'Authoritative deadline. Unclaimed unstarted: available_at (listing end). After a claim or live start: start + 3 minutes, or +5 after one extension.';

-- Legacy in-flight unclaimed spots: listing ends at the estimate, not +3.
update public.parking_spots as spots
set
  expires_at = spots.available_at,
  updated_at = pg_catalog.now()
where spots.status = 'available'
  and spots.handoff_started_at is null
  and spots.available_at > pg_catalog.now()
  and spots.expires_at > spots.available_at;

update public.parking_spots as spots
set
  status = 'expired',
  updated_at = pg_catalog.now()
where spots.status = 'available'
  and spots.handoff_started_at is null
  and spots.available_at <= pg_catalog.now();

-- Claimed but not yet started: reserve the 3-minute handoff window.
update public.parking_spots as spots
set
  expires_at = spots.available_at + interval '3 minutes',
  updated_at = pg_catalog.now()
where spots.status = 'claimed'
  and spots.handoff_started_at is null
  and spots.expires_at < spots.available_at + interval '3 minutes';

update public.claims as claims
set expires_at = spots.expires_at
from public.parking_spots as spots
where claims.spot_id = spots.id
  and claims.status = 'active'
  and claims.expires_at is distinct from spots.expires_at;

-- ---------------------------------------------------------------------------
-- Auto-start uses the 3-minute matched window from available_at, not a
-- leftover listing expires_at that might equal available_at.
-- ---------------------------------------------------------------------------
create or replace function public.auto_start_claimed_handoff_if_due(p_spot_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_spot public.parking_spots%rowtype;
  v_now timestamptz;
  v_started timestamptz;
  v_expires timestamptz;
begin
  v_now := pg_catalog.now();

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = p_spot_id
  for update;

  if not found then
    return false;
  end if;

  if v_spot.status is distinct from 'claimed' then
    return false;
  end if;

  if v_spot.handoff_started_at is not null then
    return false;
  end if;

  if v_now < v_spot.available_at then
    return false;
  end if;

  -- Matched window already elapsed: leave for expire_claim_if_needed.
  if v_now >= v_spot.available_at + interval '3 minutes' then
    return false;
  end if;

  v_started := v_spot.available_at;
  v_expires := v_spot.available_at + interval '3 minutes';

  update public.parking_spots as spots
  set
    handoff_started_at = v_started,
    expires_at = v_expires,
    updated_at = v_now
  where spots.id = v_spot.id
    and spots.status = 'claimed'
    and spots.handoff_started_at is null;

  if not found then
    return false;
  end if;

  update public.claims as claims
  set expires_at = v_expires
  where claims.spot_id = v_spot.id
    and claims.status = 'active';

  return true;
end;
$$;

comment on function public.auto_start_claimed_handoff_if_due(uuid) is
  'Starts a claimed unstarted handoff at available_at. Window is available_at + 3 minutes. Never overwrites an early start. No credits. Internal.';

revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from public;
revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from anon;
revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- expire_spot_if_needed: unclaimed unstarted listings end at available_at
-- ---------------------------------------------------------------------------
create or replace function public.expire_spot_if_needed(p_spot_id uuid)
returns table (
  spot_id uuid,
  spot_status text,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_spot public.parking_spots%rowtype;
  v_now timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_now := pg_catalog.now();

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = p_spot_id
  for update;

  if not found then
    raise exception 'SPOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_spot.owner_id is distinct from v_uid then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'available' then
    return query
    select
      v_spot.id,
      v_spot.status,
      false;
    return;
  end if;

  -- Started listings (Now) use expires_at. Unstarted listings end at available_at.
  if v_spot.handoff_started_at is null then
    if v_now < v_spot.available_at then
      return query
      select
        v_spot.id,
        v_spot.status,
        false;
      return;
    end if;
  elsif v_spot.expires_at > v_now then
    return query
    select
      v_spot.id,
      v_spot.status,
      false;
    return;
  end if;

  if exists (
    select 1
    from public.claims as claims
    where claims.spot_id = v_spot.id
      and claims.status = 'active'
  ) then
    return query
    select
      v_spot.id,
      v_spot.status,
      false;
    return;
  end if;

  update public.parking_spots as spots
  set
    status = 'expired',
    updated_at = v_now
  where spots.id = v_spot.id
    and spots.status = 'available';

  return query
  select
    v_spot.id,
    'expired'::text,
    true;
end;
$$;

comment on function public.expire_spot_if_needed(uuid) is
  'Lazy-expire an unclaimed available spot at available_at when unstarted, or at expires_at when already started (Now). Owner-only. No credits.';

revoke all on function public.expire_spot_if_needed(uuid) from public;
revoke all on function public.expire_spot_if_needed(uuid) from anon;
grant execute on function public.expire_spot_if_needed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- claim_spot: reject after promised departure unless the live window started.
-- On claim of a future spot, reserve available_at + 3 minutes.
-- ---------------------------------------------------------------------------
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

  perform public.create_claim_handoff_secret(v_claim_id);

  update public.parking_spots as spots
  set
    status = 'claimed',
    expires_at = v_claim_expires,
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id
    and spots.status = 'available';

  return query
  select
    v_claim_id,
    v_spot.id,
    v_claim_expires;
end;
$$;

comment on function public.claim_spot(uuid, double precision, double precision) is
  'Atomic claim with max aerial distance 1500 m. Future spots must be claimed before available_at; that claim reserves the 3-minute handoff window. No credits.';

revoke all on function public.claim_spot(uuid, double precision, double precision) from public;
revoke all on function public.claim_spot(uuid, double precision, double precision) from anon;
grant execute on function public.claim_spot(uuid, double precision, double precision) to authenticated;

-- ---------------------------------------------------------------------------
-- start_handoff_now: unclaimed early start ends the listing (no unmatched
-- 3-minute claim window). Claimed early start still opens the live handoff.
-- ---------------------------------------------------------------------------
create or replace function public.start_handoff_now(p_spot_id uuid)
returns table (
  spot_id uuid,
  claim_id uuid,
  handoff_started_at timestamptz,
  expires_at timestamptz,
  already_started boolean,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_spot public.parking_spots%rowtype;
  v_claim public.claims%rowtype;
  v_now timestamptz;
  v_started timestamptz;
  v_expires timestamptz;
  v_auto_started boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_now := pg_catalog.now();

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = p_spot_id
  for update;

  if not found then
    raise exception 'SPOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_spot.owner_id is distinct from v_uid then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if v_spot.status not in ('available', 'claimed') then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select *
  into v_claim
  from public.claims as claims
  where claims.spot_id = v_spot.id
    and claims.status = 'active'
  for update;

  if v_spot.handoff_started_at is not null then
    return query
    select
      v_spot.id,
      v_claim.id,
      v_spot.handoff_started_at,
      v_spot.expires_at,
      true,
      false;
    return;
  end if;

  if v_now >= v_spot.available_at then
    if v_spot.status is distinct from 'claimed' then
      update public.parking_spots as spots
      set
        status = 'expired',
        updated_at = v_now
      where spots.id = v_spot.id
        and spots.status = 'available'
        and spots.handoff_started_at is null;
      raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
    end if;

    v_auto_started := public.auto_start_claimed_handoff_if_due(v_spot.id);

    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = p_spot_id;

    if v_spot.handoff_started_at is null then
      raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
    end if;

    return query
    select
      v_spot.id,
      v_claim.id,
      v_spot.handoff_started_at,
      v_spot.expires_at,
      not v_auto_started,
      v_auto_started;
    return;
  end if;

  -- Early: unclaimed listing ends now (publisher is leaving, no matched seeker).
  if v_spot.status is not distinct from 'available' then
    update public.parking_spots as spots
    set
      status = 'expired',
      updated_at = v_now
    where spots.id = v_spot.id
      and spots.status = 'available'
      and spots.handoff_started_at is null;

    if found then
      return query
      select
        v_spot.id,
        v_claim.id,
        null::timestamptz,
        v_now,
        false,
        true;
      return;
    end if;

    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = p_spot_id;

    select *
    into v_claim
    from public.claims as claims
    where claims.spot_id = v_spot.id
      and claims.status = 'active';

    if v_spot.handoff_started_at is not null then
      return query
      select
        v_spot.id,
        v_claim.id,
        v_spot.handoff_started_at,
        v_spot.expires_at,
        true,
        false;
      return;
    end if;

    if v_spot.status is distinct from 'claimed' then
      raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
    end if;
  end if;

  v_started := v_now;
  v_expires := v_now + interval '3 minutes';

  update public.parking_spots as spots
  set
    handoff_started_at = v_started,
    expires_at = v_expires,
    updated_at = v_now
  where spots.id = v_spot.id
    and spots.handoff_started_at is null
    and spots.status = 'claimed';

  if not found then
    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = p_spot_id;

    return query
    select
      v_spot.id,
      v_claim.id,
      v_spot.handoff_started_at,
      v_spot.expires_at,
      true,
      false;
    return;
  end if;

  if v_claim.id is not null then
    update public.claims as claims
    set expires_at = v_expires
    where claims.id = v_claim.id
      and claims.status = 'active';
  end if;

  return query
  select
    v_spot.id,
    v_claim.id,
    v_started,
    v_expires,
    false,
    true;
end;
$$;

comment on function public.start_handoff_now(uuid) is
  'Publisher starts a claimed handoff early, or expires an unclaimed listing when leaving before anyone claims. Idempotent once started. No unmatched 3-minute claim window. No credits.';

revoke all on function public.start_handoff_now(uuid) from public;
revoke all on function public.start_handoff_now(uuid) from anon;
grant execute on function public.start_handoff_now(uuid) to authenticated;
