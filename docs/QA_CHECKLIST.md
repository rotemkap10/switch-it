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
3. Confirm leave slider is **0–10 min** (not 20); publish available in **2 minutes**
4. Confirm spot card countdown (initial grace **2 minutes** after departure)
5. After claim: **Your spot has been claimed**, stay-until-arrival instruction,
   remaining time, **Look for this vehicle** (photo or illustration), parking
   address or **Exact location marked on map**, handoff code. No Complete action.
6. Observe seeker live location (**Waiting for driver location** /
   **Driver location live** + **Updated just now** / **Location update delayed** /
   **Live location paused** / **Live location temporarily unavailable**).
   Optional **Driver is about N m away** / **Driver is nearby** is
   informational only. Last-known marker stays visible while delayed/paused.
   **Web/PWA:** Opening Waze/Google/Apple may pause sharing; hint **Live
   location paused while the driver is navigating** is expected. Sharing
   resumes when Switch It returns to the foreground.
   **Native iOS/Android:** Opening Waze/Google/Apple must **not** pause.
   Publisher should stay on **Driver location live** / **Updated just now**
   as native updates arrive. Android shows a persistent notification:
   “Switch It — Sharing location for active parking handoff”.
7. Optionally **Wait N more min** (truthful label; never past 5-minute hard cap)
8. Give 5-digit code verbally when you meet

**Seeker (B)**

1. Open Find parking (`/map`)
2. Recenter; confirm spots + carousel
3. Select A’s spot → claim (“I’m on my way”); note non-guarantee helper
4. After claim success, navigation chooser appears immediately (Waze / Google Maps /
   Apple Maps). **Dismiss** keeps the claim active. Do not auto-open Waze.
5. Choosing Waze / Google / Apple starts live location (native permission if needed).
   Denied permission still opens navigation; claim stays active (**Live location off**).
6. After a provider is chosen, the giant Open in CTA is gone; use **Waze · Change**
   (or **Navigate to spot** if dismissed) to reopen the chooser.
7. Return from Waze; claim still active.
   **Web/PWA:** Live location resumes if Switch It is foregrounded again.
   Pause while navigating is expected, not a defect.
   **Native:** tracking never stopped; returning to Switch It must not start
   a second GPS stream.
8. Reload `/map` with the active claim: chooser does **not** auto-open again
9. Confirm the active-claim sheet: remaining time, **Navigate to spot**,
   parking address or **Exact location marked on map**, optional distance,
   compact destination preview, leaving-driver vehicle (photo or illustration),
   live-location status, then Complete / Cancel. Near the spot, status may
   become **You’re close to the parking spot** — never auto-complete.
10. When safely stopped, enter correct code → complete

**Verify**

- [ ] Spot: available → claimed → completed
- [ ] Claim: active → completed
- [ ] New publish: `expires_at ≈ available_at + 2 min`
- [ ] Extension updates both countdowns via Realtime refresh (no modal)
- [ ] A credits **+1**; B credits **−1**
- [ ] Exactly one History card each (shared / found) with correct ±1
- [ ] Extension itself created **no** History row and **no** credit tx
- [ ] Live location stops after complete (publisher map clears / ages out)
- [ ] Publisher last-update freshness is visible (**Updated just now** / seconds ago)
- [ ] Web/PWA: pause while seeker is in Waze/Maps is expected; last marker remains
- [ ] Native app: Waze/Maps open → publisher stays live (no pause merely because Switch It is hidden)
- [ ] Native tracking stops immediately on complete / cancel / expire / Stop sharing / logout
- [ ] Native: claim expires while Switch It is backgrounded → tracking stops (notification gone)
- [ ] No location permission: claim + navigation still work; live progress unavailable; no nag
- [ ] Weak GPS on seeker shows **Getting an accurate location…** / **Location signal is weak** without cancelling the claim
- [ ] Seeker claim sheet uses exact spot lat/lng for Navigate + preview; missing address still works
- [ ] No seeker location permission: claim UI still usable, distance omitted
- [ ] Code no longer fetchable after complete
- [ ] No credit change toast implying transfer on claim alone

---

## Scenario B — Seeker release

1. A publishes (any short availability)
2. B claims
3. B sees **Can’t make it?** / **Release spot** and confirms before deadline

**Verify**

- [ ] Spot returns toward available (or expires if past deadline per rules)
- [ ] Both see terminal / refreshed UI
- [ ] **No** credit change for either user
- [ ] History shows Cancelled · No credit change
- [ ] Live share stops after release
- [ ] Declining live location earlier did **not** auto-cancel the claim

---

## Scenario C — Publisher leaves (“I’m leaving”)

1. A publishes; B claims
2. A taps **I’m leaving** (cancel_spot)

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

- [ ] C fails with friendly “This spot was just claimed by another driver.” (not raw SQL)
- [ ] Map refreshes; stale card clears
- [ ] C does not get an active claim
- [ ] A/B handoff undisturbed

---

## Scenario F — Publisher-controlled wait extension

1. A publishes with short delay; B claims before `available_at`
2. After `available_at`, A sees **Waiting for driver · M:SS left**
3. A taps **Wait 2 more min** (first extension)
4. Both countdowns refresh to the new deadline
5. A taps **Wait 1 more min** (final headroom to the 5-minute hard cap)
6. Extension control disappears at the hard cap
7. Complete with code before the final deadline **or** leave / let expire

**Verify**

- [ ] First extension +2; second only remaining headroom; never past `available_at + 5`
- [ ] Button never says “Wait 2 more min” when less than 2 minutes can be added
- [ ] No credit movement on extension
- [ ] No History row for extension alone
- [ ] Live location / code / vehicle remain available through the new deadline
- [ ] Seeker sees updated countdown without a modal

---

## Scenario G — Credits / idempotency edges

- [ ] Seeker with **0 credits**: claim rejected with “You need at least one parking credit…”
- [ ] Claim button may still appear (DB is source of truth) — rejection must be clear
- [ ] Double-tap complete with correct code: second call idempotent (`already_completed`), no double ±1
- [ ] New signup still receives **5** starting credits

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

## Native handoff location smoke (iOS / Android pilot)

- [ ] Capacitor sync succeeds; Info.plist location strings + Background Modes → Location updates
- [ ] Android FGS notification copy is clear during an active handoff only
- [ ] Edge Function `handoff-seeker-location` deployed; unauthorized JWT / non-seeker cannot broadcast
- [ ] Poor GPS samples are not transmitted; network blip does not crash or store a route
- [ ] Committed `capacitor.config.ts` has **no** hard-coded `server.url`
- [ ] Device testing uses `CAPACITOR_SERVER_URL` only for `cap sync` (unset → no remote server)

---

## Map / PWA smoke

- [ ] MapUnavailable retry recovers after genuine failure
- [ ] Branded loaders do not stack awkwardly with map loader
- [ ] Attribution visible
- [ ] Reduced motion: camera jumps without long animation
- [ ] Offline shell / install prompts behave as before (no regression)
- [ ] Installed iOS PWA: Home Screen icon is the cyan square Switch It mark (not a gray “S”). After icon or launch-asset changes, **delete and re-add** the icon so iOS recaches `apple-touch-icon` and `apple-touch-startup-image`. Launch shows Switch It branding immediately (no black frame). The in-HTML `#app-boot-splash` covers the gap after the OS splash until the app is ready.
- [ ] Cold launch: branded splash stays until the first real screen (not a half-loaded loading chrome). Reduced Motion still shows splash, then hides instantly.
- [ ] iPhone Login (Safari + installed PWA): tapping Email/Password does **not** zoom the page. Pinch-to-zoom still works. Same for register, vehicle, profile, and handoff code fields.

---

## Pass criteria

All Scenario A–G checks pass on at least one mobile + one desktop browser pair.
No raw Postgres / Supabase / MapLibre / stack traces shown to users.
Publish leave slider max is **10 minutes** (not 20). No ETA, ratings, or
penalties in this MVP. Signup credits remain **5**.
