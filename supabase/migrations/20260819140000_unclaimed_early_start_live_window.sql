-- Unclaimed "I'm leaving now" becomes a live Now-style 3-minute listing.
-- Claimed early start is unchanged. Credits still move only on complete_claim.

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

  -- After the promised departure, unclaimed listings expire; claimed ones auto-start.
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

  -- Early, no seeker: convert to a live Now-style window. Listing stays available.
  if v_spot.status is not distinct from 'available' then
    v_started := v_now;
    v_expires := v_now + interval '3 minutes';

    update public.parking_spots as spots
    set
      handoff_started_at = v_started,
      expires_at = v_expires,
      updated_at = v_now
    where spots.id = v_spot.id
      and spots.status = 'available'
      and spots.handoff_started_at is null;

    if found then
      return query
      select
        v_spot.id,
        v_claim.id,
        v_started,
        v_expires,
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
  'Publisher starts the live 3-minute window now. Unclaimed: listing stays available (Now-style). Claimed: starts that handoff. Idempotent once started. No credits.';

revoke all on function public.start_handoff_now(uuid) from public;
revoke all on function public.start_handoff_now(uuid) from anon;
grant execute on function public.start_handoff_now(uuid) to authenticated;
