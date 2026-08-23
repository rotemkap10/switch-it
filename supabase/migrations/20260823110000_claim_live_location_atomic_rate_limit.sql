-- Atomic server-side rate limit for claim live-location snapshots.
-- One accept decision per claim per RPC call; serializes concurrent writers via row lock.

drop function if exists public.upsert_claim_live_location(
  uuid,
  double precision,
  double precision,
  double precision,
  double precision,
  bigint,
  timestamptz
);

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
  v_now timestamptz := pg_catalog.now();
  -- Native send interval is ~3s; 2s leaves ~1s jitter/network margin without blocking normal traffic.
  v_min_interval constant interval := interval '2 seconds';
  v_live public.claim_live_locations%rowtype;
  v_sequence_newer boolean;
begin
  loop
    select *
    into v_live
    from public.claim_live_locations
    where claim_id = p_claim_id
    for update;

    if found then
      exit;
    end if;

    begin
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
    exception
      when unique_violation then
        null;
    end;
  end loop;

  v_sequence_newer := p_sequence > v_live.sequence
    or (
      p_sequence = v_live.sequence
      and p_location_timestamp >= v_live.location_timestamp
    );

  if not v_sequence_newer then
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
  'Atomically accept or reject a seeker live-location snapshot. Returns accepted, stale_sequence, or rate_limited. Service role only.';

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
