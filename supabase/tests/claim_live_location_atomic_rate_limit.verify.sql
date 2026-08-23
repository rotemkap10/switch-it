-- Manual verification for atomic claim live location rate limit (non-prod).
-- Requires migration 20260823110000_claim_live_location_atomic_rate_limit.sql.

-- Function returns text status
select pg_catalog.pg_get_function_result(p.oid) as result_type
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'upsert_claim_live_location'
  and pg_catalog.pg_get_function_identity_arguments(p.oid) like 'uuid,%';

-- Service role only
select count(*)::int as public_execute_grants
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'upsert_claim_live_location'
  and pg_catalog.has_function_privilege('public', p.oid, 'execute');

select count(*)::int as authenticated_execute_grants
from pg_catalog.pg_proc as p
join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'upsert_claim_live_location'
  and pg_catalog.has_function_privilege('authenticated', p.oid, 'execute');

-- Example sequence (replace claim id; run as service role):
-- select public.upsert_claim_live_location('<claim-id>', 32.1, 34.8, 10, null, 1, now()); -- accepted
-- select public.upsert_claim_live_location('<claim-id>', 32.2, 34.8, 10, null, 2, now()); -- rate_limited if within 2s
-- select public.upsert_claim_live_location('<claim-id>', 32.2, 34.8, 10, null, 1, now()); -- stale_sequence
