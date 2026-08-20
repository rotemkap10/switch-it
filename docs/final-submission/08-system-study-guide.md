# System study guide — Switch It

Personal prep doc for defending the project in a short technical interview.

For each topic: **WHAT / WHERE / HOW / WHY / WHAT CAN GO WRONG / HOW HANDLED**.

Items marked **STUDY PRIORITY** are likely oral-exam targets.

---

## Next.js architecture

- **WHAT:** App Router web app with RSC pages and Client Components where interactivity is needed.
- **WHERE:** `src/app/`, `src/components/`, `package.json` (`next@16.2.12`).
- **HOW:** Pages load data on the server; buttons call Server Actions; maps/sheets are client.
- **WHY:** Fits Vercel deploy; keeps privileged work on the server.
- **WRONG:** Treating everything as a client SPA.
- **HANDLED:** Hybrid RSC + client islands.

## Server vs Client Components

- **WHAT:** Server Components render without shipping their JS; Client Components (`"use client"`) handle state/events.
- **WHERE:** Most `page.tsx` are server; map/claim/publish UI is client.
- **HOW:** Pass serializable props from server to client.
- **WHY:** Smaller bundles; direct authenticated DB access on server.
- **WRONG:** Marking the entire tree client unnecessarily.
- **HANDLED:** Interactive pieces only.

## Server Actions — STUDY PRIORITY

- **WHAT:** Server mutation entry points from forms/buttons.
- **WHERE:** `src/actions/*.ts`.
- **HOW:** Validate → Supabase server client → RPC/insert → revalidate/redirect.
- **WHY:** Less REST boilerplate; authenticated per request.
- **WRONG:** Trusting client-only validation.
- **HANDLED:** Zod + DB rules.

## Supabase authentication

- **WHAT:** Email/password sessions.
- **WHERE:** `src/actions/auth.ts`, `src/app/auth/callback/route.ts`, `src/lib/supabase/*`, `src/proxy.ts`.
- **HOW:** Cookies via `@supabase/ssr`; proxy refreshes session.
- **WHY:** Managed auth + RLS integration.
- **WRONG:** Expired session mid-handoff; confusing Auth with unique-human identity.
- **HANDLED:** Refresh + login redirect with `next`. Auth proves account/session, not one-person-one-account.

## RLS — STUDY PRIORITY

- **WHAT:** Row Level Security policies on tables.
- **WHERE:** Migrations starting `20260802111257_auth_profile_and_rls.sql` and later policy updates.
- **HOW:** e.g. profiles own-row; claims seeker-or-owner; spots available-or-own (+ short terminal grace).
- **WHY:** Even with the publishable key in the browser, Postgres enforces access.
- **WRONG:** Over-permissive policies.
- **HANDLED:** Iterated policies + RPC for complex writes.

## RPCs / SECURITY DEFINER — STUDY PRIORITY

- **WHAT:** Postgres functions for multi-step business operations.
- **WHERE:** claim/complete/start/cancel/extend migrations.
- **HOW:** `SECURITY DEFINER` + `auth.uid()` checks + grants to `authenticated`.
- **WHY:** Atomic multi-table updates; one place for rules.
- **WRONG:** Missing uid check = privilege bypass risk.
- **HANDLED:** Explicit role checks in function bodies.

## PostgreSQL transactions & locking — STUDY PRIORITY

- **WHAT:** `FOR UPDATE` locks spot rows during claim/start.
- **WHERE:** `claim_spot`, `start_handoff_now` migrations.
- **HOW:** Lock → validate → insert/update → commit.
- **WHY:** Prevent double-claim races.
- **WRONG:** Check-then-act without lock.
- **HANDLED:** Lock + unique indexes.

## Unique constraints

- **WHAT:** Partial unique indexes for active claims and credit ledger.
- **WHERE:** `20260802110120_initial_schema.sql`.
- **HOW:** Only one `status='active'` claim per spot/seeker; one debit/credit per claim.
- **WHY:** Backstop if logic bugs; idempotency for credits.
- **WRONG:** Ignoring unique violation errors.
- **HANDLED:** Mapped to app error codes in later `claim_spot`.

## Parking spot lifecycle — STUDY PRIORITY

- **WHAT:** `available → claimed → completed|cancelled|expired` (+ reopen path before live start).
- **WHERE:** spot status + RPCs; publisher/seeker UI.
- **HOW:** Publish insert; claim/start/expire/cancel/complete transitions.
- **WHY:** Clear product states for short handoffs.
- **WRONG:** Client shows available while DB claimed.
- **HANDLED:** Realtime + revalidate + reconcile RPCs.

## Timing fields — STUDY PRIORITY

- **WHAT:** `available_at`, `handoff_started_at`, `expires_at`.
- **WHERE:** `src/lib/spots/constants.ts`; migrations `18140000`, `18210000`, `18220000`, `19140000`.
- **HOW:** Future vs Now vs I’m leaving now vs auto-start; claim into live window keeps remaining time.
- **WHY:** Separate promised departure from actual live start.
- **WRONG:** Resetting timer on late claim; saying unclaimed I’m leaving now expires the listing.
- **HANDLED:** Unclaimed early start stays `available` with live `expires_at`.

## Claim lifecycle

- **WHAT:** Active claim binds one seeker to one spot.
- **WHERE:** `claims` table + claim/cancel/complete/expire RPCs.
- **HOW:** See technical design.
- **WHY:** Exclusive coordination window.
- **WRONG:** Two actives; reclaim abuse.
- **HANDLED:** Uniques + reclaim ban after seeker cancel.

## Credits — STUDY PRIORITY

- **WHAT:** Virtual points; start at 5.
- **WHERE:** `profiles.credits`, `credit_transactions`, `complete_claim`.
- **HOW:** Check on claim; move only on successful complete; ledger rows.
- **WHY:** Incentive without payments.
- **WRONG:** Double spend / double pay; claiming “unique humans”.
- **HANDLED:** Transaction + unique ledger constraints + idempotent complete. Multi-account farming remains residual risk.

## Realtime

- **WHAT:** Live UI updates for spots/claims; broadcast for live location.
- **WHERE:** `src/lib/realtime/*`, map/publisher hooks, location hooks.
- **HOW:** `postgres_changes` subscriptions; private topics for location.
- **WHY:** Handoffs are seconds-sensitive.
- **WRONG:** Missed event → stale pin.
- **HANDLED:** Tombstones, refresh, reconcile.

## Live location

- **WHAT:** Seeker position during an active claim.
- **WHERE:** `use-seeker-live-location-share.ts`, `use-publisher-live-location.ts`, Edge `handoff-seeker-location`, table `claim_live_locations`.
- **HOW:** Web = Broadcast; native/Edge may upsert ephemeral latest snapshot then broadcast. Publisher may read snapshot for recovery. UI treats sharing as mandatory for active claim.
- **WHY:** Help publisher see approaching seeker.
- **WRONG:** Claiming coordinates are never stored; claiming permanent tracking history.
- **HANDLED:** Snapshot is latest-only, deleted on terminal claim; not a route trail.

## Cancellation

- **WHAT:** Structured reasons; different reopen rules before/after start.
- **WHERE:** `20260819120000_cancellation_reasons.sql`, cancel UI sheets.
- **HOW:** RPC with reason codes.
- **WHY:** Clear product rules; no silent cancels.
- **WRONG:** Reopening after live start.
- **HANDLED:** After start, exchange ends.

## Completion verification — STUDY PRIORITY

- **WHAT:** Publisher enters seeker’s last 2 plate digits.
- **WHERE:** `complete_claim`, `CompleteHandoffForm`, plate migrations.
- **HOW:** Compare suffix; attempts; lock after 3 fails (~2 min).
- **WHY:** Confirm correct car without spoken-code UX.
- **WRONG:** Describing spoken 5-digit codes as current product.
- **HANDLED:** Plate suffix path; dormant `get_handoff_code`.

## History & pagination

- **WHAT:** Terminal handoffs list.
- **WHERE:** `/history`, `get_handoff_history`, `HISTORY_PAGE_SIZE=20`.
- **HOW:** Keyset cursor load-more.
- **WHY:** Avoid loading entire history.
- **WRONG:** Offset pagination instability.
- **HANDLED:** Keyset `(before_at, before_id)`.

## Error handling

- **WHAT:** Business codes → friendly messages + toasts/alerts.
- **WHERE:** `src/lib/feedback/error-map.ts`.
- **HOW:** Map Postgres exceptions; inline vs toast.
- **WHY:** Users shouldn’t see SQL.
- **WRONG:** Swallowing errors.
- **HANDLED:** Typed action states + route error boundaries.

## MapLibre / MapTiler

- **WHAT:** Primary seeker map rendering + geocoding.
- **WHERE:** `BaseMap`, `seekerMapConfig`, geocoding libs.
- **HOW:** Style URL with public MapTiler key.
- **WHY:** Good mobile maps without self-hosting tiles.
- **WRONG:** Saying Leaflet is the primary stack.
- **HANDLED:** MapLibre + MapTiler; Leaflet remains legacy/alternate only.

## Environment variables

- **WHAT:** Public Next config for Supabase/MapTiler/CarImages.
- **WHERE:** `.env.example`, `src/lib/supabase/*`.
- **HOW:** `NEXT_PUBLIC_*` embedded in client bundles.
- **WHY:** Browser needs Supabase URL/key; RLS protects data.
- **WRONG:** Service role in public env.
- **HANDLED:** Documented separation.

## Vercel deployment

- **WHAT:** Host Next.js app.
- **WHERE:** Standard Next deploy (a `vercel.json` is **not** required).
- **HOW:** Build `next build`; set env vars in Vercel.
- **WHY:** Course requirement + fits App Router.
- **WRONG:** Env mismatch vs Supabase project; missing live URL on submission cover.
- **HANDLED:** Checklist before demo.

## Push notifications (optional / experimental)

- **WHAT:** Device registration / outbox infrastructure exists.
- **WHERE:** `HandoffPushController`, push migrations, related Edge paths.
- **HOW:** Not part of verified core web MVP; production iOS/APNs delivery not fully configured/verified.
- **WHY:** Future convenience for handoff events.
- **WRONG:** Claiming push is a finished core feature.
- **HANDLED:** Treat as optional pilot in docs and presentation.

## Tests

- **WHAT:** Large Vitest suite; migration string contracts.
- **WHERE:** `**/*.test.ts(x)`, `*.migration.test.ts`.
- **HOW:** `npm run test:run` → **235 files / 1414 tests** (re-verified).
- **WHY:** Guard regressions on timing/UI/actions.
- **WRONG:** Believing SQL-text contract tests equal live concurrent DB tests; claiming Playwright exists.
- **HANDLED:** Supplement with manual two-user tests.

---

# 30 likely instructor questions

### 1. What happens if two users claim the same spot simultaneously?
**Answer:** `claim_spot` locks the spot row (`FOR UPDATE`). Only one transaction can insert the active claim; the unique index `claims_one_active_per_spot` backs this up. The loser gets a business error.  
**Files:** `supabase/migrations/20260819130000_prevent_seeker_reclaim.sql`, initial schema uniques.

### 2. Why is this logic in PostgreSQL rather than only React?
**Answer:** React can be bypassed or raced. Postgres transactions, locks, and constraints enforce integrity for every client.  
**Files:** claim/complete migrations; `src/actions/claims.ts` only orchestrates.

### 3. What does RLS protect?
**Answer:** Which rows a JWT can SELECT/INSERT/UPDATE directly. Example: you can read your profile, not others’; claims visible to participants.  
**Files:** `20260802111257_auth_profile_and_rls.sql` (+ later policy updates).

### 4. Difference between authentication and authorization?
**Answer:** AuthN = prove identity (Supabase login). AuthZ = permission checks (RLS, RPC owner/seeker checks, vehicle gates). AuthN does not prove unique human identity.  
**Files:** `src/proxy.ts`, RPCs, `vehicle-access.ts`.

### 5. Why use an RPC?
**Answer:** Multi-table atomic operations with shared rules that RLS single-row updates can’t express safely.  
**Files:** `claim_spot`, `complete_claim`.

### 6. How do credits stay consistent?
**Answer:** Moved only in `complete_claim` with ledger inserts; unique debit/credit per claim; profile balance updated in same transaction; clients can’t UPDATE credits column.  
**Files:** complete_claim migrations; initial `credit_transactions` uniques.

### 7. What if a request is retried?
**Answer:** Completion is designed to be idempotent if already completed with consistent ledger. Start handoff now is idempotent once started (no timer reset).  
**Files:** complete_claim; `start_handoff_now` in `20260819140000`.

### 8. What if the browser closes during a handoff?
**Answer:** State remains in DB. On return, RSC loads open spot/claim; expire/reconcile RPCs can advance due timers.  
**Files:** `src/app/map/page.tsx`, `src/app/spots/new/page.tsx`, `reconcile-claim.ts`.

### 9. How does Realtime interact with the database?
**Answer:** Clients subscribe to table changes / broadcast topics. DB writes are authoritative; Realtime is a notification channel. Missed events → refresh.  
**Files:** `src/lib/realtime/*`, discovery hooks.

### 10. Which part fails first at large scale?
**Answer:** Likely non-spatial discovery loading many available spots + Realtime fan-out—before claim RPC CPU.  
**Files:** `src/app/map/page.tsx`; `04-scale.md`.

### 11. What security vulnerability still exists?
**Answer:** Colluding accounts can complete handoffs to move credits; GPS spoofing can fake claim distance; no proximity required to complete; multi-account farming is not strongly prevented at application level.  
**Files:** `05-security.md`; `complete_claim`.

### 12. What would you redesign for 100,000 users?
**Answer:** Spatial discovery (PostGIS), rate limits, maybe expiry workers, possibly cache discovery; keep claim atomicity in DB.  
**Files:** `04-scale.md`.

### 13. Does claiming debit a credit?
**Answer:** No. Claim only checks balance ≥ 1. Debit happens on successful complete.  
**Files:** `claim_spot`, `complete_claim`.

### 14. What does I’m leaving now do without a seeker?
**Answer:** Converts listing to a live Now-style window: still `available`, sets `handoff_started_at`, `expires_at = now+3m`. Does not expire immediately.  
**Files:** `20260819140000_unclaimed_early_start_live_window.sql`.

### 15. What if the publisher never presses I’m leaving now?
**Answer:** Claimed spots auto-start at `available_at`. Unclaimed spots expire at `available_at`.  
**Files:** `20260818220000`, `auto_start_claimed_handoff_if_due`.

### 16. Can the seeker reclaim after releasing?
**Answer:** Not the same spot after voluntary seeker cancel (`ALREADY_RELEASED_THIS_SPOT`).  
**Files:** `20260819130000`.

### 17. Who verifies the handoff?
**Answer:** Publisher verifies seeker’s plate last-2 digits.  
**Files:** `20260818170000`, `CompleteHandoffForm`.

### 18. Are vehicle photos uploaded by users?
**Answer:** Not currently. Feature was removed; CarImages catalog + generic fallback.  
**Files:** `20260818200000_drop_vehicle_photos.sql`, `carimages.ts`.

### 19. Is there a spoken verification code?
**Answer:** Not in product UX. Dormant code path remains as legacy detail; attempt lock uses `claim_handoff_secrets`.  
**Files:** `20260818120000`.

### 20. How is map distance enforced?
**Answer:** Haversine ≤ 1500 m inside `claim_spot`; client mirrors for UX.  
**Files:** `src/lib/map/distance.ts`, claim migration.

### 21. Why MapLibre instead of Leaflet as the primary story?
**Answer:** Seeker experience uses MapLibre + MapTiler. Leaflet remains in some legacy/alternate components.  
**Files:** `BaseMap.tsx`, `ParkingMap.tsx`.

### 22. How does History pagination work?
**Answer:** Keyset via `get_handoff_history` with page size 20 (+1 for hasMore).  
**Files:** `src/lib/history/load-history.ts`.

### 23. What is the publishable key vs service role?
**Answer:** Publishable key is public, RLS applies. Service role bypasses RLS and must stay on server/Edge only.  
**Files:** `.env.example`, Edge functions.

### 24. How do you prevent two open listings per publisher?
**Answer:** Partial unique index `parking_spots_one_open_per_owner` on owner while status available/claimed.  
**Files:** initial schema.

### 25. What tests did you write?
**Answer:** Vitest unit/component/action tests and migration contract tests (~1414). No Playwright project. Manual two-user E2E. SQL-text contracts ≠ live concurrency suite.  
**Files:** `package.json`, `03-test-plan.md`.

### 26. How do cancellation reasons work?
**Answer:** Required machine-readable reasons differ for seeker vs publisher; stored on cancel. No free-text requirement in the current MVP.  
**Files:** `20260819120000`, `cancellation-reasons.ts`.

### 27. Does extension reset the whole window to 5?
**Answer:** Adds up to 2 minutes once, capped at `handoff_started_at + 5 minutes`. Only meaningful once a seeker is claimed and the live window has started.  
**Files:** `extend_handoff_wait`, `constants.ts`.

### 28. What happens on wrong plate digits?
**Answer:** Attempt count increments; after 3, temporary lock (~2 minutes); no credit movement.  
**Files:** `complete_claim` plate migrations.

### 29. Are live coordinates stored in the database?
**Answer:** Web path is Broadcast-primary. Native/Edge path may upsert an ephemeral latest snapshot in `claim_live_locations` (one row per claim, deleted on terminal). Not a route history. Do not say “never stored.”  
**Files:** `20260817140000_claim_live_locations_snapshot.sql`, location hooks, Edge function.

### 30. If you had one more week, what would you improve?
**Answer:** Spatial discovery and stronger anti-abuse / unique-identity controls—not inventing payments as the main technical next step.  
**Files:** `04-scale.md`, `05-security.md`.

---

# Repository references

- `docs/final-submission/02-technical-design.md`
- `docs/final-submission/05-security.md`
- `src/actions/claims.ts`, `src/actions/spots.ts`
- `src/lib/spots/constants.ts`
- `src/lib/location/*`
- `src/proxy.ts`
- `supabase/migrations/` (especially initial schema, claim_spot, complete_claim, start_handoff_now, cancellation, reclaim, live-location snapshot)
