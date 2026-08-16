-- Live handoff location: PostgREST cannot call realtime.send directly.
--
-- Evidence (project API): Content-Profile: realtime → PGRST106
--   "Invalid schema: realtime"
--   "Only the following schemas are exposed: public, graphql_public"
--
-- The Edge Function therefore failed at broadcast after claim authorize,
-- returning 502 to native POSTs while the seeker UI still said
-- "Live location on" (GPS-started, not transport-confirmed).
--
-- Wrap realtime.send in a public SECURITY DEFINER RPC granted only to
-- service_role. Authorization remains the Edge Function's job
-- (can_send_claim_location with the seeker JWT).

create or replace function public.broadcast_claim_location(
  p_payload jsonb,
  p_event text,
  p_topic text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Positional args avoid private vs is_private naming ambiguity across
  -- Realtime versions. Fourth argument true = private channel broadcast.
  perform realtime.send(p_payload, p_event, p_topic, true);
end;
$$;

comment on function public.broadcast_claim_location(jsonb, text, text) is
  'Service-role fan-out for claim-location private Broadcast via realtime.send. Callers must authorize the seeker separately.';

revoke all on function public.broadcast_claim_location(jsonb, text, text) from public;
revoke all on function public.broadcast_claim_location(jsonb, text, text) from anon;
revoke all on function public.broadcast_claim_location(jsonb, text, text) from authenticated;
grant execute on function public.broadcast_claim_location(jsonb, text, text) to service_role;
