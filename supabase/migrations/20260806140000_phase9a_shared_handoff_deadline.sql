-- Phase 9A: one shared handoff deadline (Model 1).
-- claim.expires_at = spot.expires_at (no independent 15-minute claim hold).
-- Data backfill + overdue hardening for pre-existing rows.
-- Unclaimed spot expiry hardening.
-- Seeker cancel past deadline → expire (not reopen).
--
-- Migration history: this file was never applied to any linked Supabase
-- environment at authoring time (local-only), so it is safe to amend in place.
--
-- Schema conventions used (from 20260802110120_initial_schema):
--   claims.spot_id → parking_spots.id
--   claims.status text in (active, completed, cancelled, expired)
--   parking_spots.status text in (available, claimed, completed, cancelled, expired)
--   claims: claimed_at, expires_at, completed_at, cancelled_at (no expired_at column)
--   parking_spots: available_at, expires_at, updated_at (no completed_at/cancelled_at)
--   Expiry RPCs set status = 'expired' only; they do not write completed_at/cancelled_at
--   Unique partial indexes: one active claim per spot / seeker; one open spot per owner
--   No triggers on claims or parking_spots

-- ---------------------------------------------------------------------------
-- DATA: lock writers, diagnose, harden overdue rows, align active deadlines
-- Runs before function replacement so commit publishes functions + data together.
-- ---------------------------------------------------------------------------
lock table public.parking_spots, public.claims in share row exclusive mode;

do $$
declare
  v_claimed_without_active integer;
  v_active_on_completed_or_cancelled integer;
  v_active_on_available integer;
  v_active_on_expired_future integer;
begin
  -- Ambiguous / corruption: claimed spot with no active claim.
  select count(*)::integer
  into v_claimed_without_active
  from public.parking_spots as spots
  where spots.status = 'claimed'
    and not exists (
      select 1
      from public.claims as claims
      where claims.spot_id = spots.id
        and claims.status = 'active'
    );

  -- Active claim on a terminal non-expired spot (never auto-rewrite).
  select count(*)::integer
  into v_active_on_completed_or_cancelled
  from public.claims as claims
  inner join public.parking_spots as spots on spots.id = claims.spot_id
  where claims.status = 'active'
    and spots.status in ('completed', 'cancelled');

  -- Active claim while spot is available (not explained by old least(now+15, spot) model).
  select count(*)::integer
  into v_active_on_available
  from public.claims as claims
  inner join public.parking_spots as spots on spots.id = claims.spot_id
  where claims.status = 'active'
    and spots.status = 'available';

  -- Spot already marked expired but expires_at still in the future — ambiguous.
  select count(*)::integer
  into v_active_on_expired_future
  from public.claims as claims
  inner join public.parking_spots as spots on spots.id = claims.spot_id
  where claims.status = 'active'
    and spots.status = 'expired'
    and spots.expires_at > pg_catalog.now();

  if v_claimed_without_active > 0
    or v_active_on_completed_or_cancelled > 0
    or v_active_on_available > 0
    or v_active_on_expired_future > 0 then
    raise exception
      'PHASE9A_INCONSISTENT_DATA claimed_without_active=% active_on_completed_or_cancelled=% active_on_available=% active_on_expired_future=%',
      v_claimed_without_active,
      v_active_on_completed_or_cancelled,
      v_active_on_available,
      v_active_on_expired_future
      using errcode = 'P0001';
  end if;
end;
$$;

-- Overdue active claims: expire claim + spot (never completed/cancelled).
-- Schema has no expired_at; status='expired' only. Preserve completed_at/cancelled_at.
update public.claims as claims
set status = 'expired'
from public.parking_spots as spots
where claims.spot_id = spots.id
  and claims.status = 'active'
  and spots.expires_at <= pg_catalog.now()
  and spots.status not in ('completed', 'cancelled');

update public.parking_spots as spots
set
  status = 'expired',
  updated_at = pg_catalog.now()
where spots.expires_at <= pg_catalog.now()
  and spots.status = 'claimed'
  and not exists (
    select 1
    from public.claims as claims
    where claims.spot_id = spots.id
      and claims.status = 'active'
  );

-- Active claim left on an already-expired spot (expires_at <= now): expire claim only.
update public.claims as claims
set status = 'expired'
from public.parking_spots as spots
where claims.spot_id = spots.id
  and claims.status = 'active'
  and spots.status = 'expired'
  and spots.expires_at <= pg_catalog.now();

-- Overdue unclaimed available spots.
update public.parking_spots as spots
set
  status = 'expired',
  updated_at = pg_catalog.now()
where spots.status = 'available'
  and spots.expires_at <= pg_catalog.now()
  and not exists (
    select 1
    from public.claims as claims
    where claims.spot_id = spots.id
      and claims.status = 'active'
  );

-- Align active non-overdue claims to the shared spot deadline.
-- Fixes earlier *and* later mismatches; preserves claimed_at and spot timestamps.
update public.claims as claims
set expires_at = spots.expires_at
from public.parking_spots as spots
where claims.spot_id = spots.id
  and claims.status = 'active'
  and spots.expires_at > pg_catalog.now()
  and claims.expires_at is distinct from spots.expires_at;

-- ---------------------------------------------------------------------------
-- claim_spot: claim deadline equals spot.expires_at
-- ---------------------------------------------------------------------------
create or replace function public.claim_spot(p_spot_id uuid)
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
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
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

comment on function public.claim_spot(uuid) is
  'Atomic claim. claim.expires_at = spot.expires_at (shared 5-min handoff window). No credit hold.';

revoke all on function public.claim_spot(uuid) from public;
revoke all on function public.claim_spot(uuid) from anon;
grant execute on function public.claim_spot(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- cancel_claim: reopen before deadline; expire at/after deadline
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
  v_claim_status text;
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

  if v_claim.status = 'expired' then
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

  -- Shared deadline: now < expires_at → reopen; else expire both.
  if v_spot.expires_at > pg_catalog.now() then
    v_claim_status := 'cancelled';
    v_spot_status := 'available';

    update public.claims as claims
    set
      status = 'cancelled',
      cancelled_at = pg_catalog.now()
    where claims.id = v_claim.id;

    update public.parking_spots as spots
    set
      status = 'available',
      updated_at = pg_catalog.now()
    where spots.id = v_spot.id;
    -- available_at / expires_at intentionally unchanged
  else
    v_claim_status := 'expired';
    v_spot_status := 'expired';

    update public.claims as claims
    set status = 'expired'
    where claims.id = v_claim.id;

    update public.parking_spots as spots
    set
      status = 'expired',
      updated_at = pg_catalog.now()
    where spots.id = v_spot.id;
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

comment on function public.cancel_claim(uuid) is
  'Seeker cancels. Before deadline: reopen spot (timestamps kept). At/after: expire both. No credits.';

revoke all on function public.cancel_claim(uuid) from public;
revoke all on function public.cancel_claim(uuid) from anon;
grant execute on function public.cancel_claim(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_claim_if_needed: shared deadline → expire claim + spot
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

  -- Use the shared spot deadline (authoritative). Claim expires_at mirrors it.
  if v_spot.expires_at > pg_catalog.now() then
    return query
    select
      v_claim.id,
      v_spot.id,
      v_claim.status,
      v_spot.status,
      false;
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

  return query
  select
    v_claim.id,
    v_spot.id,
    'expired'::text,
    'expired'::text,
    true;
end;
$$;

comment on function public.expire_claim_if_needed(uuid) is
  'Lazy-expire active claim + spot at shared deadline. Never expires completed. No credits.';

revoke all on function public.expire_claim_if_needed(uuid) from public;
revoke all on function public.expire_claim_if_needed(uuid) from anon;
grant execute on function public.expire_claim_if_needed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- expire_spot_if_needed: unclaimed available spot past deadline
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
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
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

  if v_spot.status is distinct from 'available' then
    return query
    select
      v_spot.id,
      v_spot.status,
      false;
    return;
  end if;

  if v_spot.expires_at > pg_catalog.now() then
    return query
    select
      v_spot.id,
      v_spot.status,
      false;
    return;
  end if;

  -- Refuse if an active claim appeared (should be claimed status, but race-safe).
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
    updated_at = pg_catalog.now()
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
  'Lazy-expire an unclaimed available spot past expires_at. Owner-only. No credits.';

revoke all on function public.expire_spot_if_needed(uuid) from public;
revoke all on function public.expire_spot_if_needed(uuid) from anon;
grant execute on function public.expire_spot_if_needed(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_handoff_counterpart_vehicle: shared spot deadline only
-- ---------------------------------------------------------------------------
create or replace function public.get_handoff_counterpart_vehicle(p_claim_id uuid)
returns table (
  vehicle_license_plate text,
  vehicle_make text,
  vehicle_model text,
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

  -- Shared handoff deadline (claim.expires_at is aligned to spot.expires_at).
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
    profiles.license_plate,
    profiles.vehicle_make,
    profiles.vehicle_model,
    profiles.vehicle_color,
    profiles.vehicle_type
  from public.profiles as profiles
  where profiles.id = v_counterpart_id;
end;
$$;

comment on function public.get_handoff_counterpart_vehicle(uuid) is
  'Opposite participant vehicle for an active claim before shared spot.expires_at. No profile ids.';

revoke all on function public.get_handoff_counterpart_vehicle(uuid) from public;
revoke all on function public.get_handoff_counterpart_vehicle(uuid) from anon;
grant execute on function public.get_handoff_counterpart_vehicle(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_handoff_code: shared spot deadline only
-- ---------------------------------------------------------------------------
create or replace function public.get_handoff_code(p_claim_id uuid)
returns table (
  handoff_code text
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

  if v_spot.owner_id is distinct from v_uid then
    return;
  end if;

  if v_claim.status is distinct from 'active' then
    return;
  end if;

  if v_spot.status is distinct from 'claimed' then
    return;
  end if;

  -- Shared handoff deadline (claim.expires_at is aligned to spot.expires_at).
  if v_spot.expires_at <= pg_catalog.now() then
    return;
  end if;

  select *
  into v_secret
  from public.claim_handoff_secrets as secrets
  where secrets.claim_id = v_claim.id;

  if not found then
    return;
  end if;

  return query
  select v_secret.code_plain;
end;
$$;

comment on function public.get_handoff_code(uuid) is
  'Owner-only handoff code for an active claim before shared spot.expires_at.';

revoke all on function public.get_handoff_code(uuid) from public;
revoke all on function public.get_handoff_code(uuid) from anon;
grant execute on function public.get_handoff_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_claim: shared spot.expires_at deadline; one-credit invariant unchanged
-- ---------------------------------------------------------------------------
create or replace function public.complete_claim(
  p_claim_id uuid,
  p_handoff_code text
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
  v_submitted_code text;
  v_next_attempt_count integer;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  v_submitted_code := pg_catalog.btrim(p_handoff_code);

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

  -- Shared handoff deadline (claim.expires_at is aligned to spot.expires_at).
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

  if extensions.crypt(v_submitted_code, v_secret.code_hash) <> v_secret.code_hash then
    v_next_attempt_count := v_secret.attempt_count + 1;

    update public.claim_handoff_secrets as secrets
    set
      attempt_count = v_next_attempt_count,
      locked_until = case
        when v_next_attempt_count >= 5 then pg_catalog.now() + interval '2 minutes'
        else secrets.locked_until
      end
    where secrets.claim_id = v_claim.id;

    raise exception 'INVALID_HANDOFF_CODE' using errcode = 'P0001';
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

  return query
  select
    v_claim.id,
    v_spot.id,
    v_seeker_credits,
    false;
end;
$$;

comment on function public.complete_claim(uuid, text) is
  'Seeker completes an active claim with a verified handoff code before shared spot.expires_at. Transfers 1 credit once.';

revoke all on function public.complete_claim(uuid, text) from public;
revoke all on function public.complete_claim(uuid, text) from anon;
grant execute on function public.complete_claim(uuid, text) to authenticated;
