-- Phase 9B authorization checks (manual / SQL editor on a non-prod project).
-- Counts and boolean outcomes only — no coordinates, emails, or vehicle data.
-- Requires migration 20260806150000_phase9b_claim_location_broadcast.sql.

-- Topic parser
select public.claim_location_topic_claim_id('claim-location:550e8400-e29b-41d4-a716-446655440000')
  is not null as valid_topic;
select public.claim_location_topic_claim_id('claim-location:not-a-uuid') is null as malformed_null;
select public.claim_location_topic_claim_id('room:1') is null as wrong_prefix_null;
select public.claim_location_topic_claim_id('CLAIM-LOCATION:550e8400-e29b-41d4-a716-446655440000')
  is null as uppercase_prefix_null;
select public.claim_location_topic_claim_id('claim-location:550E8400-E29B-41D4-A716-446655440000')
  is null as uppercase_uuid_null;

-- Helpers exist and return boolean (false without a matching active handoff)
select public.can_send_claim_location('claim-location:550e8400-e29b-41d4-a716-446655440000')
  as send_without_claim_is_false;
select public.can_receive_claim_location('claim-location:550e8400-e29b-41d4-a716-446655440000')
  as receive_without_claim_is_false;
select public.can_send_claim_location('not-a-topic') as send_malformed_false;
select public.can_receive_claim_location('not-a-topic') as receive_malformed_false;

-- Policy presence
select count(*)::int as publisher_select_policies
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
  and policyname = 'claim_location_publisher_select';

select count(*)::int as seeker_insert_policies
from pg_policies
where schemaname = 'realtime'
  and tablename = 'messages'
  and policyname = 'claim_location_seeker_insert';
