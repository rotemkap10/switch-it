# Test specification — Switch It

QA / test plan for the course assignment.  
It describes what should be tested, what the repo already covers automatically, and what you should still verify manually.

**Test runner (actual):** Vitest + React Testing Library + jsdom.  
**Not a project test runner in `package.json`:** Playwright, Cypress, Jest.

Re-verified during this documentation pass:

```text
npx vitest run
→ 277 test files passed
→ 1744 tests passed

npx eslint .
→ exit 0

npm run build
→ Next.js 16.2.12 compiled successfully
```

Coverage labels:

- **Automated** — evidence in `*.test.ts(x)` / migration contract tests
- **Manual** — run with two accounts before submission
- **Missing / weak** — little or no automated proof

**Important honesty:** Migration tests that inspect SQL text are **not** the same as running true concurrent transactions against live PostgreSQL. Concurrent claim safety is **implemented in the database**; live multi-client verification is still useful.

---

# Testing strategy

| Layer | Tool | What it covers |
| --- | --- | --- |
| Unit / component | Vitest + Testing Library | UI components, helpers, action wrappers (often mocked Supabase) |
| Migration contract | Vitest reading SQL files | Asserts important SQL phrases exist in migrations |
| Live DB integration / true parallel concurrency | Not a first-class automated project suite | Use manual two-user races |
| Full browser E2E automation | **Not currently implemented** | Manual checklist |

---

# Authentication tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Register / login validation | Invalid input rejected | Automated |
| Password policy on register | Under 8 / missing upper/lower/digit/special rejected | Automated |
| Signup with Confirm email | No session → Check your email (neutral inbox copy + Sign in hint) | Automated |
| Obfuscated existing-email signup | Neutral Check your email; no false “account created” certainty | Automated |
| Explicit duplicate Auth error | “An account with this email already exists…” | Automated |
| Resend verification | Neutral delivery wording; unconfirmed users can still resend | Automated |
| Unconfirmed login | Friendly verify/resend state | Automated |
| Forgot password link on login | Navigates to `/forgot-password` | Automated |
| Forgot-password request | `resetPasswordForEmail` with `redirectTo` → `/auth/callback/recovery`; neutral Check your email; no email enumeration | Automated |
| Reset rate limit | Friendly “Too many attempts…” | Automated |
| Recovery callback | Reset email → `/auth/callback/recovery?code=…` → `exchangeCodeForSession` → `/auth/reset-password` (dedicated route; Supabase PKCE often drops `next` from `redirectTo`). Generic `/auth/callback` also treats `type=recovery` or preserved `next=/auth/reset-password` as recovery. Invalid/expired → `/forgot-password?error=reset` | Automated |
| Set new password | Shared policy + mismatch checks; `updateUser` then sign-out success | Automated |
| Recovery session on reset page | Authenticated recovery session stays on `/auth/reset-password` (not bounced to `/map` by proxy) | Automated |
| Protected routes redirect | Unauthenticated → `/login?next=` | Automated |
| Callback exchange (confirm) | Session established; onboarding-aware redirect | Partial automated; Manual recommended |
| Logout | Session cleared | Automated / Manual |

---

# Vehicle / profile tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Incomplete vehicle blocked from map/publish/claim | Redirect or `VEHICLE_PROFILE_REQUIRED` | Automated |
| Vehicle fields validation | Invalid plate/year rejected | Automated |
| Profile update | Display name / vehicle save | Automated / Manual |
| CarImages fallback | Generic illustration when unavailable | Automated UI tests |

---

# Publishing tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Publish Now | `handoff_started_at` set; `expires_at ≈ start + 3 minutes` | Automated helpers + Manual |
| Publish future (e.g. +5) | Unstarted; `expires_at ≈ available_at` | Automated helpers + Manual |
| One open spot per owner | Second open publish blocked | DB constraint; Manual |
| Cancel with structured reason | Terminal + reason stored; no credits | Automated + Manual |

---

# Discovery / map tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Available spots appear | `status = available` and `expires_at > now` | Automated discovery merge tests |
| Claimed pin removed / tombstone | Hidden for seekers | Automated |
| Realtime upsert after unclaimed I’m leaving now | Pin stays; `expires_at` updates | Automated |
| Initial map camera — trusted GPS over cache/default | Current trusted fix preferred over stale cache or Tel Aviv fallback (`resolve-initial-map-camera`) | Automated |
| Initial map camera — no Herzliya/Sokolov boot pin | Map does not start on old hardcoded development coordinates | Automated |
| Initial map camera — late GPS before interaction | If GPS arrives shortly after mount, map recenters only while the user has not panned/dragged | Automated (`ParkingMapMapLibre.geolocation.test.tsx`) |
| Initial map camera — user interaction wins | After manual pan/drag, a later GPS fix does not unexpectedly recenter the map | Automated |
| Initial map camera — lat/lng order | MapLibre `[lng, lat]` order preserved; swapped coordinates rejected as out of bounds | Automated |
| Initial map camera — Tel Aviv fallback | Safe Tel Aviv fallback used only when no better in-bounds location is available | Automated |
| Share a Spot — empty coordinate strings | Empty `latitude` / `longitude` strings must not be treated as `0,0`; publish blocked until a real location is set | Partial automated (UI `hasLocation` guard); Manual recommended |
| Share a Spot — late GPS vs manual pin | Fresh GPS must not overwrite an address selection or manual pin move | Automated (`PublishSpotForm.test.tsx`) |
| Map location providers | Android native and browser/PWA use different device location providers but share the same initial camera resolution logic | Automated helpers + Manual on real devices |
| Map without MapTiler key | Degraded | Manual |
| Primary map stack | MapLibre + MapTiler for seeker experience | Code inspection + Manual |

---

# Claim tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Successful claim nearby | Spot claimed; active claim created | Automated action mocks + Manual |
| Already claimed / race loser | Business error (e.g. spot unavailable) | Automated mapping + Manual |
| Simultaneous claims | Exactly one active claim | DB `FOR UPDATE` + unique index; Manual strongly recommended |
| Expired / past available unstarted | `SPOT_EXPIRED` | Automated / migration contract |
| Insufficient credits | Rejected; no debit | Automated + Manual |
| Active claim exists for seeker | Rejected | Automated + Manual |
| Self-claim | Rejected | Automated / Manual |
| Too far (>1500 m) | Rejected | Automated claim-distance tests + Manual |
| Same-seeker reclaim after voluntary release | `ALREADY_RELEASED_THIS_SPOT` | Migration + action tests + Manual |
| Claim into live Now / early-start window | Uses remaining `expires_at`; timer not reset | Migration contract + Manual |

---

# Timing tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Now listing | Live 3-minute claimable window | Automated helpers/UI + Manual |
| Future unclaimed at departure | Expires at `available_at` | Migration + Manual |
| Future claimed at departure | Auto-start 3-minute handoff | Migration + reconcile tests + Manual |
| I’m leaving now + existing claim | Starts claimed handoff from `now()`; 3-minute window | Automated start tests + Manual |
| I’m leaving now + no claim | Stays `available`; live window; claimable until `expires_at` | Migration `20260819140000` + Manual |
| Claim mid-window | Remaining time only | Countdown/render tests + Manual |
| +2 extension once | Caps at start + 5 minutes | Constants/extension tests + Manual |
| Double press I’m leaving now | Idempotent; no timer reset | Start action tests |

---

# Cancellation / release tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Seeker release before start | Claim cancelled; spot may reopen for others; releaser cannot reclaim same spot; no credits | Manual + reclaim tests |
| Seeker release after start | Exchange ends; no automatic relist; no credits | Manual |
| Publisher cancel with reason | Ends listing/exchange; structured reason; no credits | UI CancelSpotButton tests + Manual |

---

# Completion / verification tests

| Case | Expected | Coverage |
| --- | --- | --- |
| Only publisher can complete | Non-owner rejected (`NOT_OWNER`) | Automated + Manual |
| Correct seeker plate suffix | Completes; seeker −1 / publisher +1 once | Automated + Manual |
| Incorrect suffix | Attempts remaining; no credit move | Automated + Manual |
| 3 failures → cooldown | Locked ~2 minutes | Automated + Manual |
| Idempotent complete | Second successful call does not double-move credits | Automated complete tests |
| Complete while claimed but **before** live start and **before** `available_at` | `HANDOFF_NOT_STARTED` (auto-start only applies when due) | Manual |
| Complete while claimed and **due** (`now >= available_at`) but not yet started | Auto-start runs, then plate verification may proceed | Manual |

Current product path: **publisher verifies seeker last-2 plate digits**. Spoken 5-digit codes are **not** the product UX.

---

# Database tests

| Case | Coverage |
| --- | --- |
| Partial unique indexes for active claims / ledger | Migration SQL + contract tests |
| Status CHECKs | Schema migrations |
| RLS “own row / participants” | Documented in migrations; full live RLS suite not claimed as exhaustive automated coverage |
| RPC authorization (`auth.uid`) | Migration bodies; Manual with two users |
| Transactions / locking | Implemented in SQL; Manual race demos recommended |

---

# Permissions / security tests

| Case | Coverage |
| --- | --- |
| Cannot update another user’s profile | RLS; Manual |
| Cannot complete another user’s claim as non-owner | RPC; Automated mocks + Manual |
| Masked plate to counterpart | Counterpart vehicle RPC/UI; Automated + Manual |
| Anon cannot call privileged RPCs | Grants in migrations; Manual / SQL |
| `get_handoff_code` revoked from authenticated | Migration contract (`20260823100000`); Manual SQL |
| Live-location atomic rate limit (GPS + status) | Migration contract + algorithm regression tests; Edge Function contract tests |
| Broadcast only after DB accept | Edge Function contract tests |
| Auth redirect rejects open redirects | `safe-redirect.test.ts` |
| Baseline security headers | `security-hardening.test.ts` (reads `next.config.ts`) |
| Native/JS diagnostics do not log JWTs | Code review + logging key filters |

---

# History tests

| Case | Coverage |
| --- | --- |
| First page load | Automated load-history tests |
| Load more cursor | Automated |
| Only own terminal handoffs | Manual + RPC design |

---

# Error handling tests

| Case | Coverage |
| --- | --- |
| Business error toast mapping | Automated (`error-map`, claim button tests) |
| Route error boundary | Automated (`RouteErrorScreen.test.tsx`) |
| Stale chunk / failed dynamic import | One auto-reload then stop (`stale-client-build.test.ts`) |
| Unrelated exception does not auto-reload | Automated |
| Network failure | Manual |

---

# UI tests

Many component tests exist (sheets, countdown, publisher card, map carousel, nav, etc.).  
They do **not** replace a real-device GPS demo.

| Case | Expected | Coverage |
| --- | --- | --- |
| Header credits display | Same `profiles.credits`; hidden on auth routes | Automated (`HeaderCreditsBalance`, `header-credits-auth`) |
| Completion success overlay / return to map | Overlay at app root; refresh vs replace; map-ready dismiss | Automated |
| Terminal ended overlay | Cancel / release / expiry copy; no credit change | Automated |

---

# Edge cases (checklist)

- Browser refresh mid-handoff (state restores from DB).
- Offline page via service worker (PWA).
- Claim vs early-start near-simultaneous.
- Extension near hard cap.
- Publisher verifies wrong digits then succeeds after cooldown.
- Seeker with 0 credits.
- Second device Realtime lag then refresh.
- Live location permission denied (claim still exists; sharing degraded).
- Web live location: seeker posts via Edge Function `handoff-seeker-location`; publisher receives via private Broadcast + DB snapshot poll.
- Web foreground required for continuous GPS in browser tabs (see matrix below).
- Long-lived tab after a new Vercel deploy: one stale-chunk recovery reload, then the fatal page if still broken.
- Auth session refresh failure on resume: live location degrades; protected routes still require a session.
- Signup with an already-registered email (neutral Check your email; may receive no mail).
- Password-reset email must use `/auth/callback/recovery` (not rely on `next` surviving the Supabase PKCE redirect).
- Expired password-reset link → request a new reset link from `/forgot-password`.

---

# Manual end-to-end testing (two users)

Use two real accounts (A publisher, B seeker). Prefer physical devices with GPS.

### Setup
- [ ] Both accounts have complete vehicles and ≥1 credit.
- [ ] MapTiler + Supabase env configured.
- [ ] Latest migrations applied on the Supabase project.

### Core handoff (happy path)
- [ ] A publishes **Leaving in 2–5 minutes**.
- [ ] B sees pin; claims successfully.
- [ ] B opens navigation chooser.
- [ ] A presses **I’m leaving now** (or waits for auto-start).
- [ ] A sees B vehicle (masked plate); live location appears if GPS/permission allow.
- [ ] A extends once (optional).
- [ ] A enters **correct** last 2 digits → complete.
- [ ] Credits: B −1, A +1; both History updated.

### Negative / alternative
- [ ] Forgot password → reset email → `/auth/callback/recovery` → set new password → sign out → sign in (optional demo).
- [ ] Second seeker C cannot claim A’s already-claimed spot.
- [ ] B with 0 credits cannot claim.
- [ ] B too far cannot claim.
- [ ] B releases before start → spot can return for others; B cannot reclaim same spot.
- [ ] Wrong plate digits thrice → temporary lock (do this outside the presentation demo if possible).
- [ ] Unclaimed future listing expires at departure without I’m leaving now.
- [ ] Unclaimed **I’m leaving now** stays claimable for ~3 minutes.

---

# Web live-location compatibility matrix (manual — real devices)

**Roles:** Seeker (driver) **sends** GPS; Publisher (spot owner) **receives** marker.  
**Foreground target:** both users keep Switch It active in the browser tab.  
**Diagnostics:** filter console for `[switch-it:handoff-live]` (seeker) and `[switch-it:handoff-live-receiver]` (publisher). Never log JWTs.

| Case | Sender device/browser | Receiver device/browser | Publisher/seeker roles | GPS permission | Foreground result | Realtime result | Marker result | Background behavior | Resume behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **A** | Android Chrome (website) | iPhone Safari (website) | B seeker → A publisher | Both allow precise location | Seeker: `edge publish succeeded`; Publisher: `event received` | `SUBSCRIBED` on publisher | Car marker updates | iOS/Android suspend GPS/WS when tab hidden — marker ages to delayed/stale | Foreground again → watch + edge publish resume; publisher snapshot poll / broadcast |
| **B** | iPhone Safari (website) | Android Chrome (website) | B seeker → A publisher | Both allow | Same as A, roles reversed | Same | Same | Same | Same |
| **C** | iPhone Safari | iPhone Safari | B seeker → A publisher | Both allow | Same | Same | Same | iOS suspends background tab | Return to Switch It → sharing resumes |
| **D** | Android Chrome | Android Chrome | B seeker → A publisher | Both allow | Same | Same | Same | Chrome throttles background tab | Return to Switch It → sharing resumes |
| **A′** | iPhone Safari | Android Chrome | **A publisher → B seeker** (receive-only on A) | Both allow | Publisher receive path only on A; B must still send when seeker | Publisher on A subscribes; seeker on B edge-publishes | Marker on A | N/A for publisher send | N/A |

**Known browser limitations (not bugs):**
- Ordinary website tabs cannot guarantee GPS while user is in Waze/another app or after screen lock — native Android FGS remains the guaranteed background path.
- PWA installed vs browser tab: same web geolocation rules; installation is not required for foreground live location.

**Automated coverage (Vitest):** web runtime selects `navigator.geolocation` + Edge Function transport; native path unchanged; payload parser platform-independent; publisher snapshot poll while waiting; seeker watcher lifecycle; permission denied degradation.

---

## Current automated testing summary

| Metric | Value |
| --- | --- |
| Command | `npx vitest run` (also `npm run test:run`) |
| Framework | Vitest 4.x + Testing Library + jsdom |
| Test files | **277** |
| Tests | **1744** (all passing on this documentation pass) |
| ESLint | `npx eslint .` — pass (exit 0) |
| Production build | `npm run build` — pass (Next.js 16.2.12) |
| Playwright / Cypress project | **Not currently implemented** |

---

# Repository references

- `package.json`
- `src/**/*.test.ts(x)`
- `supabase/migrations/*.migration.test.ts`
- `src/actions/auth*.test.ts`, `src/lib/auth/auth-callback-handler.test.ts`
- `src/actions/claims*.test.ts`, `spots.start.test.ts`
- `src/lib/map/seeker-discovery-spots.test.ts`
- `src/lib/map/resolve-initial-map-camera.test.ts`
- `src/components/map/ParkingMapMapLibre.geolocation.test.tsx`
- `src/components/spots/PublishSpotForm.test.tsx`
- `src/lib/history/load-history.test.ts`
- `src/lib/feedback/error-map.ts`
- `src/lib/navigation/stale-client-build.test.ts`
- `src/components/shell/RouteErrorScreen.test.tsx`
- `src/lib/location/use-seeker-live-location-share.test.ts`
- `src/lib/realtime/use-realtime-invalidation.test.ts`
- `supabase/migrations/20260818210000_auto_start_handoff_at_departure.sql` (`HANDOFF_NOT_STARTED`)
