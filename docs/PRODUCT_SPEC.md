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
- admin dashboards, multi-tenant orgs, or enterprise roles.

## 9. Main user flows

### Navigation model

Authenticated users have two primary intents only:

1. **Find parking** → `/map`
2. **Share a spot** → `/spots/new`

The header mode switch is the single primary way to move between these
experiences. Profile and Log out live in a compact profile menu. There is no
separate “My spot”, “Looking”, or “Leaving” navigation item.

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
2. After account creation, the user is guided to **Step 2: Add your vehicle**
   at `/onboarding/vehicle`.
3. Vehicle details are stored on `public.profiles` (not in auth metadata).
4. Users cannot access the main app until vehicle onboarding is complete,
   except during an active handoff (see business rules).

During an active handoff, counterpart vehicle identity is shown using generic
type-and-color illustrations. The make, model, and license plate text are the
authoritative recognition details; illustrations are representative only. A
one-time approach animation may play when a handoff becomes live.

### 9.2 Publishing a parking spot

1. Authenticated publisher opens **Share a spot**.
2. Publisher confirms location on the map and leaving time, then taps **Share spot**.
   While adjusting the map, the app may show a short automatically derived address
   (display only; coordinates remain authoritative).
3. System validates input and creates a spot in an **available** state.
4. Spot appears on the map for other users; the publisher sees
   **Waiting for a driver** until claimed, cancelled, or expired.

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
   is hidden; the claim sheet takes priority (collapsed Navigate; expanded
   vehicle + handoff completion).
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
   the publisher; seeker has enough credits to hold a claim if required by
   the rules; no other active claim exists.
3. On success, spot becomes **claimed**; seeker receives a limited claim
   window to arrive and complete the handoff.
4. Other users can no longer claim that spot while the claim is active.

### 9.5 Completing a handoff

1. When a spot is claimed, the publisher receives a short **5-digit handoff
   code** visible only to them during the active claim.
2. The seeker arrives and enters the code in the app.
3. On a correct code, the system marks the claim and spot as **completed**
   and transfers credits seeker → publisher **exactly once**.
4. Wrong codes are rejected without credit movement. After five incorrect
   attempts, verification is temporarily locked for two minutes.
5. Both users see the event in history; balances update.

QR scanning and other external verification are future enhancements only.

### 9.6 Cancelling or expiring a claim

1. Seeker or publisher may cancel while rules allow, **or** the claim
   window ends without completion.
2. System marks the claim as **cancelled** or **expired**.
3. Spot may return to available (if still within its availability window)
   or become unavailable/expired.
4. Seeker is **not permanently charged**; any hold is released. No credit
   transfer occurs.

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
6. **Starting credits** – new users receive a small initial credit balance.
7. **Virtual credits** – credits are internal points, not real money and not
   withdrawable in the MVP.
8. **Transfer on success only** – credits move from seeker to publisher only
   after a successfully completed handoff.
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
| History | List the user’s spot and claim activity and credit changes |
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
- simple reputation or courtesy feedback,
- realtime map updates,
- better matching by ETA / walking distance,
- photo or note on a published spot,
- campus- or city-scoped deployments,
- moderation tools for abuse,
- integrations with navigation apps.

Any future work must preserve the core principle: Switch It coordinates
handoffs; it does not own or sell public parking spots.
