-- Estimated departure is a promise: claimed handoffs auto-start at available_at.
-- "I'm leaving now" only starts earlier. The +3 minutes are the live handoff
-- window itself, not a grace period to press the button after departure.
-- Unclaimed spots are not auto-started. Credits still move only on complete_claim.

comment on column public.parking_spots.available_at is
  'Promised departure chosen at publish. Claimed handoffs auto-start at this time.';
comment on column public.parking_spots.handoff_started_at is
  'Canonical live-handoff start: Now publish, early I''m leaving now, or auto-start at available_at.';
comment on column public.parking_spots.expires_at is
  'Authoritative deadline. Before start: available_at + 3 minutes (listing remainder if unclaimed). After start: start + 3 minutes, or +5 after one extension.';

-- ---------------------------------------------------------------------------
-- Internal helper: start a claimed, unstarted handoff at available_at.
-- Not granted to authenticated — only other SECURITY DEFINER RPCs call it.
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

  -- Window already elapsed without a start: leave for expire_claim_if_needed.
  if v_spot.expires_at <= v_now then
    return false;
  end if;

  -- Canonical start is the promised departure, not the read clock.
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
  'Starts a claimed unstarted handoff at available_at when that time has arrived. Never overwrites an early start. No credits. Internal — not granted to authenticated.';

revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from public;
revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from anon;
revoke all on function public.auto_start_claimed_handoff_if_due(uuid) from authenticated;

-- Legacy in-flight claimed spots already past the estimate, still waiting for
-- I'm leaving now: treat available_at as the start. Do not start unclaimed spots.
-- Do not rewrite expires_at (already the remaining 3-minute window).
update public.parking_spots as spots
set
  handoff_started_at = spots.available_at,
  updated_at = pg_catalog.now()
where spots.status = 'claimed'
  and spots.handoff_started_at is null
  and spots.available_at <= pg_catalog.now()
  and spots.expires_at > pg_catalog.now();

update public.claims as claims
set expires_at = spots.expires_at
from public.parking_spots as spots
where claims.spot_id = spots.id
  and claims.status = 'active'
  and claims.expires_at is distinct from spots.expires_at;

-- ---------------------------------------------------------------------------
-- expire_claim_if_needed: auto-start due claimed handoffs, then expire if due
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
  v_auto_started boolean;
  v_final_claim_status text;
  v_final_spot_status text;
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

  v_auto_started := public.auto_start_claimed_handoff_if_due(v_spot.id);

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_spot.id;

  select *
  into v_claim
  from public.claims as claims
  where claims.id = v_claim.id;

  if v_spot.expires_at > pg_catalog.now() then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_claim.status,
      v_spot.status,
      v_auto_started;
    return;
  end if;

  update public.claims as claims
  set status = 'expired'
  where claims.id = v_claim.id;

  update public.parking_spots as spots
  set
    status = 'expired',
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id
    and spots.status not in ('completed', 'cancelled', 'expired');

  select claims.status
  into v_final_claim_status
  from public.claims as claims
  where claims.id = v_claim.id;

  select spots.status
  into v_final_spot_status
  from public.parking_spots as spots
  where spots.id = v_spot.id;

  return query
  select
    v_claim.id,
    v_spot.id,
    v_final_claim_status,
    v_final_spot_status,
    true;
end;
$$;

comment on function public.expire_claim_if_needed(uuid) is
  'Auto-starts a due claimed handoff at available_at, then lazy-expires at the shared deadline. Returns actual persisted statuses. Never expires completed. No credits.';

revoke all on function public.expire_claim_if_needed(uuid) from public;
revoke all on function public.expire_claim_if_needed(uuid) from anon;
grant execute on function public.expire_claim_if_needed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- start_handoff_now: early start only. After available_at, claimed spots
-- auto-start at available_at (idempotent). Unclaimed spots cannot start late.
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

  -- Already started: idempotent. Never reset or extend.
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

  if v_now >= v_spot.expires_at then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- After the promised departure: claimed → auto-start at available_at.
  -- Unclaimed → no late start (listing remainder is not a live handoff).
  if v_now >= v_spot.available_at then
    if v_spot.status is distinct from 'claimed' then
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

  -- Early start before the estimate.
  v_started := v_now;
  v_expires := v_now + interval '3 minutes';

  update public.parking_spots as spots
  set
    handoff_started_at = v_started,
    expires_at = v_expires,
    updated_at = v_now
  where spots.id = v_spot.id
    and spots.handoff_started_at is null;

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
  'Publisher starts the live 3-minute handoff early. Idempotent once started. After available_at, claimed spots auto-start at available_at instead of now(). Unclaimed spots cannot start late. No credits.';

revoke all on function public.start_handoff_now(uuid) from public;
revoke all on function public.start_handoff_now(uuid) from anon;
grant execute on function public.start_handoff_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- extend_handoff_wait: auto-start if due, then one +2 extension from actual start
-- ---------------------------------------------------------------------------
create or replace function public.extend_handoff_wait(p_claim_id uuid)
returns table (
  claim_id uuid,
  spot_id uuid,
  expires_at timestamptz,
  hard_cap_at timestamptz,
  extended_by_seconds integer,
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
  v_hard_cap timestamptz;
  v_new_expires timestamptz;
  v_extended_seconds integer;
  v_now timestamptz;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_now := pg_catalog.now();

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

  if v_spot.owner_id is distinct from v_uid then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if v_spot.handoff_started_at is null then
    perform public.auto_start_claimed_handoff_if_due(v_spot.id);

    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = v_claim.spot_id;
  end if;

  if v_spot.handoff_started_at is null then
    raise exception 'HANDOFF_NOT_READY' using errcode = 'P0001';
  end if;

  v_hard_cap := v_spot.handoff_started_at + interval '5 minutes';

  if v_claim.status is distinct from 'active'
    or v_spot.status is distinct from 'claimed' then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_spot.expires_at,
      v_hard_cap,
      0,
      false;
    return;
  end if;

  if v_spot.expires_at <= v_now then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Already used, or already at/past hard cap: idempotent, never shorten.
  if v_spot.handoff_extension_used_at is not null
    or v_spot.expires_at >= v_hard_cap then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_spot.expires_at,
      v_hard_cap,
      0,
      false;
    return;
  end if;

  v_new_expires := least(
    v_spot.expires_at + interval '2 minutes',
    v_hard_cap
  );

  if v_new_expires <= v_spot.expires_at then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_spot.expires_at,
      v_hard_cap,
      0,
      false;
    return;
  end if;

  update public.parking_spots as spots
  set
    expires_at = v_new_expires,
    handoff_extension_used_at = v_now,
    updated_at = v_now
  where spots.id = v_spot.id
    and spots.handoff_extension_used_at is null
    and spots.handoff_started_at is not null;

  if not found then
    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = v_claim.spot_id;

    return query
    select
      v_claim.id,
      v_spot.id,
      v_spot.expires_at,
      v_hard_cap,
      0,
      false;
    return;
  end if;

  update public.claims as claims
  set expires_at = v_new_expires
  where claims.id = v_claim.id;

  v_extended_seconds := greatest(
    0,
    floor(extract(epoch from (v_new_expires - v_spot.expires_at)))::integer
  );

  return query
  select
    v_claim.id,
    v_spot.id,
    v_new_expires,
    v_hard_cap,
    v_extended_seconds,
    true;
end;
$$;

comment on function public.extend_handoff_wait(uuid) is
  'Publisher extends the live handoff once by up to 2 minutes, never past handoff_started_at + 5 minutes. Auto-starts a due claimed handoff first. Rejected before start. Aligns claim.expires_at. No credits.';

revoke all on function public.extend_handoff_wait(uuid) from public;
revoke all on function public.extend_handoff_wait(uuid) from anon;
grant execute on function public.extend_handoff_wait(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_claim: auto-start if due, then publisher verifies seeker plate
-- ---------------------------------------------------------------------------
create or replace function public.complete_claim(
  p_claim_id uuid,
  p_plate_suffix text
)
returns table (
  claim_id uuid,
  spot_id uuid,
  seeker_credits integer,
  already_completed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_claim public.claims%rowtype;
  v_spot public.parking_spots%rowtype;
  v_secret public.claim_handoff_secrets%rowtype;
  v_seeker public.profiles%rowtype;
  v_owner public.profiles%rowtype;
  v_profile_count integer;
  v_debit_count integer;
  v_credit_count integer;
  v_seeker_credits integer;
  v_seeker_digits text;
  v_expected_suffix text;
  v_submitted_suffix text;
  v_next_attempt_count integer;
  v_attempts_remaining integer;
  v_max_attempts integer := 3;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_submitted_suffix := public.normalize_license_plate_digits(p_plate_suffix);

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
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.owner_id is distinct from v_uid then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  if v_claim.status = 'completed' then
    select count(*)
    into v_debit_count
    from public.credit_transactions as tx
    where tx.claim_id = v_claim.id
      and tx.spot_id = v_claim.spot_id
      and tx.user_id = v_claim.seeker_id
      and tx.transaction_type = 'handoff_debit'
      and tx.amount = -1;

    select count(*)
    into v_credit_count
    from public.credit_transactions as tx
    where tx.claim_id = v_claim.id
      and tx.spot_id = v_claim.spot_id
      and tx.user_id = v_spot.owner_id
      and tx.transaction_type = 'handoff_credit'
      and tx.amount = 1;

    if v_debit_count is distinct from 1 or v_credit_count is distinct from 1 then
      raise exception 'INCONSISTENT_COMPLETION_STATE' using errcode = 'P0001';
    end if;

    select profiles.credits
    into v_seeker_credits
    from public.profiles as profiles
    where profiles.id = v_claim.seeker_id;

    if v_seeker_credits is null then
      raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
    end if;

    return query
    select
      v_claim.id,
      v_claim.spot_id,
      v_seeker_credits,
      true;
    return;
  end if;

  if v_claim.status is distinct from 'active' then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'claimed' then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.handoff_started_at is null then
    perform public.auto_start_claimed_handoff_if_due(v_spot.id);

    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = v_claim.spot_id;
  end if;

  if v_spot.handoff_started_at is null then
    raise exception 'HANDOFF_NOT_STARTED' using errcode = 'P0001';
  end if;

  if v_spot.expires_at <= pg_catalog.now() then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  select *
  into v_secret
  from public.claim_handoff_secrets as secrets
  where secrets.claim_id = v_claim.id
  for update;

  if not found then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_secret.locked_until is not null
    and v_secret.locked_until > pg_catalog.now() then
    raise exception 'HANDOFF_TEMPORARILY_LOCKED' using errcode = 'P0001';
  end if;

  if v_secret.locked_until is not null
    and v_secret.locked_until <= pg_catalog.now() then
    update public.claim_handoff_secrets as secrets
    set
      attempt_count = 0,
      locked_until = null
    where secrets.claim_id = v_claim.id;

    v_secret.attempt_count := 0;
    v_secret.locked_until := null;
  end if;

  -- Current active seeker's stored plate — never returned to the publisher.
  select public.normalize_license_plate_digits(profiles.license_plate)
  into v_seeker_digits
  from public.profiles as profiles
  where profiles.id = v_claim.seeker_id;

  if v_seeker_digits is null or char_length(v_seeker_digits) < 2 then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_expected_suffix := right(v_seeker_digits, 2);

  if char_length(v_submitted_suffix) is distinct from 2
    or v_submitted_suffix is distinct from v_expected_suffix then
    v_next_attempt_count := v_secret.attempt_count + 1;
    v_attempts_remaining := v_max_attempts - v_next_attempt_count;

    update public.claim_handoff_secrets as secrets
    set
      attempt_count = v_next_attempt_count,
      locked_until = case
        when v_next_attempt_count >= v_max_attempts
          then pg_catalog.now() + interval '2 minutes'
        else secrets.locked_until
      end
    where secrets.claim_id = v_claim.id;

    if v_next_attempt_count >= v_max_attempts then
      raise exception 'HANDOFF_TEMPORARILY_LOCKED' using errcode = 'P0001';
    end if;

    raise exception 'INVALID_PLATE_DIGITS'
      using errcode = 'P0001',
            detail = 'attempts_remaining=' || v_attempts_remaining::text;
  end if;

  perform profiles.id
  from public.profiles as profiles
  where profiles.id in (v_claim.seeker_id, v_spot.owner_id)
  order by profiles.id
  for update;

  select count(*)
  into v_profile_count
  from public.profiles as profiles
  where profiles.id in (v_claim.seeker_id, v_spot.owner_id);

  if v_profile_count is distinct from 2 then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select *
  into v_seeker
  from public.profiles as profiles
  where profiles.id = v_claim.seeker_id;

  select *
  into v_owner
  from public.profiles as profiles
  where profiles.id = v_spot.owner_id;

  if v_seeker.id is null or v_owner.id is null then
    raise exception 'PROFILE_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_seeker.credits < 1 then
    raise exception 'INSUFFICIENT_CREDITS' using errcode = 'P0001';
  end if;

  update public.claims as claims
  set
    status = 'completed',
    completed_at = pg_catalog.now()
  where claims.id = v_claim.id;

  update public.parking_spots as spots
  set
    status = 'completed',
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id;

  update public.profiles as profiles
  set
    credits = profiles.credits - 1,
    updated_at = pg_catalog.now()
  where profiles.id = v_seeker.id
  returning profiles.credits into v_seeker_credits;

  update public.profiles as profiles
  set
    credits = profiles.credits + 1,
    updated_at = pg_catalog.now()
  where profiles.id = v_owner.id;

  insert into public.credit_transactions (
    user_id,
    spot_id,
    claim_id,
    amount,
    transaction_type
  )
  values
    (v_seeker.id, v_spot.id, v_claim.id, -1, 'handoff_debit'),
    (v_owner.id, v_spot.id, v_claim.id, 1, 'handoff_credit');

  update public.claim_handoff_secrets as secrets
  set
    attempt_count = 0,
    locked_until = null
  where secrets.claim_id = v_claim.id;

  return query
  select
    v_claim.id,
    v_spot.id,
    v_seeker_credits,
    false;
end;
$$;

comment on function public.complete_claim(uuid, text) is
  'Publisher completes an active claim by matching the current seeker''s last two plate digits. Auto-starts a due claimed handoff first. Transfers 1 credit once. Rejected before start. No reservation.';

revoke all on function public.complete_claim(uuid, text) from public;
revoke all on function public.complete_claim(uuid, text) from anon;
grant execute on function public.complete_claim(uuid, text) to authenticated;
