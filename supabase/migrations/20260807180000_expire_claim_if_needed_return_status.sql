-- Phase 11 follow-up: expire_claim_if_needed return-value correctness only.
-- After conditional mutations, return the actual persisted claim/spot statuses.
-- Does not change when expiry runs, cancellation, credits, or RLS.

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

  -- Return actual persisted statuses (spot UPDATE may affect zero rows).
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
  'Lazy-expire active claim + spot at shared deadline. Returns actual persisted statuses. Never expires completed. No credits.';

revoke all on function public.expire_claim_if_needed(uuid) from public;
revoke all on function public.expire_claim_if_needed(uuid) from anon;
grant execute on function public.expire_claim_if_needed(uuid) to authenticated;
