-- Publisher-controlled handoff waiting: extend_handoff_wait.
-- Additive only. Does not shorten, backfill, or delete parking_spots rows.
-- New publishes set initial grace in application code (available_at + 2 minutes).
-- Hard cap for publisher extensions: available_at + 5 minutes, enforced only
-- inside extend_handoff_wait (no global CHECK — historical rows may predate it).

-- ---------------------------------------------------------------------------
-- extend_handoff_wait: publisher extends shared deadline by up to 2 minutes
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

  if v_spot.owner_id is distinct from v_uid then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  v_hard_cap := v_spot.available_at + interval '5 minutes';

  -- Terminal / wrong state: no mutation, no resurrection.
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

  -- Only during the handoff window (after planned departure, before current deadline).
  if pg_catalog.now() < v_spot.available_at then
    raise exception 'HANDOFF_NOT_READY' using errcode = 'P0001';
  end if;

  if v_spot.expires_at <= pg_catalog.now() then
    raise exception 'HANDOFF_UNAVAILABLE' using errcode = 'P0001';
  end if;

  -- Already at or past hard cap (including legacy longer windows): idempotent no-op.
  -- Never shorten existing deadlines on deploy or extend.
  if v_spot.expires_at >= v_hard_cap then
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

  -- Extend from current expires_at (not now()); never past hard cap.
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

  v_extended_seconds := greatest(
    0,
    floor(extract(epoch from (v_new_expires - v_spot.expires_at)))::integer
  );

  update public.parking_spots as spots
  set
    expires_at = v_new_expires,
    updated_at = pg_catalog.now()
  where spots.id = v_spot.id;

  update public.claims as claims
  set expires_at = v_new_expires
  where claims.id = v_claim.id;

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
  'Publisher extends shared handoff deadline by up to 2 minutes, never past available_at + 5 minutes. Legacy rows already beyond the cap are left unchanged. Aligns claim.expires_at. No credits.';

revoke all on function public.extend_handoff_wait(uuid) from public;
revoke all on function public.extend_handoff_wait(uuid) from anon;
grant execute on function public.extend_handoff_wait(uuid) to authenticated;
