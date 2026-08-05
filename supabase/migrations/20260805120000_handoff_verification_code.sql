-- Phase 3: secure in-person handoff verification codes.
-- Single migration keeps claim_spot, backfill, and complete_claim atomic so no
-- active claim can exist without a secret after deploy.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Private secret storage (no direct client access)
-- ---------------------------------------------------------------------------
create table public.claim_handoff_secrets (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  code_hash text not null,
  code_plain text not null,
  attempt_count integer not null default 0,
  locked_until timestamptz null,
  created_at timestamptz not null default now(),

  constraint claim_handoff_secrets_attempt_count_non_negative
    check (attempt_count >= 0)
);

comment on table public.claim_handoff_secrets is
  'Private handoff codes for active claims. Accessible only via SECURITY DEFINER RPCs.';

alter table public.claim_handoff_secrets enable row level security;

revoke all on table public.claim_handoff_secrets from public;
revoke all on table public.claim_handoff_secrets from anon;
revoke all on table public.claim_handoff_secrets from authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (not granted to clients)
-- ---------------------------------------------------------------------------
create or replace function public.generate_handoff_code_plain()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_bytes bytea;
  v_number integer;
begin
  v_bytes := extensions.gen_random_bytes(4);
  v_number := (
    get_byte(v_bytes, 0)::int * 65536
    + get_byte(v_bytes, 1)::int * 256
    + get_byte(v_bytes, 2)::int
  ) % 100000;

  return lpad(v_number::text, 5, '0');
end;
$$;

create or replace function public.create_claim_handoff_secret(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code_plain text;
begin
  if exists (
    select 1
    from public.claim_handoff_secrets as secrets
    where secrets.claim_id = p_claim_id
  ) then
    return;
  end if;

  v_code_plain := public.generate_handoff_code_plain();

  insert into public.claim_handoff_secrets (
    claim_id,
    code_hash,
    code_plain
  )
  values (
    p_claim_id,
    extensions.crypt(v_code_plain, extensions.gen_salt('bf', 8)),
    v_code_plain
  );
end;
$$;

revoke all on function public.generate_handoff_code_plain() from public;
revoke all on function public.generate_handoff_code_plain() from anon;
revoke all on function public.generate_handoff_code_plain() from authenticated;

revoke all on function public.create_claim_handoff_secret(uuid) from public;
revoke all on function public.create_claim_handoff_secret(uuid) from anon;
revoke all on function public.create_claim_handoff_secret(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- Backfill secrets for existing active claims (idempotent)
-- ---------------------------------------------------------------------------
do $$
declare
  v_claim record;
begin
  for v_claim in
    select claims.id
    from public.claims as claims
    inner join public.parking_spots as spots on spots.id = claims.spot_id
    where claims.status = 'active'
      and spots.status = 'claimed'
      and not exists (
        select 1
        from public.claim_handoff_secrets as secrets
        where secrets.claim_id = claims.id
      )
  loop
    perform public.create_claim_handoff_secret(v_claim.id);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_handoff_code (owner-only retrieval)
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

  if v_claim.expires_at <= pg_catalog.now() then
    return;
  end if;

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
  'Return the owner handoff code for an active claimed spot. Owner only.';

revoke all on function public.get_handoff_code(uuid) from public;
revoke all on function public.get_handoff_code(uuid) from anon;
grant execute on function public.get_handoff_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- claim_spot (create secret atomically with each new claim)
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
  v_claim_expires_at timestamptz;
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

  v_claim_expires_at := least(
    pg_catalog.now() + interval '15 minutes',
    v_spot.expires_at
  );

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
    v_claim_expires_at
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
    v_claim_expires_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_claim (verified completion with attempt throttling)
-- ---------------------------------------------------------------------------
drop function if exists public.complete_claim(uuid);

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

  if v_claim.expires_at <= pg_catalog.now() then
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
  'Seeker completes an active claim with a verified handoff code. Transfers 1 credit once.';

revoke all on function public.complete_claim(uuid, text) from public;
revoke all on function public.complete_claim(uuid, text) from anon;
grant execute on function public.complete_claim(uuid, text) to authenticated;
