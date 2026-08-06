-- Phase 9B: private Broadcast authorization for claim live location.
-- Additive only. Does not alter parking_spots/claims/profiles RLS,
-- Phase 9A functions, credits, or supabase_realtime publication.
--
-- Topic: claim-location:<claim_uuid> (lowercase UUID, length 51)
-- SELECT (receive): parking-spot owner for the active claim
-- INSERT (send): seeker of the active claim
-- Join requires at least one of read/write (Supabase Realtime Authorization).
-- Authorization is cached at channel join / JWT refresh; clients must
-- leave the channel on terminal handoff state.
--
-- Keep Realtime "Allow public access" enabled so existing public
-- postgres_changes channels continue to work. Location channels use
-- config.private = true so these RLS policies are enforced.
--
-- SECURITY DEFINER boolean helpers are required because parking_spots RLS
-- only exposes available spots (or own spots) to clients. A seeker with an
-- active claim cannot SELECT the claimed parking_spots row, so an inline
-- EXISTS join in the INSERT policy would always fail under invoker RLS.
-- Helpers return boolean only (no participant or location data).

-- ---------------------------------------------------------------------------
-- Safe topic → claim_id parser (no unsafe cast of arbitrary text)
-- ---------------------------------------------------------------------------
create or replace function public.claim_location_topic_claim_id(p_topic text)
returns uuid
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_prefix constant text := 'claim-location:';
  v_rest text;
begin
  if p_topic is null then
    return null;
  end if;

  -- 'claim-location:' (15) + uuid text (36) = 51
  if length(p_topic) <> 51 then
    return null;
  end if;

  if left(p_topic, 15) is distinct from v_prefix then
    return null;
  end if;

  v_rest := substr(p_topic, 16);

  -- Lowercase UUID text only (clients must lowercase claim ids in topics).
  if v_rest !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return v_rest::uuid;
exception
  when invalid_text_representation then
    return null;
end;
$$;

comment on function public.claim_location_topic_claim_id(text) is
  'Parse claim-location:<uuid> topics. Returns null for malformed topics. No participant data.';

revoke all on function public.claim_location_topic_claim_id(text) from public;
revoke all on function public.claim_location_topic_claim_id(text) from anon;
grant execute on function public.claim_location_topic_claim_id(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Publisher may receive on topic (boolean only; SECURITY DEFINER for RLS)
-- ---------------------------------------------------------------------------
create or replace function public.can_receive_claim_location(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim_id uuid;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  v_claim_id := public.claim_location_topic_claim_id(p_topic);
  if v_claim_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.claims as claims
    inner join public.parking_spots as spots
      on spots.id = claims.spot_id
    where claims.id = v_claim_id
      and spots.owner_id = v_uid
      and claims.status = 'active'
      and spots.status = 'claimed'
      and spots.expires_at > pg_catalog.now()
  );
end;
$$;

comment on function public.can_receive_claim_location(text) is
  'True when auth.uid() owns the active claimed spot for claim-location:<uuid>. Boolean only.';

revoke all on function public.can_receive_claim_location(text) from public;
revoke all on function public.can_receive_claim_location(text) from anon;
grant execute on function public.can_receive_claim_location(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Seeker may send on topic (boolean only; SECURITY DEFINER for RLS)
-- ---------------------------------------------------------------------------
create or replace function public.can_send_claim_location(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_claim_id uuid;
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    return false;
  end if;

  v_claim_id := public.claim_location_topic_claim_id(p_topic);
  if v_claim_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.claims as claims
    inner join public.parking_spots as spots
      on spots.id = claims.spot_id
    where claims.id = v_claim_id
      and claims.seeker_id = v_uid
      and claims.status = 'active'
      and spots.status = 'claimed'
      and spots.expires_at > pg_catalog.now()
  );
end;
$$;

comment on function public.can_send_claim_location(text) is
  'True when auth.uid() is the seeker of the active claimed handoff for claim-location:<uuid>. Boolean only.';

revoke all on function public.can_send_claim_location(text) from public;
revoke all on function public.can_send_claim_location(text) from anon;
grant execute on function public.can_send_claim_location(text) to authenticated;

-- ---------------------------------------------------------------------------
-- SELECT: publisher may receive seeker-location broadcasts
-- ---------------------------------------------------------------------------
create policy "claim_location_publisher_select"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and public.can_receive_claim_location((select realtime.topic()))
);

-- ---------------------------------------------------------------------------
-- INSERT: seeker may send seeker-location broadcasts
-- ---------------------------------------------------------------------------
create policy "claim_location_seeker_insert"
on realtime.messages
for insert
to authenticated
with check (
  realtime.messages.extension = 'broadcast'
  and public.can_send_claim_location((select realtime.topic()))
);
