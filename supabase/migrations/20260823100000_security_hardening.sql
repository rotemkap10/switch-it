-- Security hardening (non-breaking):
-- 1. Revoke dormant get_handoff_code from clients (returns empty; plate verification only).
-- 2. Document-only: upsert_claim_live_location remains service_role-only.

revoke execute on function public.get_handoff_code(uuid) from authenticated;

comment on function public.get_handoff_code(uuid) is
  'Dormant. Spoken handoff codes are no longer returned. EXECUTE revoked from authenticated — use complete_claim plate verification.';
