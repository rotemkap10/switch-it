-- Phase 9A post-deployment verification (read-only, no PII).
-- Run after applying 20260806140000_phase9a_shared_handoff_deadline.sql.
-- Safe to run in production: counts and status aggregates only.

-- 1) No active claim may disagree with its spot deadline.
select count(*)::int as active_claim_deadline_mismatch
from public.claims as claims
inner join public.parking_spots as spots on spots.id = claims.spot_id
where claims.status = 'active'
  and claims.expires_at is distinct from spots.expires_at;
-- expect: 0

-- 2) No active claim may sit beyond the shared spot deadline.
select count(*)::int as active_claim_past_spot_deadline
from public.claims as claims
inner join public.parking_spots as spots on spots.id = claims.spot_id
where claims.status = 'active'
  and spots.expires_at <= pg_catalog.now();
-- expect: 0

-- 3) No available/claimed spot may remain past expires_at (should be terminal).
select count(*)::int as open_spots_past_deadline
from public.parking_spots as spots
where spots.status in ('available', 'claimed')
  and spots.expires_at <= pg_catalog.now();
-- expect: 0

-- 4) Ambiguous inconsistencies that the migration refuses to rewrite.
select count(*)::int as claimed_without_active
from public.parking_spots as spots
where spots.status = 'claimed'
  and not exists (
    select 1
    from public.claims as claims
    where claims.spot_id = spots.id
      and claims.status = 'active'
  );
-- expect: 0

select count(*)::int as active_on_non_claimed_spot
from public.claims as claims
inner join public.parking_spots as spots on spots.id = claims.spot_id
where claims.status = 'active'
  and spots.status is distinct from 'claimed';
-- expect: 0

-- 5) Credit inventory sanity (migration must not invent handoff txs).
-- Compare to a pre-migration snapshot if you captured one; otherwise this is informational.
select
  count(*)::int as credit_tx_total,
  count(*) filter (where transaction_type = 'handoff_debit')::int as handoff_debits,
  count(*) filter (where transaction_type = 'handoff_credit')::int as handoff_credits
from public.credit_transactions;

-- 6) Completed / cancelled rows remain terminal (spot counts by status).
select spots.status, count(*)::int as n
from public.parking_spots as spots
where spots.status in ('completed', 'cancelled', 'expired', 'available', 'claimed')
group by spots.status
order by spots.status;

select claims.status, count(*)::int as n
from public.claims as claims
where claims.status in ('completed', 'cancelled', 'expired', 'active')
group by claims.status
order by claims.status;
