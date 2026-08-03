-- Atomic complete_claim RPC for Switch It MVP.
-- Transfers 1 credit seeker -> owner only on successful first completion.

create or replace function public.complete_claim(p_claim_id uuid)
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
  v_seeker public.profiles%rowtype;
  v_owner public.profiles%rowtype;
  v_profile_count integer;
  v_debit_count integer;
  v_credit_count integer;
  v_seeker_credits integer;
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

  -- Idempotent replay for an already-completed claim owned by this seeker.
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
    raise exception 'CLAIM_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  if v_claim.expires_at <= pg_catalog.now() then
    raise exception 'CLAIM_EXPIRED' using errcode = 'P0001';
  end if;

  select *
  into v_spot
  from public.parking_spots as spots
  where spots.id = v_claim.spot_id
  for update;

  if not found then
    raise exception 'SPOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  if v_spot.status is distinct from 'claimed' then
    raise exception 'SPOT_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Lock both related profiles in one deterministic query ordered by id.
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

comment on function public.complete_claim(uuid) is
  'Atomically complete a claim for auth.uid() (seeker only). Transfers 1 credit once.';

revoke all on function public.complete_claim(uuid) from public;
revoke all on function public.complete_claim(uuid) from anon;
grant execute on function public.complete_claim(uuid) to authenticated;
