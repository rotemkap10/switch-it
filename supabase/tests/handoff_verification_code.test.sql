-- Manual / SQL verification for Phase 3 handoff verification codes.
-- Run on a non-production Supabase project after applying migrations.
-- See docs/TEST_PLAN.md §26 and §27.

-- ---------------------------------------------------------------------------
-- Security metadata
-- ---------------------------------------------------------------------------
select
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'claim_handoff_secrets';

select
  has_table_privilege('authenticated', 'public.claim_handoff_secrets', 'select') as auth_select,
  has_table_privilege('authenticated', 'public.claim_handoff_secrets', 'insert') as auth_insert,
  has_table_privilege('authenticated', 'public.claim_handoff_secrets', 'update') as auth_update,
  has_table_privilege('authenticated', 'public.claim_handoff_secrets', 'delete') as auth_delete;

-- Expected: RLS enabled; all authenticated table privileges false.

select
  has_function_privilege('authenticated', 'public.get_handoff_code(uuid)', 'execute') as owner_rpc,
  has_function_privilege('authenticated', 'public.complete_claim(uuid, text)', 'execute') as complete_rpc,
  has_function_privilege('authenticated', 'public.create_claim_handoff_secret(uuid)', 'execute') as secret_helper;

-- Expected: owner_rpc=true, complete_rpc=true, secret_helper=false

-- ---------------------------------------------------------------------------
-- Two-account manual flow (replace UUID placeholders)
-- ---------------------------------------------------------------------------
-- 1. Owner A publishes a spot.
-- 2. Seeker B claims it via claim_spot.
-- 3. Verify one secret row exists:
--    select claim_id, attempt_count, locked_until from public.claim_handoff_secrets where claim_id = '<claim-id>';
-- 4. Owner calls get_handoff_code('<claim-id>') -> one 5-digit row.
-- 5. Seeker calls get_handoff_code('<claim-id>') -> zero rows.
-- 6. Wrong complete_claim('<claim-id>', '00000') -> INVALID_HANDOFF_CODE; no credit movement.
-- 7. Repeat wrong code 5 times -> HANDOFF_TEMPORARILY_LOCKED; no credit movement.
-- 8. Correct complete_claim('<claim-id>', '<owner-code>') -> completed; one debit + one credit.
-- 9. Repeat successful complete_claim -> already_completed; no new ledger rows.
-- 10. Owner get_handoff_code after completion -> zero rows.
