-- Seeker release must reopen the publisher's listing while the handoff window
-- remains. The 20260819120000 cancellation_reasons migration incorrectly
-- cancelled the parking_spots row after handoff_started_at was set.
--
-- Restore phase-9A semantics (reopen before expires_at) while keeping
-- structured cancellation reasons. Publisher cancel_spot is unchanged.

create or replace function public.cancel_claim(
  p_claim_id uuid,
  p_reason text
)
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
  v_now timestamptz;
  v_claim_status text;
  v_spot_status text;
  v_pre_start_release boolean;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_reason is distinct from 'found_another_spot'
    and p_reason is distinct from 'cant_make_it'
    and p_reason is distinct from 'too_far'
    and p_reason is distinct from 'other'
  then
    raise exception 'INVALID_CANCEL_REASON' using errcode = 'P0001';
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

  perform public.auto_start_claimed_handoff_if_due(v_spot.id);

  select *
  into v_claim
  from public.claims as claims
  where claims.id = p_claim_id;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id;

  if v_claim.status = 'cancelled' or v_claim.status = 'expired' then
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

  if v_spot.status is distinct from 'claimed' then
    raise exception 'INCONSISTENT_STATE' using errcode = 'P0001';
  end if;

  v_now := pg_catalog.now();
  v_pre_start_release :=
    v_spot.handoff_started_at is null
    and v_now < v_spot.available_at;

  if v_spot.expires_at > v_now then
    v_claim_status := 'cancelled';
    v_spot_status := 'available';

    update public.claims as claims
    set
      status = 'cancelled',
      cancelled_at = v_now,
      cancelled_by = 'seeker',
      cancelled_reason = p_reason
    where claims.id = v_claim.id
      and claims.status = 'active';

    if not found then
      raise exception 'CLAIM_NOT_ACTIVE' using errcode = 'P0001';
    end if;

    if v_pre_start_release then
      update public.parking_spots as spots
      set
        status = 'available',
        expires_at = spots.available_at,
        updated_at = v_now
      where spots.id = v_spot.id
        and spots.status = 'claimed';
    else
      update public.parking_spots as spots
      set
        status = 'available',
        updated_at = v_now
      where spots.id = v_spot.id
        and spots.status = 'claimed';
    end if;

    if not found then
      raise exception 'INCONSISTENT_STATE' using errcode = 'P0001';
    end if;
  else
    v_claim_status := 'expired';
    v_spot_status := 'expired';

    update public.claims as claims
    set status = 'expired'
    where claims.id = v_claim.id
      and claims.status = 'active';

    if not found then
      raise exception 'CLAIM_NOT_ACTIVE' using errcode = 'P0001';
    end if;

    update public.parking_spots as spots
    set
      status = 'expired',
      updated_at = v_now
    where spots.id = v_spot.id
      and spots.status = 'claimed';

    if not found then
      raise exception 'INCONSISTENT_STATE' using errcode = 'P0001';
    end if;
  end if;

  return query
  select
    v_claim.id,
    v_spot.id,
    v_claim_status,
    v_spot_status,
    false;
end;
$$;

comment on function public.cancel_claim(uuid, text) is
  'Seeker releases with a structured reason. While expires_at remains: reopen listing (pre-start restores expires_at to available_at; live handoff keeps timing fields). After expiry: expire both. No credits.';

revoke all on function public.cancel_claim(uuid, text) from public;
revoke all on function public.cancel_claim(uuid, text) from anon;
grant execute on function public.cancel_claim(uuid, text) to authenticated;
