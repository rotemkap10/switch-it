# Switch It

Phone-first web app that helps drivers coordinate a **public street parking handoff**.

A driver about to leave can share when their spot will free up. Another driver can claim it for a short window, navigate there, optionally share live location (PWA: while Switch It is open; native app: throughout the active handoff, including Waze/Maps), verify with a 5-digit code, and complete the handoff. Credits (virtual points for this course MVP—not money) transfer only on successful completion.

Switch It does **not** sell, reserve, or guarantee a parking spot.

## Key features

- Find parking / Share a spot modes
- Shared handoff deadline with publisher-controlled waiting (initial 2 min,
  extend up to 5 min total after departure; Phase 9A + extend RPC)
- Handoff verification code + mutual vehicle recognition
- Optional live-location sharing (Phase 9B): PWA foreground-only; native
  iOS/Android background during an active handoff only
- Credits, History, Profile, PWA install
- Branded parking-pin loading for routes and maps

## Stack

- **Next.js** App Router (React)
- **Supabase** Auth, Postgres, RLS/RPC, Realtime
- **MapLibre** + **MapTiler** (basemap / style / geocoding)
- Progressive Web App (production)

## Architecture (summary)

```
Browser / PWA
  → Next.js App Router + Server Actions
  → Supabase Auth + Postgres (RLS/RPC)
  → Supabase Realtime (postgres_changes + private Broadcast for live location)
  → MapLibre rendering + MapTiler style/geocoding

Native iOS/Android (pilot)
  → Capacitor shell + HandoffBackgroundLocation plugin
  → native GPS + HTTP → Edge Function → same private Broadcast topic
```

Live seeker location is ephemeral (memory + private Broadcast only). No location/route history is stored. Native background GPS exists only during an active handoff.

Native pilot setup: `native/README.md`. Do not set Capacitor `server.url` in production config. Next.js Server Actions cannot be bundled as static Capacitor assets; Vercel/PWA remains the production web app.

## Local setup

```bash
npm install
cp .env.example .env.local   # if present; otherwise create .env.local
npm run dev
```

Apply Supabase migrations with your usual linked workflow (`supabase db push` / dashboard). Do not commit secrets.

### Environment variables (names only)

| Name | Where |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + server |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Client map/geocoding |
| `NEXT_PUBLIC_CARIMAGES_API_KEY` | Client (public CarImages JS-loader key; optional) |

Optional: `NEXT_PUBLIC_PWA_DEV=true` to exercise the service worker locally.

CarImages is a vehicle-image fallback only (WebP `front34`). Do not put the CarImages API secret in any `NEXT_PUBLIC_` variable. Temporary visual check: `/dev/car-images`.

There is **no** Google Routes / ETA key in this MVP.

## npm commands

```bash
npm run dev
npm run test:run
npm run lint
npm run build
```

## Production

Deploy on Vercel (or equivalent) with the env vars above. PWA: `/manifest.webmanifest`, `/sw.js`, `/offline`. Home Screen icon is `/apple-touch-icon.png` (square Switch It mark). Launch is two-layer: iOS `apple-touch-startup-image` / Android manifest splash, then a server-rendered in-HTML splash (`#app-boot-splash`) until the app is ready. After changing iOS icons or startup PNGs, delete and re-add the Home Screen icon so iOS recaches them.

## 2-device demo flow (~2–4 minutes)

Use two real accounts (no fake demo mode).

**User A (publisher)**  
1. Sign in → **Share a spot**  
2. Set leave time within **0–10 minutes** (about **2 minutes**) → Share  
3. After claim: optionally **Wait N more min** (up to 5 min total after departure) or **I’m leaving**

**User B (seeker)**  
3. Sign in → **Find parking**  
4. Claim User A’s spot  
5. Choose **Waze / Google Maps / Apple Maps** (starts foreground live location;
   sharing pauses while Switch It is in the background and resumes when you return)  
6. Or **Release spot** if you can’t make it (no credits move)

**User A**  
7. Confirm live marker + counterpart vehicle (when shared)  
8. Show the 5-digit handoff code when you meet  

**User B**  
9. When safely stopped, enter the code → complete handoff  

Then show: credits moved by exactly one, and a **History** entry.

### Demo checklist / failure modes

- Grant geolocation outdoors when possible (weak GPS indoors)
- Confirm MapTiler key and network before presenting
- Confirm Realtime is healthy (publisher sees claim quickly)
- Prefer a 2-minute leave delay so the window is not rushed (max leave **10 min**)
- Have both accounts ready (avoid email-confirm friction mid-demo)
- Do not expect routing/ETA overlays
- Signup still grants **5** starting credits (tunable product parameter)

## Known limitations

- Parking is never guaranteed (public street spots)
- Live location is foreground-only and starts when a navigation provider is chosen (may pause in background)
- No ETA / turn-by-turn routing in-app (Open in launches Waze, Google Maps, or Apple Maps)
- No payments, chat, push notifications, ratings, or no-show penalties
- Course MVP credits are not real money

## Docs

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
- [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md)

## Usage Notice

This repository is publicly available for academic review and course evaluation purposes. All source code, branding, product concepts, and related materials remain the property of the author unless otherwise stated. No permission is granted to copy, redistribute, modify, publish, sublicense, or use this project or substantial portions of it for commercial purposes without prior written permission.
