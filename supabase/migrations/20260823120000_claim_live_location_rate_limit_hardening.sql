-- Harden atomic live-location rate limiting:
-- 1. Use clock_timestamp() (wall clock) after FOR UPDATE waits, not transaction-start now().
-- 2. Strict sequence monotonicity: only incoming_sequence > stored_sequence may accept.
-- 3. Serialize first-row inserts by locking the claims row (deterministic; no insert race).
-- 4. Rate-limit seeker-location-status broadcasts (no GPS persistence required).

create table public.claim_live_status_throttle (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  updated_at timestamptz not null
);

comment on table public.claim_live_status_throttle is
  'Last accepted seeker-location-status broadcast time per claim. Service-role writes only.';

alter table public.claim_live_status_throttle enable row level security;

revoke all on table public.claim_live_status_throttle from public;
revoke all on table public.claim_live_status_throttle from anon;
revoke all on table public.claim_live_status_throttle from authenticated;

create or replace function public.upsert_claim_live_location(
  p_claim_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_heading_degrees double precision,
  p_sequence bigint,
  p_location_timestamp timestamptz
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_min_interval constant interval := interval '2 seconds';
  v_live public.claim_live_locations%rowtype;
begin
  -- Serialize all writers for this claim, including the first insert.
  perform 1
  from public.claims
  where id = p_claim_id
  for update;

  if not found then
    return 'stale_sequence';
  end if;

  v_now := pg_catalog.clock_timestamp();

  select *
  into v_live
  from public.claim_live_locations
  where claim_id = p_claim_id
  for update;

  if not found then
    insert into public.claim_live_locations (
      claim_id,
      latitude,
      longitude,
      accuracy_meters,
      heading_degrees,
      sequence,
      location_timestamp,
      updated_at
    )
    values (
      p_claim_id,
      p_latitude,
      p_longitude,
      p_accuracy_meters,
      p_heading_degrees,
      p_sequence,
      p_location_timestamp,
      v_now
    );
    return 'accepted';
  end if;

  -- Client sentAt / location_timestamp must not override sequence ordering.
  if p_sequence <= v_live.sequence then
    return 'stale_sequence';
  end if;

  if v_now - v_live.updated_at < v_min_interval then
    return 'rate_limited';
  end if;

  update public.claim_live_locations
  set
    latitude = p_latitude,
    longitude = p_longitude,
    accuracy_meters = p_accuracy_meters,
    heading_degrees = p_heading_degrees,
    sequence = p_sequence,
    location_timestamp = p_location_timestamp,
    updated_at = v_now
  where claim_id = p_claim_id;

  return 'accepted';
end;
$$;

comment on function public.upsert_claim_live_location(
  uuid,
  double precision,
  double precision,
  double precision,
  double precision,
  bigint,
  timestamptz
) is
  'Atomically accept or reject a seeker live-location snapshot using wall-clock rate limiting and strict sequence monotonicity. Service role only.';

revoke all on function public.upsert_claim_live_location(
  uuid,
  double precision,
  double precision,
  double precision,
  double precision,
  bigint,
  timestamptz
) from public;
revoke all on function public.upsert_claim_live_location(
  uuid,
  double precision,
  double precision,
  double precision,
  double precision,
  bigint,
  timestamptz
) from anon;
revoke all on function public.upsert_claim_live_location(
  uuid,
  double precision,
  double precision,
  double precision,
  double precision,
  bigint,
  timestamptz
) from authenticated;
grant execute on function public.upsert_claim_live_location(
  uuid,
  double precision,
  double precision,
  double precision,
  double precision,
  bigint,
  timestamptz
) to service_role;

create or replace function public.try_accept_claim_location_status(
  p_claim_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz;
  v_min_interval constant interval := interval '2 seconds';
  v_last timestamptz;
begin
  perform 1
  from public.claims
  where id = p_claim_id
  for update;

  if not found then
    return 'stale_sequence';
  end if;

  v_now := pg_catalog.clock_timestamp();

  select updated_at
  into v_last
  from public.claim_live_status_throttle
  where claim_id = p_claim_id
  for update;

  if found and v_now - v_last < v_min_interval then
    return 'rate_limited';
  end if;

  insert into public.claim_live_status_throttle (claim_id, updated_at)
  values (p_claim_id, v_now)
  on conflict (claim_id) do update
  set updated_at = excluded.updated_at;

  return 'accepted';
end;
$$;

comment on function public.try_accept_claim_location_status(uuid) is
  'Atomically rate-limit seeker-location-status broadcasts per claim. Service role only.';

revoke all on function public.try_accept_claim_location_status(uuid) from public;
revoke all on function public.try_accept_claim_location_status(uuid) from anon;
revoke all on function public.try_accept_claim_location_status(uuid) from authenticated;
grant execute on function public.try_accept_claim_location_status(uuid) to service_role;

-- Mirror snapshot cleanup: drop status throttle when a claim goes terminal.
create or replace function public.delete_claim_live_location_on_terminal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.status in ('completed', 'cancelled', 'expired')
    and OLD.status is distinct from NEW.status
  then
    delete from public.claim_live_locations as live
    where live.claim_id = NEW.id;

    delete from public.claim_live_status_throttle as throttle
    where throttle.claim_id = NEW.id;

    raise log '[switch-it:handoff-live] snapshot deleted claimId=% reason=claim_terminal status=%',
      NEW.id,
      NEW.status;
  end if;

  return NEW;
end;
$$;
