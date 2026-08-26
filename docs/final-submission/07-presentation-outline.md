# Presentation outline — Switch It (10–15 minutes)

Approx. **10 slides** + short live demo.  
This file is a **planning source** for the deck. The assignment still requires an actual PPT/PDF presentation — create that deck from this outline.

Verified deep-dive examples from the repo (use slides 7–8):

1. **Atomic concurrent claiming** (`claim_spot` + `FOR UPDATE` + unique active claim)
2. **Database-driven handoff timing** (`available_at` / `handoff_started_at` / `expires_at`)
3. **Idempotent credit transfer on publisher plate verification** (`complete_claim` + ledger uniques)

Target speaking time: **12–13 minutes**, leaving buffer for Q&A.

Keep the main deck focused on the **core web MVP**. Do not clutter slides with Capacitor, push, Edge pilot, legacy Leaflet, or dormant spoken codes unless asked.

---

## Slide 1 — What is Switch It? (≈60s)

**Visual:** App logo + one phone mock of the map.

**Bullets:**
- Direct driver-to-driver parking handoff
- Publisher leaves; a specific seeker claims
- Coordinates timing — does **not** reserve public parking

**Say:**  
“Switch It matches a leaving driver with a seeking driver for one short handoff. We don’t own or guarantee the street space—we coordinate the exchange.”

---

## Slide 2 — Problem + users + differentiator (≈60–75s)

**Visual:** Circling car vs matched handoff diagram.

**Bullets:**
- Searching for street parking wastes time
- Uncertainty when a spot will free
- Users: publisher + seeker
- Differentiator: not just an availability report — a **matched handoff**

**Say:**  
“Many apps can say a spot might open. Switch It creates a temporary match between two drivers and runs a shared countdown and confirmation.”

---

## Slide 3 — Business value / MVP scope (≈45–60s)

**Visual:** Value list; MVP vs out-of-scope.

**Bullets:**
- Save search time / coordinate arrival
- Virtual credits incentive (not money)
- Current MVP: driver-facing product
- Monetization outside current scope

**Say:**  
“For this course MVP, users are drivers and credits are virtual points. There are no payments and no paying-customer model in scope yet.”

---

## Slide 4 — Live demo (≈3–3.5 min) ★ most important

**Visual:** Two devices / browsers (User A publisher, User B seeker).

**Happy-path script only:**
1. A publishes “Leaving in ~2 minutes”
2. B claims on Find parking
3. A presses I’m leaving now (or wait for auto-start if preferred)
4. Show vehicle card + countdown
5. A enters **correct** last 2 digits → complete
6. Briefly show credits / History

**Say:** Narrate each step; emphasize “credits don’t move until confirm.”

**Do not** intentionally enter a wrong plate digit during the live demo unless there is spare time. Mention lockout verbally instead.

**Backup:** Pre-recorded screen capture if campus Wi-Fi fails.

---

## Slide 5 — Architecture (≈60–75s)

**Visual:** Simple boxes only:

```text
User → Next.js → Server Actions → Supabase Auth / PostgreSQL / RLS / RPC / Realtime
MapLibre → MapTiler
```

**Bullets:**
- Next.js App Router + Server Actions
- Supabase Auth + PostgreSQL + RLS + RPCs
- MapLibre + MapTiler
- Database is the source of truth

**Say:**  
“The UI is Next.js. Critical rules—who can claim, when credits move—live in PostgreSQL functions, not only in React.”

---

## Slide 6 — Database + timing / state model (≈75s)

**Visual:** Four core tables + timing fields.

**Bullets:**
- Core entities: `profiles`, `parking_spots`, `claims`, `credit_transactions`
- Statuses: available → claimed → completed / cancelled / expired
- `available_at`, `handoff_started_at`, `expires_at`
- Now / future / I’m leaving now share one live-window model

**Say:**  
“A future listing starts unstarted. Now or I’m leaving now sets handoff_started_at. expires_at is the shared deadline. A late claim gets remaining time, not a fresh three minutes.”

---

## Slide 7 — Deep dive: atomic concurrent claims (≈60–75s)

**Visual:** Two seekers → one lock → one winner.

**Bullets:**
- `SELECT FOR UPDATE`
- Unique active claim per spot
- Loser gets a business error

**Say:**  
“I did not solve concurrency only in React. PostgreSQL is the authority because two simultaneous network requests must be arbitrated server-side.”

---

## Slide 8 — Deep dive: credits + publisher verification (≈60–75s)

**Visual:** Claim ≠ debit; Complete = −1/+1; plate last-2.

**Bullets:**
- Claim checks balance only
- Publisher verifies seeker plate suffix
- Ledger unique debit/credit per claim
- Attempt lockout after 3 failures (~2 minutes)

**Say:**  
“We only move credits after successful verification, once, inside the same transaction as completion.”

---

## Slide 9 — Tests + Scale + Security (≈75s)

**Visual:** Three columns — one strong fact each.

**Bullets:**
- **Testing:** ~1624 automated Vitest tests + manual real-device QA (no Playwright project)
- **Scale:** indexes + keyset History pagination; geo discovery still MVP-limited (no PostGIS)
- **Security:** Supabase Auth (Confirm email, Forgot password, anti-enumeration UX) + RLS + authenticated RPCs; fraud/collusion remains a residual risk

**Say:**  
“We automated a lot of UI and contract tests. True simultaneous claim races we still demo manually. Security is basic but real—and multi-account farming isn’t fully prevented.”

---

## Slide 10 — Limitations + future work (≈45–60s)

**Visual:** Honest limitations list.

**Bullets:**
- Public parking cannot be guaranteed
- Fraud/collusion not fully prevented
- Geographic discovery is not yet spatially indexed
- No proximity gate for completion

**Future (NOT CURRENTLY IMPLEMENTED):**
- Stronger anti-abuse / unique-identity controls
- Better geo search
- Production notification/native polish only if pursued later

**Say:**  
“If I had more time, I’d improve geographic discovery and anti-abuse—not invent payments as the main next step.”

---

## Optional buffer — Q&A

Invite questions on claim races, RLS, credits, timing.

---

# Timing budget

| Block | Minutes |
| --- | --- |
| Slides 1–3 | ~3 |
| Demo | ~3.5 |
| Architecture + DB + deep dives | ~4 |
| Tests/scale/security + future | ~2 |
| Buffer | ~1–2 |
| **Total** | **~12–14** |

---

# Repository references

- `docs/final-submission/01-product-spec.md`
- `docs/final-submission/02-technical-design.md`
- `README.md` (demo checklist)
- `supabase/migrations/20260819130000_prevent_seeker_reclaim.sql`
- `src/actions/claims.ts`
