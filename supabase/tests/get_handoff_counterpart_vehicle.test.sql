-- Manual / SQL verification for get_handoff_counterpart_vehicle (Phase 2).
-- Run on a non-production Supabase project after applying migrations.
-- See docs/TEST_PLAN.md §26 for the broader verification workflow.
--
-- Prerequisites:
-- - Owner account A with a complete vehicle profile
-- - Seeker account B with a complete vehicle profile
-- - One available spot published by A, claimed by B (active claim)
--
-- Replace placeholder UUIDs before running.

-- ---------------------------------------------------------------------------
-- 1. Seeker retrieves owner vehicle for own active claim
-- ---------------------------------------------------------------------------
-- set local role authenticated;
-- set local request.jwt.claim.sub = '<seeker-user-id>';
-- select * from public.get_handoff_counterpart_vehicle('<active-claim-id>');
-- Expected: one row with owner vehicle fields only.

-- ---------------------------------------------------------------------------
-- 2. Owner retrieves seeker vehicle for own claimed spot
-- ---------------------------------------------------------------------------
-- set local role authenticated;
-- set local request.jwt.claim.sub = '<owner-user-id>';
-- select * from public.get_handoff_counterpart_vehicle('<active-claim-id>');
-- Expected: one row with seeker vehicle fields only.

-- ---------------------------------------------------------------------------
-- 3. Unrelated authenticated user receives no row
-- ---------------------------------------------------------------------------
-- set local role authenticated;
-- set local request.jwt.claim.sub = '<unrelated-user-id>';
-- select * from public.get_handoff_counterpart_vehicle('<active-claim-id>');
-- Expected: zero rows.

-- ---------------------------------------------------------------------------
-- 4. Seeker cannot retrieve data for another user's claim
-- ---------------------------------------------------------------------------
-- Use a different active claim id that B did not create.
-- Expected: zero rows.

-- ---------------------------------------------------------------------------
-- 5. Owner cannot retrieve data for another owner's spot claim
-- ---------------------------------------------------------------------------
-- Use a claim on a spot owned by someone else.
-- Expected: zero rows.

-- ---------------------------------------------------------------------------
-- 6. Available spot with no active claim returns no data
-- ---------------------------------------------------------------------------
-- Use a claim id from a cancelled/completed claim, or a random uuid.
-- Expected: zero rows.

-- ---------------------------------------------------------------------------
-- 7–9. Terminal claim states return no data
-- ---------------------------------------------------------------------------
-- Repeat RPC after completing, cancelling, or expiring the claim.
-- Expected: zero rows for completed, cancelled, and expired claims.

-- ---------------------------------------------------------------------------
-- 10. RPC returns only allowlisted vehicle fields
-- ---------------------------------------------------------------------------
-- select
--   vehicle_license_plate_masked,
--   vehicle_make,
--   vehicle_model,
--   vehicle_color,
--   vehicle_type,
--   vehicle_year
-- from public.get_handoff_counterpart_vehicle('<active-claim-id>');
-- Expected: masked plate such as 12-345-**; no full plate, photo path, profile id, email, credits.

-- ---------------------------------------------------------------------------
-- 11. Profiles RLS remains unchanged
-- ---------------------------------------------------------------------------
-- As seeker B, attempt:
-- select license_plate, vehicle_make from public.profiles where id = '<owner-user-id>';
-- Expected: RLS blocks direct access (zero rows or permission denied).

-- ---------------------------------------------------------------------------
-- 12. Function security metadata
-- ---------------------------------------------------------------------------
select
  p.proname as function_name,
  p.prosecdef as security_definer,
  pg_get_function_identity_arguments(p.oid) as arguments
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'get_handoff_counterpart_vehicle';

-- Expected: security_definer = true, arguments = p_claim_id uuid

select
  has_function_privilege('authenticated', 'public.get_handoff_counterpart_vehicle(uuid)', 'execute') as authenticated_can_execute,
  has_function_privilege('anon', 'public.get_handoff_counterpart_vehicle(uuid)', 'execute') as anon_can_execute,
  has_function_privilege('public', 'public.get_handoff_counterpart_vehicle(uuid)', 'execute') as public_can_execute;

-- Expected: authenticated=true, anon=false, public=false
