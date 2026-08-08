# Switch It – Product Specification

Student MVP for the RUNI Internet Technologies final assignment.

## 1. Product overview

Switch It is a responsive web application that helps drivers coordinate the
handoff of public street parking spots.

A driver who is about to leave can publish the spot’s location and when it
will become free. Another authenticated driver can claim that spot for a
limited time and complete the handoff.

The product coordinates intent between drivers. It does **not** sell, reserve,
or guarantee ownership of a public parking spot. Anyone may still take the
physical spot independently of the app.

## 2. The problem being solved

In dense urban areas, drivers waste time circling for street parking while
other drivers leave spots with no easy way to hand them off.

Today that handoff is informal (waving, messaging friends, chance timing).
There is no simple shared place to:

- announce that a spot is about to free up,
- discover nearby soon-available spots,
- coordinate a short claim window so two drivers can meet the handoff.

## 3. Target users

Primary users for the MVP:

- **Leaving drivers (publishers)** – about to leave a public street spot and
  willing to share location and timing.
- **Seeking drivers (seekers)** – nearby, authenticated, looking for a spot
  and willing to use internal credits to claim one.

Typical context: students and local drivers in a city area covered by the
demo map. Users are expected to have a smartphone browser and basic map
literacy.

## 4. The customer and possible future business customers

**MVP customer:** the individual driver (B2C). Value is personal time saved
and smoother handoffs through a shared credit system.

**Possible future business customers (out of MVP scope):**

- campuses or employers wanting smoother parking around a site,
- municipalities exploring courtesy-based street parking tools,
- existing parking or navigation products that could embed handoff flows.

These are directional ideas only. The student MVP does not implement B2B
features, billing, or municipal integrations.

## 5. Business value

For drivers:

- less time searching when someone nearby is leaving,
- a clear, short-lived claim so both sides know who is coming,
- a lightweight incentive loop via internal credits (not real money).

For the course / product demonstration:

- a complete, understandable product loop (publish → claim → complete),
- clear rules for authorization, credits, and concurrency,
- a scope small enough to build, test, deploy, and explain thoroughly.

## 6. Business goals

1. Deliver a working end-to-end MVP of the parking handoff loop.
2. Demonstrate authentication, authorization, CRUD, and business rules.
3. Keep the product honest: coordination only, no ownership guarantee.
4. Stay small enough to finish on time with solid documentation and tests.
5. Deploy a demo-ready app (Vercel + Supabase) that can be walked through
   in a course presentation.

## 7. MVP scope

In scope:

1. User registration, login, and logout.
2. User profile with an internal credit balance.
3. Map of available parking spots.
4. Publishing a parking spot (location + expected availability window).
5. Claiming a parking spot for a limited period.
6. Enforcing at most one active claim per spot.
7. Completing or cancelling a claim.
8. Credit transactions after successful handoffs.
9. User activity history (publishes, claims, completions, cancellations).
10. Responsive web UI suitable for phone and desktop browsers.

## 8. Explicit non-goals

Out of scope for the MVP:

- real payments or cash-out of credits,
- native iOS/Android apps,
- push notifications,
- in-app chat or messaging,
- AI features,
- computer vision (e.g. detecting empty spots from photos),
- municipal or third-party parking APIs,
- complex rating or reputation systems,
- guaranteeing that a published spot remains physically free,
- selling or transferring legal rights to a public parking space,
- in-app turn-by-turn routing, Google Routes, or traffic ETA
  (seekers may open the claimed spot coordinates in Waze, Apple Maps, or
  Google Maps instead),
- admin dashboards, multi-tenant orgs, or enterprise roles.

## 9. Main user flows

### Navigation model

Authenticated users have two primary intents only:

1. **Find parking** → `/map`
2. **Share a spot** → `/spots/new`

The header mode switch is the single primary way to move between these
experiences. Profile, History, and Log out live in a compact profile menu.
There is no separate “My spot”, “Looking”, or “Leaving” navigation item.

During an active handoff (and while browsing available spots), open map and
publisher screens update live when the other party claims, cancels, or
completes — without requiring a manual refresh. Live updates use Supabase
Realtime as a refresh signal only; authorization and handoff codes still go
through existing server queries and RPCs.

### 9.1 Registration and login

1. User opens the app and chooses register or login.
2. User creates an account (email/password or the chosen Supabase auth method)
   or signs in.
3. On first successful registration, the system creates a profile with a
   **small starting credit balance**.
4. Authenticated users can access map, publish, claim, profile, and history.
5. Logout ends the session.

### 9.1 Registration and vehicle onboarding

1. User registers with email, password, and display name only.
2. After account creation, the user is guided to **Step 2: Tell drivers what to
   look for** (vehicle onboarding).
   at `/onboarding/vehicle`.
3. Vehicle details are stored on `public.profiles` (not in auth metadata).
4. Users cannot access the main app until vehicle onboarding is complete,
   except during an active handoff (see business rules).

During an active handoff, both participants see counterpart vehicle identity
(type, color, make, model, formatted plate) via a participant-only RPC, plus a
reciprocal line describing their own vehicle. Illustrations are representative;
plate and text are authoritative.

**Live location (Phase 9B — optional, foreground-only):** After claiming, the
seeker may deliberately tap **Share live location** (opt-in only; no
`watchPosition` before that tap). Helper copy explains that sharing helps the
parking owner see them approaching and may make waiting more likely — without
guaranteeing a wait. While Switch It is open and visible, a throttled private
Broadcast updates the publisher’s progress map. Sharing is not required to
**Open in**, complete, or cancel. Opening Waze / Google Maps / Apple Maps does
**not** change live-location consent. Declining, inaccurate GPS, backgrounding, or
stale updates never auto-cancel the claim. Publisher UI stays neutral
(“Waiting for live location”) and never exposes permission-denied details.
Consent is per claim and not remembered after reload. Coordinates are never
stored in the database, local storage, caches, or analytics.
Switch It does **not** provide turn-by-turn navigation or ETA. After claiming,
the seeker may tap **Open in** and open the parking coordinates in Waze,
Google Maps, or Apple Maps. No Google Routes API. Nearby users/cars are not
shown on the map — only available spots and the relevant counterpart during
an active handoff.

### History

Authenticated users can open **History** from the profile menu. Each card shows
role (“You shared a spot” / “You found a spot”), address when available,
date/time, final status (Completed / Cancelled / Expired), and credit effect.
No maps, live locations, handoff codes, or counterpart personal data.

### 9.2 Publishing a parking spot

1. Authenticated publisher opens **Share a spot**.
2. Publisher confirms location on the map and leaving delay with a **0–10 minute
   slider** (1-minute steps; 0 = Now), then taps **Share spot**.
   While adjusting the map, the app may show a short automatically derived address
   (display only; coordinates remain authoritative).
3. The server calculates `available_at = now + delay` and
   `expires_at = available_at + 2 minutes` (authoritative clock). The absolute
   hard cap for the handoff is `available_at + 5 minutes`. The client does
   not submit absolute timestamps.
4. Spot appears on the map for other users; the publisher sees a compact
   **Waiting for a driver** card (no map preview) until claimed, cancelled, or
   expired. After a seeker claims, the live handoff map is shown.
5. Both sides see a countdown that answers what happens next:
   before `available_at` (“Your spot will be ready in N min” /
   “The spot should be ready in N min”), then during the waiting window
   (“Waiting for driver · M:SS left” / “Complete the handoff · M:SS left”).
   After expiry the UI transitions to a terminal state (no frozen 00:00).
6. The publisher is **not** expected to wait five minutes automatically.
   Initial grace is **2 minutes**. During a claimed handoff after
   `available_at`, the publisher may tap **Wait N more min** (truthful
   remaining extension, never past the 5-minute hard cap) or **I’m leaving**
   (existing cancel — no credits). Live seeker location helps decide whether
   waiting longer is worthwhile. No ETA or turn-by-turn routing.

### 9.3 Browsing available spots

1. Authenticated user opens the main map page.
2. Map shows currently available spots (not claimed, not expired).
3. When spots exist, a compact horizontal **discovery carousel** lists them
   near the bottom of the map. Cards show availability, approximate
   straight-line distance (when location is available), and a short address.
4. Selecting a map marker or a carousel card keeps a single selected spot as
   source of truth: the map focuses the marker, the discovery carousel yields
   to a phone-native SelectedSpotCard bottom sheet (Claim action), then returns
   to the carousel when closed.
5. During an active claim, discovery UI (carousel, empty state, selected sheet)
   is hidden; the claim sheet takes priority (collapsed Open in; expanded
   vehicle + handoff completion). After a successful Claim, Switch It immediately
   offers a navigation chooser once (Waze first, then Google Maps, then Apple
   Maps) using the claimed spot’s exact latitude/longitude — not the display
   address. The user must tap a provider; **Cancel** keeps the claim active.
   **Open in** reopens the same chooser later. Navigation runs in the external
   app; returning to Switch It leaves the active claim unchanged.
6. User may proceed to claim if eligible.

### 9.3a Installing Switch It (mobile)

On supported phones, users can install Switch It from **Profile → Install app**:

- **Android / Chromium:** native install prompt after the user chooses Install app.
- **iPhone / iPad (Safari):** step-by-step **Add to Home Screen** instructions
  (Share → Add to Home Screen → Add).

Installed Switch It opens in standalone mode from the home screen icon, preserves
safe-area spacing, and continues using the same login/session rules as the browser.
Live parking still requires a network connection; offline launch shows a friendly
offline screen rather than stale parking data.

### 9.4 Claiming a parking spot

1. Seeker selects an available spot and requests a claim.
2. System checks: seeker is authenticated; spot is available; seeker is not
   the publisher; seeker has enough credits; no other active claim exists;
   `now < spot.expires_at`. Claims **may** be created before `available_at`.
3. On success, spot becomes **claimed**; `claim.expires_at = spot.expires_at`
   (one shared absolute deadline — no separate 15-minute claim hold).
4. Other users can no longer claim that spot while the claim is active.
5. Both participants immediately see counterpart vehicle recognition cards.

### 9.5 Completing a handoff

1. When a spot is claimed, the publisher receives a short **5-digit handoff
   code** visible only to them during the active claim. Helper: give the code
   when you meet — code entry does not need to happen while either driver is
   maneuvering.
2. When safely stopped, the seeker enters the code in the app.
3. On a correct code **before the shared deadline**, the system marks the claim
   and spot as **completed** and transfers credits seeker → publisher **exactly once**.
4. Wrong codes are rejected without credit movement. After five incorrect
   attempts, verification is temporarily locked for two minutes.
5. Both users see the event in history; balances update.

QR scanning and other external verification are future enhancements only.

### 9.6 Cancelling or expiring a handoff

**Publisher cancel**
- Unclaimed: quiet **Cancel spot** with confirmation.
- Claimed: **I’m leaving** with confirmation; spot and any active
  claim become cancelled. No credits move. Seeker is notified that the driver
  had to leave. Waiting is optional — the publisher is never required to stay
  until the countdown ends.

**Seeker cancel**
- Clear release UX: **Can’t make it?** / **Release spot** so another driver can
  claim it. Backend `cancel_claim` semantics unchanged.
- Before `spot.expires_at`: claim cancelled; spot returns to **available** with
  original `available_at` / `expires_at` unchanged. No credits move.
- At/after deadline: claim and spot **expired** (no reopen). No credits move.
- Live-location sharing stops immediately on release.

**Shared deadline expiry**
- When `expires_at` passes without completion, claim and/or spot become
  **expired** via lazy RPCs. Code and counterpart vehicle become inaccessible.
- Credits never move on cancel or expiry — only on successful code verification.

### 9.7 Viewing profile, credits, and history

1. User opens profile to see identity summary and current credit balance.
2. User opens history to see their publishes, claims, completions,
   cancellations/expirations, and credit movements.
3. Data is limited to the signed-in user’s own activity.

## 10. Core business rules

1. **Coordination only** – the app never sells or guarantees a public spot.
2. **Time-limited availability** – a published spot is valid only for a
   limited availability window.
3. **Time-limited claims** – a claim is active only for a limited claim
   window.
4. **Single active claim** – at most one active claim may exist for a spot.
5. **No self-claim** – a user cannot claim a spot they published.
6. **Starting credits** – new users receive **5** initial credits (product
   parameter tunable after usage testing). Solves cold start so a new user can
   claim before they have shared a spot. No payments, packs, or credit expiry
   in MVP.
7. **Virtual credits** – credits are internal points, not real money and not
   withdrawable in the MVP.
8. **Transfer on success only** – credits move from seeker to publisher only
   after a successfully completed handoff. Extension / leave / cancel / expiry
   move zero credits.
9. **No permanent charge on failure** – cancelled or expired claims must not
   permanently deduct the seeker’s credits.
10. **Vehicle identity required** – users must complete vehicle details during
    onboarding before publishing or claiming new spots. Existing active
    handoffs remain accessible if vehicle details are still missing.
11. **Authentication required** – publishing, claiming, completing, and
    viewing personal history require a signed-in user.
11. **Server/database enforcement** – critical rules (single claim, credits,
    ownership checks) are enforced on the server and/or with database
    constraints and RLS, not only in the UI.

Exact numeric values (starting balance, claim cost, window lengths) are
implementation details to be set in technical design and kept easy to demo.

## 11. User roles and permissions

MVP uses one account type: **authenticated user**. Publisher and seeker are
situational roles for a given spot, not separate account types.

| Action | Anonymous | Authenticated user |
|--------|-----------|--------------------|
| View marketing/landing (if any) | Yes | Yes |
| Register / login | Yes | — |
| View map of available spots | No* | Yes |
| Publish a spot | No | Yes |
| Claim a spot | No | Yes (not own spot) |
| Complete / cancel own claim or relevant spot action | No | Yes (per rules) |
| View own profile, credits, history | No | Yes |
| View another user’s private history | No | No |
| Admin / moderation tools | — | Not in MVP |

\*Map access for anonymous users is optional; default MVP assumption is
**auth-required for core app pages** to simplify authorization.

No separate admin, moderator, or business roles in the MVP.

## 12. Main pages

| Page | Purpose |
|------|---------|
| Register | Create account; receive starting credits |
| Login | Sign in to an existing account |
| Map / home | Browse available spots on a map; open spot details; start a claim |
| Publish spot | Create a new available spot with location and timing |
| Profile | Show user summary and credit balance |
| History | List terminal handoffs with friendly status and credit effect |
| Claim detail (optional) | Minimal status page for an active claim if not handled on the map |

Shared shell: simple responsive navigation for authenticated pages.
Logout available from the shell or profile.

## 13. Success metrics

Course- and demo-oriented metrics (qualitative + simple counts):

1. **Happy path works** – a second user can claim a first user’s spot and
   complete a handoff with correct credit transfer.
2. **Concurrency safety** – two users cannot hold an active claim on the
   same spot.
3. **Fair credits** – cancel/expire never permanently charges the seeker;
   only completion transfers credits.
4. **Usability** – a new user can register, publish, and claim without
   instructor help in a short demo.
5. **Reliability for presentation** – core flows work on the deployed URL.
6. **Scope control** – MVP features are implemented and explainable; non-goals
   remain out.

Optional demo counters (if easy): completed handoffs, cancelled/expired
claims, average time from publish to claim.

## 14. Risks and assumptions

**Assumptions**

- Users act in good faith during the course demo.
- “Success” means app-level handoff completion, not proof the car physically
  parked.
- A single demo city/area on the map is enough.
- Email/password (or one Supabase auth method) is enough for the course.
- Internal credits are acceptable without real-world economic value.

**Risks**

- The physical spot may be taken by someone outside the app → product must
  set expectations clearly in UI copy.
- Double-submit / race on claim → must be prevented in DB/server logic.
- Credit edge cases (insufficient balance, double completion) → need clear
  rules and tests.
- Map/location inaccuracy on desktop demos → allow explicit pin placement.
- Scope creep (chat, payments, ratings) → threaten finishability; non-goals
  must stay cut.

## 15. Future improvements

Ideas only after a solid MVP (not planned for this submission unless time
remains):

- push or email reminders before claim expiry,
- simple reputation / courtesy feedback or no-show signals (only after real usage),
- better matching by driving ETA / routes (not straight-line distance alone),
- photo or note on a published spot,
- campus- or city-scoped deployments,
- moderation tools for abuse,
- preferred navigation-app memory after observing real usage,

Any future work must preserve the core principle: Switch It coordinates
handoffs; it does not own or sell public parking spots. MVP deliberately omits
ratings, penalties, Google Routes/ETA, and payments.
