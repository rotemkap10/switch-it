# Switch It

**Switch It** is a phone-first web app that helps drivers coordinate direct handoffs of **public street parking spots**.

A driver who is about to leave a parking spot can share when they expect to depart. Another driver looking for parking can claim the handoff, navigate to the location, share live location during the active handoff (subject to device permission and GPS), identify the other vehicle, and complete the exchange.

Switch It coordinates the drivers — it does **not** sell, reserve, own, or guarantee a public parking spot.

## Core concept

Switch It is built around a direct **driver-to-driver parking handoff**.

Instead of simply reporting that a parking spot may become available, Switch It creates a temporary match between:

* the **publisher** — the driver leaving the parking spot
* the **seeker** — the driver trying to take it

Once a seeker claims the spot, the handoff is coordinated between those two drivers for the duration of the active exchange.

## Key features

* **Find parking** and **Share a spot** modes
* Estimated departure selection from **Now to 10 minutes**
* Live countdown to the publisher's estimated departure
* Early handoff start with **I'm leaving now**
* Automatic handoff start when the estimated departure time is reached
* **3-minute active handoff window**
* One publisher-controlled **+2 minute extension**
* Maximum active handoff window of **5 minutes**
* Navigation through:

  * Waze
  * Google Maps
  * Apple Maps
* Live seeker location during an active handoff (starts with the claim UI; depends on permission/GPS)
* Vehicle recognition using make, model, year, color, masked plate, and catalog imagery
* Publisher verifies the arriving seeker's vehicle using the **last 2 digits of the seeker's license plate**
* Credits transfer only after successful handoff completion
* Cancellation / Release spot without credit movement
* Handoff History
* Profile and vehicle management
* PWA installation
* Responsive phone-first UI
* MapLibre maps with MapTiler basemap and geocoding
* CarImages catalog vehicle imagery with a generic illustration fallback

## Handoff timing

The publisher chooses an estimated departure time between **Now and 10 minutes**.

### Future departure

Example:

```text
Publisher selects: Leaving in 5 minutes
        ↓
Seeker claims the spot
        ↓
Countdown to estimated departure
        ↓
Estimated departure is reached
        ↓
3-minute active handoff starts automatically
        ↓
Publisher may optionally extend by 2 minutes once
```

The selected departure time acts as the expected start of the active handoff.

The seeker should not have to wait for the publisher to manually start the handoff after the promised departure time.

### Leaving early

If the publisher becomes ready before the estimated departure time, they can press:

**I'm leaving now**

This starts the active handoff immediately.

Example:

```text
23:00 — Publisher selects Leaving in 5 minutes
23:02 — Publisher presses I'm leaving now
23:02 — Active 3-minute handoff begins
```

The original estimated departure time is no longer relevant after an early start.

### Now

Choosing **Now** starts the active handoff immediately.

### Active handoff

Once the handoff starts:

* initial active window: **3 minutes**
* publisher may extend once by **2 minutes**
* maximum active window: **5 minutes from the actual handoff start**
* no additional automatic extensions

Starting or extending the handoff does not move credits.

## Handoff verification

Verification is performed by the **publisher**.

Once the active handoff has started, the publisher can see information about the arriving seeker's vehicle:

* make
* model
* year
* color
* catalog vehicle image when available
* masked license plate

Example:

```text
76-543-**
```

When the seeker arrives, the publisher enters the **last 2 digits of the seeker's stored license plate** and confirms the handoff.

The full license plate is never exposed to the counterpart.

### Verification protection

* Maximum of 3 incorrect attempts
* After 3 incorrect attempts: 2-minute cooldown
* Refreshing the app does not reset the cooldown
* Incorrect attempts do not reveal which digit was correct
* Only the spot owner / publisher may complete the handoff

## Credits

Credits are virtual Switch It points used for the MVP. They are **not money**.

A new account currently starts with **5 credits**.

### Claiming a spot

A seeker must have at least **1 credit** to claim a spot.

Claiming does **not**:

* debit a credit
* reserve a credit
* transfer a credit to the publisher

A seeker may have only one active claim at a time.

### Successful handoff

Credits move only after successful verification and completion:

```text
Seeker       -1 credit
Publisher    +1 credit
```

The transfer happens exactly once per completed claim.

### No credit movement

Credits do not move when:

* a spot is claimed
* the publisher starts the handoff
* the handoff starts automatically
* the publisher presses I'm leaving now
* the publisher extends the waiting window
* the seeker releases the spot
* either side cancels
* the handoff expires
* verification fails

## Vehicle imagery

Switch It does **not** use user-uploaded vehicle photos.

Vehicle imagery is generated from the vehicle details stored in the user's profile:

```text
Make + Model + Year
        ↓
CarImages catalog image
        ↓
Generic illustration if unavailable
```

The generic illustration is used only as a true fallback.

While a CarImages result is still loading, Switch It uses a neutral loading state instead of temporarily displaying an incorrect fallback vehicle.

Vehicle identity data includes:

* make
* model
* year
* color
* license plate
* vehicle type where applicable

## Navigation

During an active claim, the seeker can tap:

**Navigate to spot**

Every tap opens the navigation provider chooser.

Available providers include:

* Waze
* Google Maps
* Apple Maps

The user can therefore choose a different navigation app each time.

Switch It itself does not provide turn-by-turn navigation or route ETA calculations.

## Live location

During an active claim, the seeker app starts live-location sharing with the publisher (subject to device permission and GPS availability). There is no separate “optional share” toggle in the current active-claim UI.

The publisher can use the live handoff map to see the approaching seeker.

Live seeker location is temporary and is **not stored as a route-history trail**.

- Web/PWA: private Realtime Broadcast (foreground-dependent)
- Native/Edge pilot: may also upsert an ephemeral **latest** snapshot row for recovery; that row is replaced on update and deleted when the claim becomes terminal

### PWA

In the web/PWA version, live location is foreground-dependent and may pause when Switch It is sent to the background or an external navigation app is opened.

### Native pilot

The Capacitor-based native pilot supports background GPS during an active handoff, including while Waze or Maps is open.

Native background location is active only for the duration of the handoff.

## History

Switch It keeps handoff history in Postgres.

History includes terminal outcomes such as:

* Completed
* Cancelled
* Expired

The UI loads history in pages of **20 records** using cursor-based pagination rather than fetching the user's complete history at once.

Completed rows obtain their credit change from the actual credit ledger rather than from a hardcoded value.

Historical location privacy is preserved. Old seeker handoffs do not expose protected street addresses or coordinates once the relevant access window has ended.

## Maps and location

Switch It uses:

* **MapLibre** for map rendering
* **MapTiler** for basemap styles and geocoding

Map attribution remains available through MapLibre's compact attribution control.

When sharing a spot, Switch It requests high-accuracy browser geolocation when available.

Because parking handoffs depend on precise positioning, the UI displays location accuracy and warns the publisher when the detected location may not be sufficiently precise.

The publisher remains responsible for confirming that the map pin is placed on the actual parking location.

## Stack

* **Next.js 16** App Router
* **React**
* **Supabase**

  * Auth
  * Postgres
  * RLS
  * RPC
  * Realtime
* **MapLibre**
* **MapTiler**
* **CarImages**
* **Progressive Web App**
* **Capacitor** for the native pilot

## Architecture

```text
Browser / PWA
  ↓
Next.js App Router + Server Actions
  ↓
Supabase Auth + Postgres
  ├─ RLS
  ├─ RPC business logic
  ├─ parking spots / claims / credits
  └─ Realtime
       ├─ postgres_changes
       └─ private Broadcast for temporary live location
  ↓
MapLibre + MapTiler


Native iOS / Android pilot
  ↓
Capacitor shell
  ↓
HandoffBackgroundLocation plugin
  ↓
Native GPS + HTTP
  ↓
Supabase Edge Function
  ↓
Private handoff Broadcast topic
```

Live seeker location is temporary. Web/PWA uses private Broadcast; the native/Edge path may keep an ephemeral latest snapshot (not a route-history trail).

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

If `.env.example` is not present, create `.env.local` manually.

Apply Supabase migrations using the project's normal linked workflow:

```bash
npx supabase db push
```

Do not commit secrets.

## Environment variables

| Name                                   | Usage                          |
| -------------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase client + server       |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client + server       |
| `NEXT_PUBLIC_MAPTILER_API_KEY`         | Map style + geocoding          |
| `NEXT_PUBLIC_CARIMAGES_API_KEY`        | Public CarImages JS-loader key |

Optional:

```text
NEXT_PUBLIC_PWA_DEV=true
```

This can be used to exercise the service worker during local development.

### CarImages

CarImages is used only for catalog vehicle imagery.

The client uses the public JS-loader key.

Do **not** put a private CarImages API secret in a `NEXT_PUBLIC_` environment variable.

A generic vehicle illustration is used if no suitable catalog image is available.

## Development commands

```bash
npm run dev
npm run test:run
npm run lint
npm run build
```

## Production

The production web application is deployed on **Vercel** or another Next.js-compatible platform.

PWA resources include:

```text
/manifest.webmanifest
/sw.js
/offline
```

The iOS Home Screen icon is:

```text
/apple-touch-icon.png
```

Switch It uses a branded startup experience to reduce the default browser/PWA startup flash.

After changing iOS Home Screen icons or startup images, remove and re-add the installed Home Screen app so iOS refreshes its cached assets.

Do not configure a production Capacitor build by simply pointing `server.url` at a development server.

Next.js Server Actions require the deployed Next.js backend and cannot be bundled as static Capacitor assets.

Native pilot setup is documented in:

```text
native/README.md
```

## Two-device demo flow

Use two real Switch It accounts.

### User A — Publisher

1. Sign in.
2. Open **Share a spot**.
3. Confirm the parking location.
4. Choose an estimated departure between **Now and 10 minutes**.
5. Share the spot.

### User B — Seeker

6. Open **Find parking**.
7. Claim User A's spot.
8. See the countdown to the publisher's estimated departure.
9. Tap **Navigate to spot**.
10. Choose Waze, Google Maps, or Apple Maps.
11. Live location sharing starts for the active claim if permission/GPS allow.

If the seeker cannot make it, they can press:

**Release spot**

No credits move.

### User A — Publisher

12. If ready early, press **I'm leaving now**.

Otherwise, the active handoff begins automatically when the estimated departure time is reached.

13. View the seeker's vehicle details and live marker when available.
14. If needed, press **Wait 2 more min** once.
15. When the seeker arrives, confirm that the arriving vehicle matches.
16. Enter the last 2 digits of the seeker's license plate.
17. Press **Confirm handoff**.

### Completion

A successful handoff transfers:

```text
Seeker       -1 credit
Publisher    +1 credit
```

Both users receive the updated state and the handoff appears in **History**.

## Demo checklist

Before presenting:

* Use two real accounts
* Confirm both accounts already have vehicle details
* Grant geolocation permission
* Prefer testing outdoors or somewhere with reasonable GPS accuracy
* Confirm the MapTiler key is available
* Confirm CarImages loads correctly
* Confirm Supabase Realtime is healthy
* Use a short future departure such as 2 minutes for demonstration
* Confirm Waze / Google Maps / Apple Maps opening on the demo device
* Do not expect in-app route or ETA overlays

## Known limitations

* Public street parking is never guaranteed
* Another non-Switch-It driver may still physically take the spot
* No in-app ETA or turn-by-turn navigation
* PWA background location is limited by browser/mobile OS behavior
* No GPS/proximity requirement for handoff completion
* No payments
* No chat
* Push infrastructure exists as an optional pilot, but production push delivery is not part of the verified core MVP
* No ratings
* No no-show penalties
* Credits are virtual MVP points, not money

## Product principle

Switch It coordinates a temporary parking handoff between two drivers.

It does not create ownership of a public parking space and does not guarantee that the space will remain physically available.

The goal is to make parking handoffs **more coordinated and predictable** than a simple unassigned parking-availability alert.

## Documentation

* [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
* [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md)
* [`native/README.md`](native/README.md)

## Usage Notice

This repository is publicly available for academic review and course evaluation purposes.

All source code, branding, product concepts, and related materials remain the property of the author unless otherwise stated.

No permission is granted to copy, redistribute, modify, publish, sublicense, or use this project or substantial portions of it for commercial purposes without prior written permission.
