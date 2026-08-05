# Switch It – Test Plan

Student MVP test plan for the RUNI Internet Technologies final assignment.
Aligned with `PROJECT_CONTEXT.md`, `docs/PRODUCT_SPEC.md`,
`docs/TECHNICAL_DESIGN.md`, and the current application (auth, publish, map,
claim, complete, cancel, lazy expiry, profile, countdown, two-mode UX).

**Status:** Active student MVP plan. Automated coverage today is Vitest unit and
component tests. Critical database behaviors (`complete_claim`, credit
transfer, idempotency, cancel, expiry, RLS, races) are verified with
**documented SQL/manual checks** against a non-production Supabase project.
A dedicated automated Supabase integration environment (service-role fixtures,
`.env.test.local`, CI integration jobs) is a **future improvement**, not
required for the current MVP.

---

## 1. Testing goals

1. Prove the core handoff loop: register/login → publish → claim → complete.
2. Prove credit rules: start at 5; transfer exactly once on complete; never on
   claim, cancel, or expire.
3. Prove concurrency and authorization: one open spot per owner, one active
   claim per spot/seeker, no self-claim, RLS and column grants.
4. Prove lazy expiry restores or expires spots without credit side effects.
5. Keep scope realistic for a student MVP: business-critical paths first;
   skip exhaustive UI/visual coverage.

---

## 2. Test scope

### In scope

- Authentication (login, logout, protected routes; registration as practical)
- Parking publication and second-open-spot rejection
- Map listing of available non-expired spots
- Claim, complete, cancel claim, cancel spot, lazy expiry RPCs
- Credit balance and `credit_transactions` ledger rules
- Profile `display_name` update; credits/role immutability via client grants
- Zod validation for auth, spot, claim, profile inputs
- Critical forms/controls (pending, success, error)
- Playwright coverage of main browser flows with prepared users
- Documented SQL/manual concurrency and RLS checks

### Out of scope (for this MVP plan)

- Pixel-perfect UI, animation, Leaflet pan/zoom polish
- Full Activity/History feature (page is still a stub)
- Two-mode UX cosmetics (localStorage presentation only)
- Load/performance testing, real payments, push/email product flows
- Mandatory Playwright coverage of email-confirmation SMTP

### Tooling (current MVP vs later)

| Layer | Tool | Current MVP |
|-------|------|-------------|
| Unit | Vitest | Required / implemented for schemas and helpers |
| Component | React Testing Library + Vitest | Required / implemented for focused forms |
| Integration (automated vs Supabase) | Future improvement | **Not required** for current MVP |
| Concurrency / RPC / credits | Documented SQL + manual | **Required** (see §26) |
| E2E | Playwright | Optional later |
| RLS / constraints | SQL / manual matrix | Documented; run manually for demo readiness |

Do **not** treat a dedicated automated Supabase test harness as blocking for
this course MVP.

---

## 3. Test case template

Every case below uses:

| Field | Meaning |
|-------|---------|
| **Name** | Short unique title |
| **Level** | Unit / Component / Integration / E2E / Manual / SQL |
| **Preconditions** | Accounts, data, env assumptions |
| **Actions** | Steps to perform |
| **Expected** | Observable outcomes |
| **Priority** | P0 (must), P1 (should), P2 (nice) |

---

## 4. Highest-priority automated tests (P0)

These eleven cases are the minimum automated bar (lazy expiry included as P0).
Cosmetic form tests are P1/P2 and may be deferred.

| ID | Name | Level |
|----|------|-------|
| P0-01 | Login success and protected-route redirect | E2E |
| P0-02 | Publish spot succeeds for eligible owner | Integration / E2E |
| P0-03 | Second open spot from same owner rejected | Integration |
| P0-04 | Other user claims available spot; no credit change | Integration / E2E |
| P0-05 | Self-claim rejected | Integration |
| P0-06 | Double claim on same spot: only one active claim | Integration (+ SQL race doc) |
| P0-07 | Complete handoff transfers exactly one credit once | Integration |
| P0-08 | Complete idempotent replay does not double-transfer | Integration |
| P0-09 | Cancel claim: statuses update; credits unchanged | Integration |
| P0-10 | Cancel spot: statuses update; credits unchanged | Integration |
| P0-11 | Lazy expiry: claim/spot transitions; credits unchanged | Integration |

---

## 5. Unit tests

### U-01 — Register schema rejects invalid input

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Run `registerSchema` with empty display name, bad email, short password |
| **Expected** | Parse fails with field messages; no network |
| **Priority** | P1 |

### U-02 — Login schema requires email and password

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Run `loginSchema` with missing password / invalid email |
| **Expected** | Parse fails |
| **Priority** | P1 |

### U-03 — Publish spot schema accepts presets and builds window

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | Fixed clock optional |
| **Actions** | Valid lat/lng + `available_in_minutes` in `{0,5,…,30}` |
| **Expected** | `expires_at` = `available_at` + grace minutes; address empty → null |
| **Priority** | P0 (supports publish correctness) |

### U-04 — Publish spot schema rejects bad coordinates / timing

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Lat 91; lng −200; `available_in_minutes` = 7 |
| **Expected** | Parse fails |
| **Priority** | P1 |

### U-05 — Claim/complete/cancel UUID schemas

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Pass non-UUID strings to claim/complete/cancel schemas |
| **Expected** | Parse fails |
| **Priority** | P1 |

### U-06 — Display name schema bounds

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Name length 1 and 51 vs valid 2–50 |
| **Expected** | Only valid length parses |
| **Priority** | P1 |

### U-07 — Safe redirect helper

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Feed `getSafeRedirectPath` with `/map`, `//evil`, `https://evil`, relative ok paths |
| **Expected** | Only same-origin relative paths accepted; else default `/map` |
| **Priority** | P1 |

### U-08 — Mode storage key is per user

| Field | Content |
|-------|---------|
| **Level** | Unit |
| **Preconditions** | None |
| **Actions** | Build key for two user ids |
| **Expected** | Keys `switch-it:mode:<id>` differ; no shared global key |
| **Priority** | P2 |

---

## 6. Component tests

### C-01 — Login form shows validation / auth error

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Mock Server Action |
| **Actions** | Submit empty or failed login |
| **Expected** | Error/field UI visible; button pending while submitting |
| **Priority** | P1 |

### C-02 — Publish form primary CTA and field errors

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Mock `publishSpot` |
| **Actions** | Submit without coords; then valid path |
| **Expected** | Field errors; pending “Sharing…”; no dual form+status (page-level) |
| **Priority** | P1 |

### C-03 — Claim button human copy and success

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Mock `claimSpot` success |
| **Actions** | Click “I’m on my way” |
| **Expected** | Pending then success “You’re on your way” |
| **Priority** | P1 |

### C-04 — Complete and cancel claim buttons

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Mock actions |
| **Actions** | Trigger “Verify and complete” and “I’m no longer coming” |
| **Expected** | Correct pending/success/error; cancel is visually secondary |
| **Priority** | P1 |

### C-05 — Countdown pending vs ready

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Fake timers |
| **Actions** | Render with future then past `targetIso` |
| **Expected** | Shows remaining time then “Available now” ready styling; never negative |
| **Priority** | P1 |

### C-06 — Profile display name form

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Mock update action |
| **Actions** | Submit too-short name; then valid name |
| **Expected** | Validation message; success path calls action with trimmed name |
| **Priority** | P2 |

---

## 7. Integration tests

Split into:

1. **Automated integration** against a dedicated Supabase **test** project
   (migrations applied; email confirmation disabled or bypassed for setup).
2. **Documented SQL/manual concurrency** for true simultaneous claims (see
   §12 and §22).

### I-01 — Signup trigger grants 5 credits and ledger row

| Field | Content |
|-------|---------|
| **Level** | Integration (test project) |
| **Preconditions** | Test project; confirmation disabled **or** admin-created user + trigger path |
| **Actions** | Create auth user with display name metadata |
| **Expected** | `profiles.credits = 5`, `role = 'user'`; one `initial_grant` transaction amount +5 |
| **Priority** | P0 |

### I-02 — Publish spot inserts available row

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Authenticated owner A; no open spot |
| **Actions** | Insert via app action or authenticated client matching publish rules |
| **Expected** | Spot `status = available`; visible to others while `expires_at > now()` |
| **Priority** | P0 (P0-02) |

### I-03 — Second open spot rejected

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Owner A already has `available` or `claimed` spot |
| **Actions** | Attempt second insert |
| **Expected** | Unique index / error; only one open spot remains |
| **Priority** | P0 (P0-03) |

### I-04 — Claim by other user; no credit movement

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Owner A has available spot; seeker B has ≥1 credit, no active claim |
| **Actions** | B calls `claim_spot` |
| **Expected** | Claim `active`; spot `claimed`; A and B credits unchanged; no handoff txs |
| **Priority** | P0 (P0-04) |

### I-05 — Self-claim rejected

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Owner A’s available spot |
| **Actions** | A calls `claim_spot` on own spot |
| **Expected** | Stable error (e.g. `SELF_CLAIM`); spot still `available` |
| **Priority** | P0 (P0-05) |

### I-06 — Sequential second claim rejected

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Spot already `claimed` by B |
| **Actions** | User C calls `claim_spot` |
| **Expected** | Failure (`SPOT_UNAVAILABLE` / unique); B remains sole active claim |
| **Priority** | P0 (P0-06 sequential half) |

### I-07 — Complete transfers exactly one credit

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim: seeker B, owner A; B credits ≥1 |
| **Actions** | B calls `complete_claim` once |
| **Expected** | Claim/spot `completed`; B −1; A +1; exactly one `handoff_debit` (−1) and one `handoff_credit` (+1) for that `claim_id` |
| **Priority** | P0 (P0-07) |

### I-08 — Complete idempotent replay

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Claim already completed with valid ledger |
| **Actions** | B calls `complete_claim` again |
| **Expected** | Success with `already_completed`; balances and tx counts unchanged |
| **Priority** | P0 (P0-08) |

### I-09 — Cancel claim without credit changes

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim by B; spot still within `expires_at` |
| **Actions** | B calls `cancel_claim`; snapshot credits before/after |
| **Expected** | Claim `cancelled` + `cancelled_at`; spot `available`; credits and ledger unchanged |
| **Priority** | P0 (P0-09) |

### I-10 — Cancel spot without credit changes

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | (a) available spot; (b) claimed spot with active claim |
| **Actions** | Owner calls `cancel_spot` in each setup |
| **Expected** | Spot `cancelled`; active claim cancelled if present; credits unchanged |
| **Priority** | P0 (P0-10) |

### I-11 — Lazy expiry: due claim, spot still valid

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim with `claim.expires_at <= now()`; `spot.expires_at > now()`; known credit snapshot |
| **Actions** | Participant calls `expire_claim_if_needed` |
| **Expected** | Claim `expired`; spot `available`; `changed = true`; no credit/tx changes |
| **Priority** | P0 (P0-11) |

### I-12 — Lazy expiry: due claim, spot also past expiry

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim due; `spot.expires_at <= now()` |
| **Actions** | Call `expire_claim_if_needed` |
| **Expected** | Claim `expired`; spot `expired`; no credit changes |
| **Priority** | P0 (P0-11) |

### I-13 — Lazy expiry: active claim not due is no-op

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim with `expires_at > now()` |
| **Actions** | Call `expire_claim_if_needed` |
| **Expected** | Statuses unchanged; `changed = false`; credits unchanged |
| **Priority** | P1 |

### I-14 — Lazy expiry: terminal claim is safe no-op

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Claim already `completed` / `cancelled` / `expired` |
| **Actions** | Call `expire_claim_if_needed` as seeker or owner |
| **Expected** | No status flip; `changed = false`; credits unchanged |
| **Priority** | P1 |

### I-15 — Profile display_name update allowed

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Authenticated user |
| **Actions** | Update own `display_name` via app or granted column update |
| **Expected** | Name changes; credits and role unchanged |
| **Priority** | P0 |

### I-16 — Direct credits/role update blocked

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Authenticated user session (anon key), not service role |
| **Actions** | Attempt `update profiles set credits = 999` and `role` change |
| **Expected** | Update fails or columns unchanged (column grant + RLS) |
| **Priority** | P0 |

---

## 8. End-to-end tests (Playwright)

Use **prepared test users** in the test project. Do **not** require full
email-confirmation SMTP as a mandatory E2E. Registration E2E is optional when
confirmation is disabled in the test project; otherwise document registration
manually (§8 / §21).

### E-01 — Login and reach protected map

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Prepared user; app against test project |
| **Actions** | Open `/login`; sign in; visit `/map` |
| **Expected** | Authenticated shell; mode chooser or map content; no redirect loop |
| **Priority** | P0 (P0-01) |

### E-02 — Unauthenticated access redirects to login

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Logged out |
| **Actions** | Visit `/map`, `/profile`, `/spots/new` |
| **Expected** | Redirect to login (or auth gate); no private data flash |
| **Priority** | P0 |

### E-03 — Owner publishes; seeker claims; seeker completes

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Users A (owner) and B (seeker); A has no open spot; B has credits |
| **Actions** | A shares spot → B “I’m on my way” → B enters owner handoff code and completes; check profiles |
| **Expected** | End states completed; B credits −1; A +1 vs start-of-flow snapshots |
| **Priority** | P0 |

### E-04 — Cancel claim from map UI

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Active claim as B |
| **Actions** | “I’m no longer coming”; reload profile credits |
| **Expected** | Claim gone from UI; credits unchanged |
| **Priority** | P1 |

### E-05 — Cancel published spot from leaver home

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | A has open spot on `/spots/new` |
| **Actions** | “This spot is no longer available” |
| **Expected** | Form returns (no open spot); credits unchanged |
| **Priority** | P1 |

### E-06 — Logout returns to public landing

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Logged in |
| **Actions** | Logout |
| **Expected** | Session cleared; `/map` requires login again |
| **Priority** | P1 |

### E-07 — Optional registration when confirmation disabled

| Field | Content |
|-------|---------|
| **Level** | E2E (optional) |
| **Preconditions** | Test project with email confirm disabled |
| **Actions** | Register new user |
| **Expected** | Session or immediate usability; profile credits 5 |
| **Priority** | P2 |

---

## 9. Manual tests

### M-01 — Mode chooser and per-user preference

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Two browser profiles or clear storage |
| **Actions** | First login → chooser; pick Find vs Share; switch Looking/Leaving; login as other user |
| **Expected** | Preference key per user id; switch navigates `/map` or `/spots/new`; logout does not clear preference |
| **Priority** | P1 |

### M-02 — Map marker bottom card

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Available spots on map |
| **Actions** | Tap marker on mobile width |
| **Expected** | Bottom card: address, countdown, “I’m on my way”, close; no distance/nav |
| **Priority** | P2 |

### M-03 — History stub

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Logged in |
| **Actions** | Open `/history` via URL |
| **Expected** | “Activity” stub loads; not in main nav |
| **Priority** | P2 |

### M-04 — Demo walkthrough script

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Two accounts |
| **Actions** | Full publish → claim → complete narrative for course demo |
| **Expected** | Matches product copy and credit outcome |
| **Priority** | P0 (demo readiness) |

---

## 10. Authentication tests

### A-01 — Login success (prepared user)

| Field | Content |
|-------|---------|
| **Level** | E2E / Manual |
| **Preconditions** | Known test credentials |
| **Actions** | Sign in |
| **Expected** | Authenticated cookies/session; access to product routes |
| **Priority** | P0 |

### A-02 — Login failure

| Field | Content |
|-------|---------|
| **Level** | E2E / Component |
| **Preconditions** | None |
| **Actions** | Wrong password |
| **Expected** | Friendly error; still logged out |
| **Priority** | P1 |

### A-03 — Logout

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Logged in |
| **Actions** | Logout |
| **Expected** | Cannot access `/map` without signing in again |
| **Priority** | P1 |

### A-04 — Registration (test project policy)

| Field | Content |
|-------|---------|
| **Level** | Integration / Manual / optional E2E |
| **Preconditions** | Prefer confirmation **disabled** on test project; if SMTP required, run manually |
| **Actions** | Create account with display name |
| **Expected** | Profile row + 5 credits + `initial_grant`; not a mandatory Playwright SMTP test |
| **Priority** | P1 |

### A-05 — Protected routes

| Field | Content |
|-------|---------|
| **Level** | E2E |
| **Preconditions** | Logged out |
| **Actions** | Hit `/map`, `/spots/new`, `/profile`, `/history` |
| **Expected** | Redirect/login gate |
| **Priority** | P0 |

---

## 11. Authorization and RLS tests

Run primarily as **SQL / authenticated client** against the test project.

### R-01 — Profiles: select own only

| Field | Content |
|-------|---------|
| **Level** | SQL / Integration |
| **Preconditions** | Users A and B |
| **Actions** | As A, select B’s profile by id |
| **Expected** | No row (or empty) |
| **Priority** | P0 |

### R-02 — Profiles: cannot raise credits via client update

| Field | Content |
|-------|---------|
| **Level** | SQL / Integration |
| **Preconditions** | User A session |
| **Actions** | `update profiles set credits = credits + 10 where id = A` |
| **Expected** | Blocked or credits unchanged (see column grants) |
| **Priority** | P0 |

### R-03 — Parking spots: others see only available non-expired

| Field | Content |
|-------|---------|
| **Level** | SQL / Integration |
| **Preconditions** | A owns claimed/completed/expired spots; one available |
| **Actions** | As B, select all spots |
| **Expected** | Sees available non-expired (and not A’s private terminal rows unless policy allows own-only) |
| **Priority** | P1 |

### R-04 — Claims: visible to seeker or spot owner only

| Field | Content |
|-------|---------|
| **Level** | SQL / Integration |
| **Preconditions** | Claim between A and B |
| **Actions** | As unrelated C, select that claim |
| **Expected** | Not visible |
| **Priority** | P1 |

### R-05 — Credit transactions: select own only

| Field | Content |
|-------|---------|
| **Level** | SQL / Integration |
| **Preconditions** | A and B have txs |
| **Actions** | As A, read B’s transactions |
| **Expected** | Not visible |
| **Priority** | P1 |

### R-06 — RPC authorization errors

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Mismatched callers |
| **Actions** | Non-seeker `complete_claim` / `cancel_claim`; non-owner `cancel_spot`; stranger `expire_claim_if_needed` |
| **Expected** | `NOT_SEEKER` / `NOT_OWNER` / `NOT_HANDOFF_PARTICIPANT` (or mapped friendly errors); no state change |
| **Priority** | P0 |

### R-07 — Anon cannot execute business RPCs

| Field | Content |
|-------|---------|
| **Level** | SQL / Integration |
| **Preconditions** | Anon key, no session |
| **Actions** | Call `claim_spot` / `complete_claim` / cancel / expire |
| **Expected** | Permission denied / `NOT_AUTHENTICATED` |
| **Priority** | P1 |

---

## 12. Database constraint tests

### D-01 — One open spot per owner

| Field | Content |
|-------|---------|
| **Level** | SQL |
| **Preconditions** | Owner with open spot |
| **Actions** | Insert second `available`/`claimed` spot |
| **Expected** | Unique violation on `parking_spots_one_open_per_owner` |
| **Priority** | P0 |

### D-02 — One active claim per spot

| Field | Content |
|-------|---------|
| **Level** | SQL |
| **Preconditions** | Active claim on spot |
| **Actions** | Insert second `active` claim same `spot_id` |
| **Expected** | Unique violation `claims_one_active_per_spot` |
| **Priority** | P0 |

### D-03 — One active claim per seeker

| Field | Content |
|-------|---------|
| **Level** | SQL |
| **Preconditions** | Seeker already has active claim |
| **Actions** | Insert another active claim for same seeker |
| **Expected** | Unique violation `claims_one_active_per_seeker` |
| **Priority** | P0 |

### D-04 — One handoff debit and credit per claim

| Field | Content |
|-------|---------|
| **Level** | SQL |
| **Preconditions** | Completed claim with ledger rows |
| **Actions** | Insert duplicate debit/credit for same `claim_id` |
| **Expected** | Unique violations on partial indexes |
| **Priority** | P0 |

### D-05 — Credits non-negative CHECK

| Field | Content |
|-------|---------|
| **Level** | SQL |
| **Preconditions** | Service or elevated role only for negative attempt |
| **Actions** | Set credits to −1 |
| **Expected** | CHECK failure |
| **Priority** | P2 |

### D-06 — Spot window CHECK `expires_at > available_at`

| Field | Content |
|-------|---------|
| **Level** | SQL |
| **Preconditions** | None |
| **Actions** | Insert spot with `expires_at <= available_at` |
| **Expected** | CHECK failure |
| **Priority** | P2 |

---

## 13. Parking publication tests

### P-01 — Happy-path publish

| Field | Content |
|-------|---------|
| **Level** | Integration / E2E |
| **Preconditions** | Owner with no open spot |
| **Actions** | Publish with location + leave preset |
| **Expected** | Spot available; leaver home shows status card not form; redirect stays `/spots/new` |
| **Priority** | P0 |

### P-02 — Reject second open spot

| Field | Content |
|-------|---------|
| **Level** | Integration / E2E |
| **Preconditions** | Owner already published |
| **Actions** | Publish again |
| **Expected** | Error “already have an active parking spot” (or equivalent); DB unchanged count |
| **Priority** | P0 |

### P-03 — Available spots appear for others

| Field | Content |
|-------|---------|
| **Level** | E2E / Integration |
| **Preconditions** | A published available spot |
| **Actions** | B opens `/map` |
| **Expected** | Spot listed/claimable; A may see own-spot notice in seeker mode |
| **Priority** | P0 |

---

## 14. Claim race-condition tests

### CR-01 — Automated sequential double claim

| Field | Content |
|-------|---------|
| **Level** | Integration (test project) |
| **Preconditions** | Available spot; users B and C |
| **Actions** | B claims successfully; C claims same id |
| **Expected** | Only B active; C error |
| **Priority** | P0 |

### CR-02 — Documented simultaneous claim (SQL/manual)

| Field | Content |
|-------|---------|
| **Level** | SQL / Manual concurrency |
| **Preconditions** | Two authenticated sessions; same `spot_id`; script or two SQL clients calling `claim_spot` at once (or `pg_sleep` barrier) |
| **Actions** | Fire both RPCs concurrently |
| **Expected** | Exactly one active claim; one success; one failure; spot `claimed`; no double credit effects |
| **Priority** | P0 (documented; not flaky Playwright) |

### CR-03 — Self-claim

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Own available spot |
| **Actions** | Claim own spot |
| **Expected** | Rejected; spot remains available |
| **Priority** | P0 |

### CR-04 — Insufficient credits at claim

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Seeker with 0 credits (fixture via service role in **test** project only) |
| **Actions** | Claim |
| **Expected** | `INSUFFICIENT_CREDITS`; no claim row |
| **Priority** | P1 |

### CR-05 — Seeker already has active claim

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Seeker holding another active claim |
| **Actions** | Claim second spot |
| **Expected** | `ACTIVE_CLAIM_EXISTS` (or unique); first claim unchanged |
| **Priority** | P1 |

---

## 15. Completion and credit-transfer tests

### CC-01 — Exact single transfer

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active eligible claim |
| **Actions** | `complete_claim` once |
| **Expected** | −1 seeker, +1 owner; one debit + one credit tx; statuses `completed` |
| **Priority** | P0 |

### CC-02 — Idempotent second complete

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Already completed with consistent ledger |
| **Actions** | Complete again |
| **Expected** | No second txs; balances stable; `already_completed` |
| **Priority** | P0 |

### CC-03 — Non-seeker cannot complete

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim |
| **Actions** | Owner or stranger calls `complete_claim` |
| **Expected** | `NOT_SEEKER`; no credit change |
| **Priority** | P0 |

### CC-04 — Inconsistent completed ledger surfaces error

| Field | Content |
|-------|---------|
| **Level** | Integration / SQL |
| **Preconditions** | Test-only broken fixture (completed claim missing tx) via service role |
| **Actions** | Seeker replays complete |
| **Expected** | `INCONSISTENT_COMPLETION_STATE` |
| **Priority** | P2 |

---

## 16. Cancellation tests

### X-01 — Cancel claim reopens live spot

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim; spot `expires_at > now()` |
| **Actions** | `cancel_claim` as seeker |
| **Expected** | Claim cancelled; spot available; credits unchanged |
| **Priority** | P0 |

### X-02 — Cancel claim when spot window ended

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Active claim; spot `expires_at <= now()` |
| **Actions** | `cancel_claim` |
| **Expected** | Claim cancelled; spot `expired`; credits unchanged |
| **Priority** | P1 |

### X-03 — Cancel claim idempotent for seeker

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Already cancelled by seeker |
| **Actions** | Cancel again |
| **Expected** | Idempotent success; credits unchanged |
| **Priority** | P1 |

### X-04 — Cancel available spot

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Owner available spot |
| **Actions** | `cancel_spot` |
| **Expected** | Spot cancelled; credits unchanged |
| **Priority** | P0 |

### X-05 — Cancel claimed spot cancels active claim

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Claimed spot + active claim |
| **Actions** | Owner `cancel_spot` |
| **Expected** | Spot and claim cancelled; credits unchanged |
| **Priority** | P0 |

### X-06 — Claimed spot without active claim is inconsistent

| Field | Content |
|-------|---------|
| **Level** | Integration / SQL |
| **Preconditions** | Test fixture: spot `claimed`, no active claim |
| **Actions** | `cancel_spot` |
| **Expected** | `INCONSISTENT_STATE` |
| **Priority** | P2 |

---

## 17. Lazy-expiry tests

### L-01 — Due claim → expired; spot still valid → available

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | See I-11 |
| **Actions** | `expire_claim_if_needed` |
| **Expected** | Claim expired; spot available; no credits/txs |
| **Priority** | P0 |

### L-02 — Due claim → expired; spot past window → expired

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | See I-12 |
| **Actions** | `expire_claim_if_needed` |
| **Expected** | Both expired; no credits/txs |
| **Priority** | P0 |

### L-03 — Map lazy cleanup then re-query

| Field | Content |
|-------|---------|
| **Level** | Manual / light E2E |
| **Preconditions** | Seed due active claim for current user |
| **Actions** | Load `/map` |
| **Expected** | No stale active-claim panel; publisher/seeker UI matches post-expiry DB |
| **Priority** | P1 |

### L-04 — Unrelated user cannot expire

| Field | Content |
|-------|---------|
| **Level** | Integration |
| **Preconditions** | Due claim; stranger session |
| **Actions** | Call expire RPC |
| **Expected** | `NOT_HANDOFF_PARTICIPANT` |
| **Priority** | P1 |

---

## 18. Validation tests

Covered primarily by **U-01–U-06**. Additional:

### V-01 — Server Action rejects invalid FormData

| Field | Content |
|-------|---------|
| **Level** | Integration / Component |
| **Preconditions** | Authenticated |
| **Actions** | Post publish/claim with garbage ids/coords |
| **Expected** | Friendly error; no partial DB writes |
| **Priority** | P1 |

---

## 19. Error-state tests

### ER-01 — RPC stable codes map to UI strings

| Field | Content |
|-------|---------|
| **Level** | Component / light Integration |
| **Preconditions** | Mock or force `SPOT_UNAVAILABLE`, `NOT_SEEKER`, etc. |
| **Actions** | Trigger actions |
| **Expected** | Known friendly messages; no raw stack traces |
| **Priority** | P1 |

### ER-02 — Empty map state

| Field | Content |
|-------|---------|
| **Level** | E2E / Manual |
| **Preconditions** | No available spots |
| **Actions** | Open `/map` |
| **Expected** | Empty copy + path to share a spot |
| **Priority** | P2 |

---

## 20. Responsive and accessibility checks

### RA-01 — Mobile layout smoke

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Phone width (~390px) |
| **Actions** | Mode chooser, nav menu, map bottom card, leaver status, claim panel |
| **Expected** | Usable tap targets; no clipped primary CTA; sky-blue bg visible |
| **Priority** | P1 |

### RA-02 — Keyboard and labels

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Desktop |
| **Actions** | Tab through login, publish, mode switcher |
| **Expected** | Focus visible; inputs labelled; mode group has accessible name |
| **Priority** | P1 |

### RA-03 — Contrast spot-check

| Field | Content |
|-------|---------|
| **Level** | Manual |
| **Preconditions** | Sky-blue theme |
| **Actions** | Check primary button text on accent; body text on `#DFF4FF` |
| **Expected** | Dark text readable; no white-on-light-sky primary text |
| **Priority** | P1 |

---

## 21. Browser geolocation fallback tests

### G-01 — Geolocation success (mocked)

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | Mock `navigator.geolocation` success |
| **Actions** | “Use my location” |
| **Expected** | Lat/lng fields filled |
| **Priority** | P1 |

### G-02 — Geolocation denied / unavailable

| Field | Content |
|-------|---------|
| **Level** | Component / Manual |
| **Preconditions** | Mock error or real deny |
| **Actions** | Request location |
| **Expected** | Warning; user can enter coordinates manually; publish still works |
| **Priority** | P1 |

### G-03 — API missing

| Field | Content |
|-------|---------|
| **Level** | Component |
| **Preconditions** | `geolocation` undefined |
| **Actions** | Click use location |
| **Expected** | Clear unsupported message |
| **Priority** | P2 |

---

## 22. Claim race documentation (SQL / manual)

True simultaneous claims are **not** required as Playwright tests.

**Suggested procedure (test project):**

1. Create available spot as owner A.
2. Open two authenticated SQL/API sessions as B and C.
3. Call `claim_spot(p_spot_id := …)` concurrently (script with threads or
   two `psql` sessions synchronized manually).
4. Assert exactly one `claims` row with `status = 'active'` for that spot;
   spot `status = 'claimed'`; loser receives error; credits unchanged for both.

Record the script and last run result in the course report or a short
`docs/` note when executed (optional; not required to exist now).

---

## 23. Regression checklist

Run before demo or production deploy:

- [ ] Login with prepared user; `/map` protected when logged out
- [ ] Publish one spot; second publish blocked
- [ ] Other user claims; self-claim blocked
- [ ] Complete once; credits move by 1; second complete safe
- [ ] Cancel claim; credits unchanged
- [ ] Cancel spot (available and claimed); credits unchanged
- [ ] Lazy expiry due claim → correct spot status; credits unchanged
- [ ] Profile rename works; credits/role unchanged after rename
- [ ] No service-role key in client env
- [ ] `npm run lint` and `npm run build` succeed

---

## 24. Test data and user accounts

For **manual / SQL** checks, use a non-production Supabase project (or the
course demo project), never production.

| Account | Role in tests | Notes |
|---------|---------------|-------|
| Owner (A) | Publisher / leaver | Known starting credits |
| Seeker (B) | Seeker | Known starting credits |
| Optional third user (C) | Race / authorization checks | Optional |

Do not commit passwords. A fully automated dedicated test project with
service-role keys is a **future improvement** (§26), not part of the current
MVP.

---

## 25. Definition of done

This MVP testing effort is done when:

1. **Automated unit + focused component tests** pass (`npm run test:run`,
   lint, build).
2. **Manual / SQL verification record** in §26 has been executed once on a
   non-production Supabase project (or equivalent demo environment) and
   checked off.
3. **Documented concurrent claim** procedure (CR-02) has been considered or
   run informally if time allows.
4. **Regression checklist** (§23) completed on a build candidate.
5. Registration is signed off manually or via optional E2E—SMTP confirmation
   is not a blocker.
6. No open P0 defects on credits, double claim, or unauthorized access.

Out of done scope for the **current** MVP:

- Dedicated automated Supabase integration project / service-role test env
- Full visual regression, History feature tests, exhaustive RLS fuzzing,
  production load tests

---

## 26. Manual / SQL verification record (current MVP)

Use two non-production accounts (owner A, seeker B) with **known starting
credit balances**. Prefer the app UI plus Supabase Table Editor / SQL for
ledger checks. Do **not** use production data.

Checklist (run before demo):

- [ ] Owner and seeker started with known balances (record both numbers).
- [ ] Seeker claimed the owner’s available spot (spot `claimed`, claim `active`).
- [ ] First `complete_claim` (seeker):
  - [ ] claim status → `completed`
  - [ ] parking spot status → `completed`
  - [ ] seeker lost **exactly 1** credit
  - [ ] owner gained **exactly 1** credit
  - [ ] exactly **one** `handoff_debit` (−1) for that claim
  - [ ] exactly **one** `handoff_credit` (+1) for that claim
- [ ] Repeated completion of the same claim did **not** transfer credits again
      (balances unchanged; still one debit and one credit row; idempotent
      success with `already_completed` or equivalent documented behavior).
- [ ] Cancel flows (cancel claim and/or cancel spot) caused **no** credit
      movement and no new handoff ledger rows.
- [ ] Expiry (`expire_claim_if_needed` / map lazy expiry) caused **no** credit
      movement and no handoff ledger rows.
- [ ] Handoff code (Phase 3):
  - [ ] Owner sees a 5-digit code only while spot is actively claimed.
  - [ ] Seeker cannot retrieve the code via `get_handoff_code`.
  - [ ] Wrong code does not move credits and increments attempts.
  - [ ] Fifth wrong attempt locks verification briefly.
  - [ ] Correct code completes once with exactly one debit and one credit.
  - [ ] Repeated completion is idempotent with no new ledger rows.
  - [ ] Code is unavailable after completion, cancellation, or expiry.

Related detailed cases remain in §§7, 11–17 (I-07/I-08, CC-*, X-*, L-*, R-*,
CR-*). Those stay **SQL/manual** for the current MVP.

## 27. Handoff verification code verification (Phase 3)

Use the SQL checklist in `supabase/tests/handoff_verification_code.test.sql`
after applying migration `20260805120000_handoff_verification_code.sql`.

Vitest migration assertions live in
`supabase/migrations/20260805120000_handoff_verification_code.migration.test.ts`.

Live RPC integration remains manual/SQL for the current MVP (see Appendix B).

### Future improvement (not required now)

Automated integration against a dedicated Supabase test project (publishable +
service-role env files, prepared/ephemeral users, Vitest `*.integration.test.ts`,
CI secrets) may be added later. It is **out of scope** for the current student
MVP deliverable.

---

## Appendix A — Mapping priorities to product flows

| Product flow | Primary cases |
|--------------|---------------|
| Register / login | A-01–A-05, E-01–E-02, I-01 |
| Publish | P-01–P-03, I-02–I-03 |
| Reject second open spot | I-03, D-01, P-02 |
| View available spots | P-03 |
| Prevent self-claim | I-05, CR-03 |
| Allow other user claim | I-04, E-03 |
| Prevent double claim | I-06, CR-01, CR-02, D-02 |
| Complete once + one credit | I-07, CC-01, E-03 |
| Cancel claim no credits | I-09, X-01 |
| Cancel spot no credits | I-10, X-04–X-05 |
| Expire stale claims/spots | I-11–I-12, L-01–L-02 |
| Unauthorized access | R-01–R-07 |
| Update display_name only | I-15 |
| Preserve credits/role | I-16, R-02 |

## Appendix B — Manual/SQL vs future automated integration

**Current MVP (required):** SQL/manual verification for `complete_claim`,
idempotency, credit transfer, cancel, expiry, RLS spot-checks, and claim
races (see §26 and CR-02). Unit + component Vitest coverage for pure logic and
focused UI.

**Future improvement (optional):** Dedicated Supabase test project with
automated integration tests, service-role fixtures, and ignored
`.env.test.local` secrets. Not required to complete the current MVP.

**Also remain manual:** M-* UX/demo, RA-* a11y/responsive, real-device
geolocation, SMTP registration if confirmation is enabled, mode localStorage
UX.
