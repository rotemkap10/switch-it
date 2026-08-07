# Switch It

Phone-first web app that helps drivers coordinate a **public street parking handoff**.

A driver about to leave can share when their spot will free up. Another driver can claim it for a short window, navigate there, optionally share live location while Switch It is open, verify with a 5-digit code, and complete the handoff. Credits (virtual points for this course MVP—not money) transfer only on successful completion.

Switch It does **not** sell, reserve, or guarantee a parking spot.

## Key features

- Find parking / Share a spot modes
- Shared 5-minute handoff deadline (Phase 9A)
- Handoff verification code + mutual vehicle recognition
- Optional foreground live-location sharing (Phase 9B)
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
```

Live seeker location is ephemeral (memory + private Broadcast only). No location/route history is stored.

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

Optional: `NEXT_PUBLIC_PWA_DEV=true` to exercise the service worker locally.

There is **no** Google Routes / ETA key in this MVP.

## npm commands

```bash
npm run dev
npm run test:run
npm run lint
npm run build
```

## Production

Deploy on Vercel (or equivalent) with the env vars above. PWA: `/manifest.webmanifest`, `/sw.js`, `/offline`.

## 2-device demo flow (~2–4 minutes)

Use two real accounts (no fake demo mode).

**User A (publisher)**  
1. Sign in → **Share a spot**  
2. Set leave time to about **2 minutes** → Share  

**User B (seeker)**  
3. Sign in → **Find parking**  
4. Claim User A’s spot  
5. Tap **Share live location** and allow permission  

**User A**  
6. Confirm live marker + counterpart vehicle  
7. Show the 5-digit handoff code  

**User B**  
8. Enter the code → complete handoff  

Then show: credits moved by exactly one, and a **History** entry.

### Demo checklist / failure modes

- Grant geolocation outdoors when possible (weak GPS indoors)
- Confirm MapTiler key and network before presenting
- Confirm Realtime is healthy (publisher sees claim quickly)
- Prefer a 2-minute leave delay so the window is not rushed
- Have both accounts ready (avoid email-confirm friction mid-demo)
- Do not expect routing/ETA overlays

## Known limitations

- Parking is never guaranteed
- Live location is foreground-first (may pause in background)
- No ETA / turn-by-turn routing in-app (external Navigate still opens maps)
- No payments, chat, push notifications, or ratings
- Course MVP credits are not real money

## Docs

- [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
- [`docs/TECHNICAL_DESIGN.md`](docs/TECHNICAL_DESIGN.md)
