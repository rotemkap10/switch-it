-- claim_live_locations had RLS participant SELECT but no table grant for
-- authenticated. PostgREST returned permission denied; the publisher hook
-- treated that as "snapshot empty" even after successful Edge Function upserts.

grant select on table public.claim_live_locations to authenticated;

comment on table public.claim_live_locations is
  'Ephemeral latest seeker GPS per active claim. One row per claim; replaced on each upsert. Not a history trail. Participants read via RLS; writes via service_role upsert only.';
