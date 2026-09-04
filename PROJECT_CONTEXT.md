# Switch It – Project Context

## Product

Switch It is a phone-first web application (PWA-capable) that helps drivers
coordinate the handoff of public street parking spots.

A publisher who is about to leave can share location and estimated departure.
A seeker can claim that listing. The two drivers share timing, vehicle identity
(masked plate + last-2-digit verification by the publisher), and a short-lived
live location during the active claim.

Credits are virtual points. They move only after successful completion.

## Course requirements

The project is built for the RUNI Internet Technologies final assignment.

Required technologies:

- Next.js
- TypeScript
- Supabase
- Vercel

Canonical documents: `docs/final-submission/`. Submission copies: `submission/`.

Production: https://switch-it-wine.vercel.app  
Repository: https://github.com/rotemkap10/switch-it

## MVP (as implemented)

1. Email/password auth, Confirm email, Forgot password.
2. Profile with credit balance (also shown in the header).
3. Map of available parking spots (MapLibre + MapTiler).
4. Publishing a parking spot (Now–10 minutes).
5. Claiming a parking spot (atomic RPC, 1500 m, ≥1 credit check).
6. Preventing more than one active claim for a spot.
7. Publisher plate-suffix verification on complete; structured cancel/release/expiry.
8. Mandatory vehicle onboarding before using the main app.
9. Credit transactions (ledger; transfer only on complete).
10. User activity history (keyset pagination).
11. Responsive phone-first UI + conservative PWA.
12. Live UI updates via Supabase Realtime; live seeker location via Edge Function.

## Non-goals for the MVP

- Real payments
- Chat, ratings, no-show penalties
- In-app turn-by-turn navigation
- Legal reservation of public parking
- Production push as a verified core feature (infra exists; experimental)
- Native app as a course requirement (Capacitor background-GPS pilot is optional)

## Technical principles

- Use Next.js App Router.
- Use strict TypeScript and avoid `any`.
- Keep business-critical logic on the server or in the database.
- Validate external input with Zod.
- Use Supabase Row Level Security.
- Never expose service-role keys in client-side code.
- Store database changes in migration files.
- Keep components focused and reasonably small.
- Add tests for central business flows.
- Prefer simple, readable solutions over unnecessary abstractions.
