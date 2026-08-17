-- Latest seeker location snapshot per active claim (recovery path only).
-- At most ONE row per claim; each upsert replaces the previous row.
-- No route history. Deleted on terminal claim status or claim deletion (FK cascade).

create table public.claim_live_locations (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_meters double precision not null,
  heading_degrees double precision null,
  sequence bigint not null,
  location_timestamp timestamptz not null,
  updated_at timestamptz not null default pg_catalog.now(),

  constraint claim_live_locations_latitude_range
    check (latitude >= -90 and latitude <= 90),
  constraint claim_live_locations_longitude_range
    check (longitude >= -180 and longitude <= 180),
  constraint claim_live_locations_accuracy_positive
    check (accuracy_meters > 0 and accuracy_meters <= 150),
  constraint claim_live_locations_sequence_positive
    check (sequence > 0)
);

comment on table public.claim_live_locations is
  'Ephemeral latest seeker GPS per active claim. One row per claim; replaced on each upsert. Not a history trail.';

alter table public.claim_live_locations enable row level security;

revoke all on table public.claim_live_locations from public;
revoke all on table public.claim_live_locations from anon;

-- Participants (seeker + spot owner) may read the latest snapshot for their claim.
create policy claim_live_locations_select_participants
  on public.claim_live_locations
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.claims as claims
      where claims.id = claim_live_locations.claim_id
        and (
          claims.seeker_id = (select auth.uid())
          or exists (
            select 1
            from public.parking_spots as spots
            where spots.id = claims.spot_id
              and spots.owner_id = (select auth.uid())
          )
        )
    )
  );

-- Service role only: Edge Function upserts after seeker authorization.
create or replace function public.upsert_claim_live_location(
  p_claim_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision,
  p_heading_degrees double precision,
  p_sequence bigint,
  p_location_timestamp timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.claim_live_locations as live (
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
    pg_catalog.now()
  )
  on conflict (claim_id) do update
  set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_meters = excluded.accuracy_meters,
    heading_degrees = excluded.heading_degrees,
    sequence = excluded.sequence,
    location_timestamp = excluded.location_timestamp,
    updated_at = excluded.updated_at
  where excluded.sequence > live.sequence
    or (
      excluded.sequence = live.sequence
      and excluded.location_timestamp >= live.location_timestamp
    );
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
  'Replace latest seeker location for one claim. Newer sequence/timestamp wins. Service role only.';

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

-- Database-side cleanup when a claim leaves active status.
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

    raise log '[switch-it:handoff-live] snapshot deleted claimId=% reason=claim_terminal status=%',
      NEW.id,
      NEW.status;
  end if;

  return NEW;
end;
$$;

create trigger claims_delete_live_location_on_terminal
  after update of status on public.claims
  for each row
  execute function public.delete_claim_live_location_on_terminal();
