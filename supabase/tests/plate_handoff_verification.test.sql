-- Manual / SQL verification for license-plate handoff verification.
-- Run on a non-production Supabase project after applying migrations.

-- Prerequisites:
-- Publisher A: Toyota Corolla, 2024, White, license_plate = '1234567'
-- Seeker B with a complete vehicle and credits
-- Active claimed handoff (B claimed A's spot)

-- ---------------------------------------------------------------------------
-- 1. Seeker counterpart payload is masked and has no photo/full plate
-- ---------------------------------------------------------------------------
-- set local role authenticated;
-- set local request.jwt.claim.sub = '<seeker-user-id>';
-- select * from public.get_handoff_counterpart_vehicle('<active-claim-id>');
-- Expected:
--   vehicle_license_plate_masked = '12-345-**'
--   no vehicle_license_plate column
--   no vehicle_photo_path column
--   make/model/year/color present
-- Must NOT contain 67.

-- ---------------------------------------------------------------------------
-- 2. Direct profiles select of the publisher is blocked by RLS
-- ---------------------------------------------------------------------------
-- As seeker: select license_plate from public.profiles where id = '<publisher-id>';
-- Expected: zero rows.

-- ---------------------------------------------------------------------------
-- 3. Wrong digits consume attempts; lock after 3; cooldown is server-backed
-- ---------------------------------------------------------------------------
-- As publisher: select public.complete_claim('<claim-id>', '12');
-- Expected: INVALID_PLATE_DIGITS, detail attempts_remaining=2
-- Repeat with '34' → attempts_remaining=1
-- Repeat with '56' → HANDOFF_TEMPORARILY_LOCKED
-- select attempt_count, locked_until from claim_handoff_secrets where claim_id = '...';
-- Expected: attempt_count = 3, locked_until ~ now() + 2 minutes
-- Refresh / new session / other device using the same publisher JWT still locked.
-- Exception messages must not include the seeker's hidden suffix.

-- ---------------------------------------------------------------------------
-- 4. After lock expires, correct digits complete once
-- ---------------------------------------------------------------------------
-- Wait until locked_until < now() (or update locked_until to now() - interval '1 second' in SQL editor as service role for the test).
-- As publisher: select public.complete_claim('<claim-id>', '<seeker-last-two>');
-- Expected: already_completed=false, credits moved once (seeker -1, publisher +1).
-- Repeat complete_claim → already_completed=true, no second ledger rows.

-- ---------------------------------------------------------------------------
-- 5. Only the publisher can verify
-- ---------------------------------------------------------------------------
-- As seeker: complete_claim(..., suffix) → NOT_OWNER
-- As unrelated user → NOT_OWNER or CLAIM_NOT_FOUND
-- Terminal/cancelled/expired claim → HANDOFF_UNAVAILABLE
-- Before handoff_started_at → HANDOFF_NOT_STARTED

-- ---------------------------------------------------------------------------
-- 6. Spoken-code RPC is dormant
-- ---------------------------------------------------------------------------
-- select * from public.get_handoff_code('<claim-id>');
-- Expected: zero rows for owner and seeker.

-- ---------------------------------------------------------------------------
-- 7. Helper functions are not executable by authenticated
-- ---------------------------------------------------------------------------
select
  has_function_privilege('authenticated', 'public.mask_license_plate_for_handoff(text)', 'execute') as mask_granted,
  has_function_privilege('authenticated', 'public.complete_claim(uuid, text)', 'execute') as complete_granted,
  has_function_privilege('authenticated', 'public.get_handoff_counterpart_vehicle(uuid)', 'execute') as counterpart_granted;
-- Expected: mask_granted=false, complete_granted=true, counterpart_granted=true
