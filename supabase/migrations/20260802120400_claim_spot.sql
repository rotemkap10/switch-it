-- Atomic claim_spot RPC for Switch It MVP.
-- No credit transfer here; credits are checked only.

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

comment on function public.claim_spot(uuid) is
  'Atomically claim an available parking spot for auth.uid(). No credit transfer.';

revoke all on function public.claim_spot(uuid) from public;
revoke all on function public.claim_spot(uuid) from anon;
grant execute on function public.claim_spot(uuid) to authenticated;
