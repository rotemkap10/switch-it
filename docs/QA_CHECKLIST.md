# Switch It — Phase 11 QA Checklist

Concise two-user / three-user physical QA for production hardening.
Automated tests cover many races; this matrix covers real devices, GPS, and multi-tab behavior.

## Preflight

- [ ] Two authenticated accounts with complete vehicle profiles
- [ ] Third account optional (stale seeker)
- [ ] Both accounts have ≥1 credit (or reset via known test seed)
- [ ] Secure context (HTTPS or localhost)
- [ ] MapTiler key configured; maps load on both devices
- [ ] No service-role key in the browser Network tab / client bundle

---

## Scenario A — Successful handoff

**Publisher (A)**

1. Open Share a spot (`/spots/new`)
2. Recenter to current location (or pan pin)
3. Publish available in **2 minutes**
4. Confirm spot card + handoff countdown
5. After claim: see claimed UI, counterpart vehicle, handoff code
6. Observe seeker live location (if seeker shares)
7. Give 5-digit code verbally

**Seeker (B)**

1. Open Find parking (`/map`)
2. Recenter; confirm spots + carousel
3. Select A’s spot → claim (“I’m on my way”)
4. Share live location (permission granted)
5. Enter correct code → complete

**Verify**

- [ ] Spot: available → claimed → completed
- [ ] Claim: active → completed
- [ ] A credits **+1**; B credits **−1**
- [ ] Exactly one History card each (shared / found) with correct ±1
- [ ] Live location stops after complete (publisher map clears / ages out)
- [ ] Code no longer fetchable after complete
- [ ] No credit change toast implying transfer on claim alone

---

## Scenario B — Seeker cancel

1. A publishes (any short availability)
2. B claims
3. B cancels before deadline

**Verify**

- [ ] Spot returns toward available (or expires if past deadline per rules)
- [ ] Both see terminal / refreshed UI
- [ ] **No** credit change for either user
- [ ] History shows Cancelled · No credit change
- [ ] Live share stops after cancel

---

## Scenario C — Publisher cancel

1. A publishes; B claims
2. A cancels the spot / handoff

**Verify**

- [ ] B notified (realtime toast or refresh)
- [ ] Terminal state; B cannot complete
- [ ] **No** credit change
- [ ] History terminal for both participants

---

## Scenario D — Expiry

1. A publishes with short window; B claims
2. Wait past shared handoff deadline without completing

**Verify**

- [ ] Lazy expiry or countdown triggers terminal expired
- [ ] Complete with code fails cleanly
- [ ] **No** credit change
- [ ] History: Expired · No credit change

---

## Scenario E — Stale third seeker

1. A publishes; B claims successfully
2. **User C** still sees a stale available card (if possible) and taps claim

**Verify**

- [ ] C fails with friendly “no longer available” (not raw SQL)
- [ ] Map refreshes; stale card clears
- [ ] C does not get an active claim
- [ ] A/B handoff undisturbed

---

## Credits edge

- [ ] Seeker with **0 credits**: claim rejected with “You need at least one parking credit…”
- [ ] Claim button may still appear (DB is source of truth) — rejection must be clear
- [ ] Double-tap complete with correct code: second call idempotent (`already_completed`), no double ±1

---

## Recenter / geolocation

**Find parking + Share a spot**

- [ ] Control visible after map ready
- [ ] Granted: recenters without remounting map
- [ ] Denied / timeout: “Current location is unavailable.”; map still usable
- [ ] Duplicate clicks while pending do not stack requests
- [ ] Manual pan after recenter does not snap back

---

## Auth / navigation

- [ ] Logged out → `/map`, `/spots/new`, `/profile`, `/history` redirect to login
- [ ] Incomplete vehicle → onboarding (except documented handoff exceptions)
- [ ] Refresh on each protected route: no flash of wrong user’s data
- [ ] Back: Find → Profile → Back; Share → Profile → Back; History → Back
- [ ] Route loader does not stick after navigation
- [ ] Logout during active map: session cleared; no protected data remains

---

## Duplicate tabs (same account)

**Publisher**

- [ ] Publish in tab 1; tab 2 reflects claimed/cancel after refresh or realtime
- [ ] Cancel/complete in one tab; other tab does not diverge after refresh

**Seeker**

- [ ] Claim in tab 1; tab 2 cannot create a second active claim
- [ ] Cancel/complete propagates after refresh/realtime

---

## Privacy smoke

- [ ] Unrelated user cannot see handoff code UI
- [ ] Unrelated user cannot see counterpart vehicles
- [ ] History never shows codes, emails, counterpart IDs, or live coordinates
- [ ] Live Broadcast: unrelated account cannot subscribe to `claim-location:<uuid>`

---

## Map / PWA smoke

- [ ] MapUnavailable retry recovers after genuine failure
- [ ] Branded loaders do not stack awkwardly with map loader
- [ ] Attribution visible
- [ ] Reduced motion: camera jumps without long animation
- [ ] Offline shell / install prompts behave as before (no regression)

---

## Pass criteria

All Scenario A–E checks pass on at least one mobile + one desktop browser pair.
No raw Postgres / Supabase / MapLibre / stack traces shown to users.
