-- Structured cancellation reasons for matched claims and publisher listings.
-- Credits still move only on complete_claim. No penalties.
--
-- Seeker cancel_claim:
--   Before live start (now < available_at, handoff_started_at is null):
--     claim cancelled, spot returns to available, original available_at kept,
--     listing deadline restored to available_at so another seeker may claim.
--   After live start (I'm leaving now or auto-start at available_at):
--     claim and listing both cancelled. No automatic re-list.
--
-- Publisher cancel_spot:
--   Unclaimed available listing: listing cancelled immediately.
--   Claimed handoff: claim + listing cancelled. Seeker released. No re-list.

alter table public.claims
  add column if not exists cancelled_by text,
  add column if not exists cancelled_reason text;

comment on column public.claims.cancelled_at is
  'When the claim was cancelled. Reused for analytics; no separate timestamp.';
comment on column public.claims.cancelled_by is
  'Who cancelled a matched claim: seeker or publisher. Null for historical rows.';
comment on column public.claims.cancelled_reason is
  'Machine-readable cancel reason. Null for historical rows. Never store UI labels.';

alter table public.claims
  drop constraint if exists claims_cancelled_by_allowed;
alter table public.claims
  add constraint claims_cancelled_by_allowed check (
    cancelled_by is null or cancelled_by in ('seeker', 'publisher')
  );

alter table public.claims
  drop constraint if exists claims_cancelled_reason_matches_actor;
alter table public.claims
  add constraint claims_cancelled_reason_matches_actor check (
    (cancelled_by is null and cancelled_reason is null)
    or (
      cancelled_by = 'seeker'
      and cancelled_reason in (
        'found_another_spot',
        'cant_make_it',
        'too_far',
        'other'
      )
    )
    or (
      cancelled_by = 'publisher'
      and cancelled_reason in (
        'someone_else_took_spot',
        'had_to_leave',
        'cant_complete_handoff',
        'other'
      )
    )
  );

alter table public.claims
  drop constraint if exists claims_cancelled_metadata_requires_timestamp;
alter table public.claims
  add constraint claims_cancelled_metadata_requires_timestamp check (
    cancelled_by is null or cancelled_at is not null
  );

alter table public.parking_spots
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_reason text;

comment on column public.parking_spots.cancelled_at is
  'When the publisher cancelled an unclaimed listing (or a matched listing they ended).';
comment on column public.parking_spots.cancelled_reason is
  'Publisher listing-cancel reason. Null when a seeker ended a started handoff (reason lives on the claim).';

alter table public.parking_spots
  drop constraint if exists parking_spots_cancelled_reason_allowed;
alter table public.parking_spots
  add constraint parking_spots_cancelled_reason_allowed check (
    cancelled_reason is null
    or cancelled_reason in (
      'someone_else_took_spot',
      'had_to_leave',
      'cant_complete_handoff',
      'other'
    )
  );

alter table public.parking_spots
  drop constraint if exists parking_spots_cancelled_fields_pair;
alter table public.parking_spots
  add constraint parking_spots_cancelled_fields_pair check (
    (cancelled_reason is null and cancelled_at is null)
    or (cancelled_reason is not null and cancelled_at is not null)
  );

-- Replace (uuid) overloads so a reason is required.
drop function if exists public.cancel_claim(uuid);
drop function if exists public.cancel_spot(uuid);

-- ---------------------------------------------------------------------------
-- cancel_claim: seeker release with a structured reason
-- ---------------------------------------------------------------------------
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
  v_reopen boolean;
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

  -- Canonical start vs release: lock first, then auto-start if due.
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
  v_reopen :=
    v_spot.handoff_started_at is null
    and v_now < v_spot.available_at;

  v_claim_status := 'cancelled';

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

  if v_reopen then
    v_spot_status := 'available';

    update public.parking_spots as spots
    set
      status = 'available',
      expires_at = spots.available_at,
      updated_at = v_now
    where spots.id = v_spot.id
      and spots.status = 'claimed';
  else
    v_spot_status := 'cancelled';

    update public.parking_spots as spots
    set
      status = 'cancelled',
      updated_at = v_now
    where spots.id = v_spot.id
      and spots.status = 'claimed';
  end if;

  if not found then
    raise exception 'INCONSISTENT_STATE' using errcode = 'P0001';
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
  'Seeker releases with a structured reason. Before live start and available_at: reopen listing (available_at unchanged). After start: cancel listing, no re-list. No credits.';

revoke all on function public.cancel_claim(uuid, text) from public;
revoke all on function public.cancel_claim(uuid, text) from anon;
grant execute on function public.cancel_claim(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_spot: publisher ends listing / matched handoff with a reason
-- ---------------------------------------------------------------------------
create or replace function public.cancel_spot(
  p_spot_id uuid,
  p_reason text
)
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
  v_now timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_reason is distinct from 'someone_else_took_spot'
    and p_reason is distinct from 'had_to_leave'
    and p_reason is distinct from 'cant_complete_handoff'
    and p_reason is distinct from 'other'
  then
    raise exception 'INVALID_CANCEL_REASON' using errcode = 'P0001';
  end if;

  v_now := pg_catalog.now();

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
      cancelled_at = v_now,
      cancelled_by = 'publisher',
      cancelled_reason = p_reason
    where claims.id = v_claim.id
      and claims.status = 'active';

    update public.parking_spots as spots
    set
      status = 'cancelled',
      cancelled_at = v_now,
      cancelled_reason = p_reason,
      updated_at = v_now
    where spots.id = v_spot.id
      and spots.status = 'claimed';

    return query
    select
      v_spot.id,
      'cancelled'::text,
      v_claim.id,
      false;
    return;
  end if;

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
    cancelled_at = v_now,
    cancelled_reason = p_reason,
    updated_at = v_now
  where spots.id = v_spot.id
    and spots.status = 'available';

  return query
  select
    v_spot.id,
    'cancelled'::text,
    null::uuid,
    false;
end;
$$;

comment on function public.cancel_spot(uuid, text) is
  'Owner cancels an unclaimed listing or a matched handoff with a structured reason. Seeker is released. No credits. No automatic re-list.';

revoke all on function public.cancel_spot(uuid, text) from public;
revoke all on function public.cancel_spot(uuid, text) from anon;
grant execute on function public.cancel_spot(uuid, text) to authenticated;
