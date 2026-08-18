-- Estimated departure vs actual "I'm leaving now" handoff start.
-- available_at remains the publisher's estimate.
-- handoff_started_at is the real start (NULL until Now publish or the button).
-- expires_at stays the authoritative deadline (confirmation window, then live window).
-- Does not shorten existing live deadlines.

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
alter table public.parking_spots
  add column if not exists handoff_started_at timestamptz,
  add column if not exists handoff_extension_used_at timestamptz;

comment on column public.parking_spots.available_at is
  'Estimated departure chosen at publish. Not the live handoff start.';
comment on column public.parking_spots.handoff_started_at is
  'Actual I''m leaving now timestamp. NULL until the publisher starts (or published Now).';
comment on column public.parking_spots.handoff_extension_used_at is
  'Set when the single +2 minute live-handoff extension is used.';
comment on column public.parking_spots.expires_at is
  'Authoritative deadline: confirmation window before start, live handoff after start.';

-- Early "I'm leaving now" can make expires_at < available_at.
alter table public.parking_spots
  drop constraint if exists parking_spots_expires_after_available;

-- Legacy: already at/past estimated departure → treat as started without
-- shortening expires_at. Mark extension used when they already have more
-- than the new 3-minute initial live window.
update public.parking_spots as spots
set
  handoff_started_at = spots.available_at,
  handoff_extension_used_at = case
    when spots.expires_at > spots.available_at + interval '3 minutes'
      then coalesce(spots.updated_at, spots.available_at)
    else null
  end
where spots.status in ('available', 'claimed')
  and spots.handoff_started_at is null
  and spots.available_at <= pg_catalog.now();

-- Future unpublished-start spots: lateness window is +3 minutes (was +2).
-- Never shorten.
update public.parking_spots as spots
set expires_at = spots.available_at + interval '3 minutes'
where spots.status in ('available', 'claimed')
  and spots.handoff_started_at is null
  and spots.available_at > pg_catalog.now()
  and spots.expires_at < spots.available_at + interval '3 minutes';

-- Keep active claims aligned with the spot deadline.
update public.claims as claims
set expires_at = spots.expires_at
from public.parking_spots as spots
where claims.spot_id = spots.id
  and claims.status = 'active'
  and claims.expires_at is distinct from spots.expires_at;

-- ---------------------------------------------------------------------------
-- start_handoff_now: publisher is actually ready to leave
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
  v_lateness_deadline timestamptz;
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

  v_lateness_deadline := v_spot.available_at + interval '3 minutes';
  if v_now >= v_lateness_deadline then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

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
  'Publisher starts the live 3-minute handoff. Idempotent once handoff_started_at is set. Allowed from publish until available_at + 3 minutes. No credits.';

revoke all on function public.start_handoff_now(uuid) from public;
revoke all on function public.start_handoff_now(uuid) from anon;
grant execute on function public.start_handoff_now(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- extend_handoff_wait: one +2 minute extension after actual start
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
  'Publisher extends the live handoff once by up to 2 minutes, never past handoff_started_at + 5 minutes. Rejected before I''m leaving now. Aligns claim.expires_at. No credits.';

-- ---------------------------------------------------------------------------
-- complete_claim: require actual handoff start
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
  v_owner_digits text;
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

  if v_claim.seeker_id is distinct from v_uid then
    raise exception 'NOT_SEEKER' using errcode = 'P0001';
  end if;

  if v_claim.status = 'completed' then
    select *
    into v_spot
    from public.parking_spots as spots
    where spots.id = v_claim.spot_id;

    if not found then
      raise exception 'INCONSISTENT_COMPLETION_STATE' using errcode = 'P0001';
    end if;

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
    where profiles.id = v_uid;

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

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id
  for update;

  if not found then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'claimed' then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
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

  select public.normalize_license_plate_digits(profiles.license_plate)
  into v_owner_digits
  from public.profiles as profiles
  where profiles.id = v_spot.owner_id;

  if v_owner_digits is null or char_length(v_owner_digits) < 2 then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  v_expected_suffix := right(v_owner_digits, 2);

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
  'Seeker completes an active claim after I''m leaving now by matching the last two plate digits. Transfers 1 credit once. Rejected before handoff_started_at.';

revoke all on function public.complete_claim(uuid, text) from public;
revoke all on function public.complete_claim(uuid, text) from anon;
grant execute on function public.complete_claim(uuid, text) to authenticated;

revoke all on function public.extend_handoff_wait(uuid) from public;
revoke all on function public.extend_handoff_wait(uuid) from anon;
grant execute on function public.extend_handoff_wait(uuid) to authenticated;
