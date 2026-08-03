-- Cancellation and lazy claim expiry RPCs.
-- No credit balance or credit_transaction changes.

-- ---------------------------------------------------------------------------
-- cancel_claim
-- ---------------------------------------------------------------------------
create or replace function public.cancel_claim(p_claim_id uuid)
returns table (
  claim_id uuid,
  spot_id uuid,
  claim_status text,
  spot_status text,
  already_cancelled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_claim public.claims%rowtype;
  v_spot public.parking_spots%rowtype;
  v_spot_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select *
  into v_claim
  from public.claims as claims
  where claims.id = p_claim_id
  for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_claim.seeker_id is distinct from v_uid then
    raise exception 'NOT_SEEKER' using errcode = 'P0001';
  end if;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id
  for update;

  if not found then
    raise exception 'SPOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_claim.status = 'cancelled' then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_claim.status,
      v_spot.status,
      true;
    return;
  end if;

  if v_claim.status is distinct from 'active' then
    raise exception 'CLAIM_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if v_spot.expires_at > pg_catalog.now() then
    v_spot_status := 'available';
  else
    v_spot_status := 'expired';
  end if;

  update public.claims as claims
  set
    status = 'cancelled',
    cancelled_at = pg_catalog.now()
  where claims.id = v_claim.id;

  update public.parking_spots as spots
  set
    status = v_spot_status,
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id;

  return query
  select
    v_claim.id,
    v_spot.id,
    'cancelled'::text,
    v_spot_status,
    false;
end;
$$;

comment on function public.cancel_claim(uuid) is
  'Seeker cancels an active claim. Reopens or expires the spot. No credits.';

revoke all on function public.cancel_claim(uuid) from public;
revoke all on function public.cancel_claim(uuid) from anon;
grant execute on function public.cancel_claim(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_spot
-- ---------------------------------------------------------------------------
create or replace function public.cancel_spot(p_spot_id uuid)
returns table (
  spot_id uuid,
  spot_status text,
  cancelled_claim_id uuid,
  already_cancelled boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_claim public.claims%rowtype;
  v_spot public.parking_spots%rowtype;
  v_has_active_claim boolean := false;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- Prefer claim-first locking when an active claim exists (matches complete_claim).
  select *
  into v_claim
  from public.claims as claims
  where claims.spot_id = p_spot_id
    and claims.status = 'active'
  for update;

  if found then
    v_has_active_claim := true;

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

    if v_spot.status = 'cancelled' then
      return query
      select
        v_spot.id,
        v_spot.status,
        null::uuid,
        true;
      return;
    end if;

    if v_spot.status in ('completed', 'expired') then
      raise exception 'SPOT_NOT_CANCELLABLE' using errcode = 'P0001';
    end if;

    if v_spot.status is distinct from 'claimed'
      or v_claim.status is distinct from 'active' then
      raise exception 'INCONSISTENT_STATE' using errcode = 'P0001';
    end if;

    update public.claims as claims
    set
      status = 'cancelled',
      cancelled_at = pg_catalog.now()
    where claims.id = v_claim.id;

    update public.parking_spots as spots
    set
      status = 'cancelled',
      updated_at = pg_catalog.now()
    where spots.id = v_spot.id;

    return query
    select
      v_spot.id,
      'cancelled'::text,
      v_claim.id,
      false;
    return;
  end if;

  -- No active claim: lock spot only.
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

  if v_spot.status = 'cancelled' then
    return query
    select
      v_spot.id,
      v_spot.status,
      null::uuid,
      true;
    return;
  end if;

  if v_spot.status in ('completed', 'expired') then
    raise exception 'SPOT_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  if v_spot.status = 'claimed' then
    raise exception 'INCONSISTENT_STATE' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'available' then
    raise exception 'SPOT_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  update public.parking_spots as spots
  set
    status = 'cancelled',
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id;

  return query
  select
    v_spot.id,
    'cancelled'::text,
    null::uuid,
    false;
end;
$$;

comment on function public.cancel_spot(uuid) is
  'Owner cancels a published spot and any active claim. No credits.';

revoke all on function public.cancel_spot(uuid) from public;
revoke all on function public.cancel_spot(uuid) from anon;
grant execute on function public.cancel_spot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_claim_if_needed
-- ---------------------------------------------------------------------------
create or replace function public.expire_claim_if_needed(p_claim_id uuid)
returns table (
  claim_id uuid,
  spot_id uuid,
  claim_status text,
  spot_status text,
  changed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_claim public.claims%rowtype;
  v_spot public.parking_spots%rowtype;
  v_spot_status text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select *
  into v_claim
  from public.claims as claims
  where claims.id = p_claim_id
  for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id
  for update;

  if not found then
    raise exception 'SPOT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_claim.seeker_id is distinct from v_uid
    and v_spot.owner_id is distinct from v_uid then
    raise exception 'NOT_HANDOFF_PARTICIPANT' using errcode = 'P0001';
  end if;

  if v_claim.status is distinct from 'active' then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_claim.status,
      v_spot.status,
      false;
    return;
  end if;

  if v_claim.expires_at > pg_catalog.now() then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_claim.status,
      v_spot.status,
      false;
    return;
  end if;

  if v_spot.expires_at > pg_catalog.now() then
    v_spot_status := 'available';
  else
    v_spot_status := 'expired';
  end if;

  update public.claims as claims
  set status = 'expired'
  where claims.id = v_claim.id;

  update public.parking_spots as spots
  set
    status = v_spot_status,
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id;

  return query
  select
    v_claim.id,
    v_spot.id,
    'expired'::text,
    v_spot_status,
    true;
end;
$$;

comment on function public.expire_claim_if_needed(uuid) is
  'Lazy-expire an active claim for seeker or spot owner. No credits.';

revoke all on function public.expire_claim_if_needed(uuid) from public;
revoke all on function public.expire_claim_if_needed(uuid) from anon;
grant execute on function public.expire_claim_if_needed(uuid) to authenticated;
