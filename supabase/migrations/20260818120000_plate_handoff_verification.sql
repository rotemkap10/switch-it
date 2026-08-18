-- Replace spoken 5-digit handoff codes with last-two-digit license-plate
-- verification. Spoken-code storage stays in claim_handoff_secrets (attempt
-- count + lock) but is no longer returned to clients.
--
-- Counterpart RPC returns a masked plate only. Uploaded photos are omitted.

-- ---------------------------------------------------------------------------
-- Plate helpers (internal; not granted to clients)
-- ---------------------------------------------------------------------------
create or replace function public.normalize_license_plate_digits(p_plate text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select regexp_replace(coalesce(p_plate, ''), '[^0-9]', '', 'g');
$$;

create or replace function public.format_license_plate_display(p_plate text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  d text := public.normalize_license_plate_digits(p_plate);
  len integer := char_length(d);
  rest text;
  result text := '';
  chunk text;
begin
  if len = 0 then
    return '';
  end if;
  if len = 7 then
    return substr(d, 1, 2) || '-' || substr(d, 3, 3) || '-' || substr(d, 6, 2);
  end if;
  if len = 8 then
    return substr(d, 1, 3) || '-' || substr(d, 4, 2) || '-' || substr(d, 6, 3);
  end if;
  if len = 6 then
    return substr(d, 1, 3) || '-' || substr(d, 4, 3);
  end if;
  if len = 5 then
    return substr(d, 1, 2) || '-' || substr(d, 3, 3);
  end if;

  rest := d;
  while char_length(rest) > 3 loop
    chunk := substr(rest, char_length(rest) - 2, 3);
    if result = '' then
      result := chunk;
    else
      result := chunk || '-' || result;
    end if;
    rest := substr(rest, 1, char_length(rest) - 3);
  end loop;
  if rest <> '' then
    if result = '' then
      result := rest;
    else
      result := rest || '-' || result;
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.mask_license_plate_for_handoff(p_plate text)
returns text
language plpgsql
immutable
parallel safe
set search_path = ''
as $$
declare
  d text := public.normalize_license_plate_digits(p_plate);
  formatted text;
  masked text := '';
  remaining integer := 2;
  i integer;
  ch text;
begin
  if char_length(d) < 2 then
    return null;
  end if;

  formatted := public.format_license_plate_display(d);
  for i in reverse char_length(formatted)..1 loop
    ch := substr(formatted, i, 1);
    if remaining > 0 and ch ~ '[0-9]' then
      masked := '*' || masked;
      remaining := remaining - 1;
    else
      masked := ch || masked;
    end if;
  end loop;

  return masked;
end;
$$;

comment on function public.normalize_license_plate_digits(text) is
  'Internal: strip a license plate to digits only.';
comment on function public.format_license_plate_display(text) is
  'Internal: display grouping matching the web formatter (7-digit → 12-345-67).';
comment on function public.mask_license_plate_for_handoff(text) is
  'Internal: format a plate with the last two digits replaced by **.';

revoke all on function public.normalize_license_plate_digits(text) from public;
revoke all on function public.normalize_license_plate_digits(text) from anon;
revoke all on function public.normalize_license_plate_digits(text) from authenticated;
revoke all on function public.format_license_plate_display(text) from public;
revoke all on function public.format_license_plate_display(text) from anon;
revoke all on function public.format_license_plate_display(text) from authenticated;
revoke all on function public.mask_license_plate_for_handoff(text) from public;
revoke all on function public.mask_license_plate_for_handoff(text) from anon;
revoke all on function public.mask_license_plate_for_handoff(text) from authenticated;

-- ---------------------------------------------------------------------------
-- Counterpart vehicle: masked plate, no photo path, no full plate
-- ---------------------------------------------------------------------------
drop function if exists public.get_handoff_counterpart_vehicle(uuid);

create function public.get_handoff_counterpart_vehicle(p_claim_id uuid)
returns table (
  vehicle_license_plate_masked text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_color text,
  vehicle_type text
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
    public.mask_license_plate_for_handoff(profiles.license_plate),
    profiles.vehicle_make,
    profiles.vehicle_model,
    profiles.vehicle_year,
    profiles.vehicle_color,
    profiles.vehicle_type
  from public.profiles as profiles
  where profiles.id = v_counterpart_id;
end;
$$;

comment on function public.get_handoff_counterpart_vehicle(uuid) is
  'Opposite participant vehicle for an active claimed handoff. Returns a masked plate only (last two digits replaced). No photo path, full plate, or profile ids.';

revoke all on function public.get_handoff_counterpart_vehicle(uuid) from public;
revoke all on function public.get_handoff_counterpart_vehicle(uuid) from anon;
grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Spoken code retrieval is dormant (always empty)
-- ---------------------------------------------------------------------------
create or replace function public.get_handoff_code(p_claim_id uuid)
returns table (
  handoff_code text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Spoken handoff codes are no longer used. Keep the function for
  -- compatibility; never return code_plain.
  return;
end;
$$;

comment on function public.get_handoff_code(uuid) is
  'Dormant. Spoken handoff codes are no longer returned. Completion uses plate-suffix verification.';

revoke all on function public.get_handoff_code(uuid) from public;
revoke all on function public.get_handoff_code(uuid) from anon;
grant execute on function public.get_handoff_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_claim: last-two-digit plate verification (same atomic completion)
-- PostgreSQL cannot rename p_handoff_code via CREATE OR REPLACE, so drop the
-- exact (uuid, text) signature first. No other functions, views, or triggers
-- call this RPC; DROP without CASCADE is safe.
-- ---------------------------------------------------------------------------
drop function public.complete_claim(uuid, text);

create function public.complete_claim(
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
  'Seeker completes an active claim by matching the last two digits of the publisher license plate. Transfers 1 credit once. Attempts are persisted on claim_handoff_secrets (max 3, then 2-minute lock).';

revoke all on function public.complete_claim(uuid, text) from public;
revoke all on function public.complete_claim(uuid, text) from anon;
grant execute on function public.complete_claim(uuid, text) to authenticated;
