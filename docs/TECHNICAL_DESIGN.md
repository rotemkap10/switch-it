# Switch It – Technical Design

Student MVP technical design for the RUNI Internet Technologies final
assignment. Aligns with `PROJECT_CONTEXT.md` and `docs/PRODUCT_SPEC.md`.

## 1. Technical overview

Switch It is a Next.js App Router web app with a Supabase backend
(Auth + PostgreSQL + Row Level Security), deployed on Vercel.

| Layer | Choice |
|-------|--------|
| Framework | Next.js (App Router) + TypeScript (strict) |
| UI | React Server Components + small Client Components where needed |
| Styling | Tailwind CSS |
| Auth | Supabase Auth — email and password only |
| Database | Supabase PostgreSQL |
| Mutations | Next.js Server Actions (primary) |
| Validation | Zod |
| Maps (when implemented) | Leaflet + react-leaflet |
| Testing (when implemented) | Vitest + Testing Library; Playwright for E2E |

Critical business rules (claim races, credits, completion idempotency) are
enforced in PostgreSQL via constraints, partial unique indexes, and
authenticated `SECURITY DEFINER` functions that check `auth.uid()`. The UI
never trusts client-only checks.

No ORM, repository layer, queue, microservice, or client state library.

## 2. System architecture

```text
Browser
  │  RSC pages / Client Components (map, forms)
  ▼
Next.js on Vercel
  │  Server Actions (mutations)
  │  Middleware (session refresh + route protection)
  │  Optional Route Handler: auth callback only
  ▼
Supabase
  ├── Auth (email/password sessions)
  └── PostgreSQL
        ├── Tables + CHECK constraints + indexes
        ├── Row Level Security policies
        └── RPC functions (claim, complete, cancel with auth.uid() checks)
```

**Data flow for a mutation**

1. Client or form invokes a Server Action.
2. Action authenticates the user via the Supabase server client (cookies).
3. Action validates input with Zod.
4. Action calls a Postgres RPC or constrained insert/update.
5. Database applies rules atomically and returns success or an error.
6. Action returns a typed result; the page revalidates.

## 3. Frontend, backend, and database responsibilities

### Frontend (`src/app`, `src/components`)

- Render pages and forms.
- Show map markers and spot details.
- Display loading, empty, and error UI.
- Call Server Actions; never embed service-role keys.
- May hide invalid actions in the UI for UX only.

### Backend (Next.js server: Actions, middleware, `src/lib`)

- Create cookie-based Supabase clients.
- Validate all external input with Zod.
- Invoke RPCs / queries as the authenticated user.
- Map database errors to safe user-facing messages.
- Protect `/map` and product routes in middleware.

### Database (Supabase PostgreSQL)

- Persist profiles, spots, claims, and credit transactions.
- Enforce CHECKs, FKs, and partial unique indexes.
- Enforce RLS so users only read/write permitted rows.
- Run atomic claim / complete / cancel logic in SQL functions.
- Apply lazy expiry updates when mutations or relevant reads run.

## 4. Proposed folder structure

```text
src/
  app/
    page.tsx                 # public landing "/"
    (auth)/
      login/
      register/
    auth/callback/           # Route Handler if email redirect needs it
    (main)/
      layout.tsx             # authenticated shell
      map/page.tsx
      spot/new/page.tsx
      profile/page.tsx
      history/page.tsx
    layout.tsx
    globals.css
  components/
    auth/
    map/
    spots/
    profile/
    ui/
  lib/
    supabase/
      client.ts
      server.ts
      middleware.ts
    validations/
    credits.ts               # constants + pure helpers
    spots.ts                 # pure helpers / status helpers
  actions/                   # Server Actions
  types/
  middleware.ts

supabase/
  migrations/

tests/
  unit/
  components/

e2e/
docs/
public/
```

## 5. Main application pages

| Route | Auth | Purpose |
|-------|------|---------|
| `/` | Public | Landing: product pitch + links to login/register |
| `/login` | Public | Email/password sign-in |
| `/register` | Public | Email/password sign-up (Step 1 of 2) |
| `/onboarding/vehicle` | Required | Mandatory vehicle setup (Step 2 of 2) |
| `/auth/callback` | Special | Auth redirect handler if required by Supabase email flow |
| `/map` | Required + vehicle | Browse available spots; open details; claim |
| `/spots/new` | Required + vehicle | Publish a parking spot |
| `/profile` | Required | Display name, vehicle, credit balance (allowed while vehicle incomplete) |
| `/history` | Required + vehicle | Own spots, claims, and credit transactions |

Optional later: a small claim status panel on `/map` instead of a separate
claim detail page.

## 6. Main components

| Area | Components (examples) | Notes |
|------|------------------------|-------|
| Auth | `LoginForm`, `RegisterForm` | Client forms → Server Actions |
| Map | `ParkingMap`, `SpotMarker`, `SpotDetailsPanel` | Client (Leaflet) |
| Spots | `PublishSpotForm`, `ClaimButton`, `CancelSpotButton` | Forms / actions |
| Claims | `CompleteHandoffForm`, `CancelClaimButton` | Seeker-only verified complete |
| Profile | `ProfileSummary`, `CreditBalance` | Mostly server-rendered |
| History | `HistoryList`, `TransactionRow` | Server-rendered lists |
| UI | `Button`, `Input`, `Alert`, `EmptyState` | Minimal shared primitives |
| Shell | `AppNav`, `ModeSwitch`, `ProfileMenu` | Two-intent mode switch + profile menu |

Keep components small. Business rules live in SQL/Actions, not in map UI.

## 7. Database schema

Constants used in logic (application + SQL):

- Starting credits: **5**
- Handoff cost / reward: **1** credit
- Spot statuses: `available` | `claimed` | `completed` | `cancelled` | `expired`
- Claim statuses: `active` | `completed` | `cancelled` | `expired`
- Transaction types: `initial_grant` | `handoff_debit` | `handoff_credit`
- Non-terminal spot statuses: `available`, `claimed`

### 7.1 `profiles`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NO | PK; FK → `auth.users(id)` ON DELETE CASCADE |
| `display_name` | `text` | NO | |
| `credits` | `integer` | NO | Default `5`; CHECK `credits >= 0` |
| `role` | `text` | NO | Default `'user'`; CHECK `role IN ('user')` for MVP (extend later) |
| `created_at` | `timestamptz` | NO | Default `now()` |
| `updated_at` | `timestamptz` | NO | Default `now()` |

**Constraints:** PK(`id`); FK to `auth.users`; CHECK on `credits`, `role`.

**Indexes:** PK on `id` is sufficient for MVP.

**Creation:** trigger on `auth.users` insert → create profile with
`credits = 5`, `role = 'user'`, and insert `credit_transactions` row
`initial_grant` amount `+5` (or amount `5` with convention documented).

### 7.2 `parking_spots`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NO | PK; default `gen_random_uuid()` |
| `owner_id` | `uuid` | NO | FK → `profiles(id)` |
| `latitude` | `double precision` | NO | Required |
| `longitude` | `double precision` | NO | Required |
| `address` | `text` | YES | Optional label |
| `available_at` | `timestamptz` | NO | When spot is expected free |
| `expires_at` | `timestamptz` | NO | End of availability window |
| `status` | `text` | NO | CHECK in allowed spot statuses |
| `created_at` | `timestamptz` | NO | Default `now()` |
| `updated_at` | `timestamptz` | NO | Default `now()` |

**Constraints**

- PK(`id`); FK(`owner_id`) → `profiles`
- CHECK `status IN ('available','claimed','completed','cancelled','expired')`
- CHECK `expires_at > available_at`
- CHECK latitude/longitude ranges (e.g. lat `[-90,90]`, lng `[-180,180]`)
- **Partial unique index:** at most one non-terminal spot per owner:

```sql
CREATE UNIQUE INDEX parking_spots_one_open_per_owner
  ON parking_spots (owner_id)
  WHERE status IN ('available', 'claimed');
```

**Useful indexes**

- `(status, expires_at)` for map queries of available non-expired spots
- `(owner_id, created_at DESC)` for owner history

### 7.3 `claims`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NO | PK; default `gen_random_uuid()` |
| `spot_id` | `uuid` | NO | FK → `parking_spots(id)` |
| `seeker_id` | `uuid` | NO | FK → `profiles(id)` |
| `status` | `text` | NO | CHECK in claim statuses |
| `claimed_at` | `timestamptz` | NO | Default `now()` |
| `expires_at` | `timestamptz` | NO | Claim window end |
| `completed_at` | `timestamptz` | YES | Set on complete |
| `cancelled_at` | `timestamptz` | YES | Set on cancel |

**Constraints**

- PK(`id`); FKs to `parking_spots`, `profiles`
- CHECK `status IN ('active','completed','cancelled','expired')`
- CHECK `expires_at > claimed_at`
- **Partial unique index — one active claim per spot:**

```sql
CREATE UNIQUE INDEX claims_one_active_per_spot
  ON claims (spot_id)
  WHERE status = 'active';
```

- **Partial unique index — one active claim per seeker:**

```sql
CREATE UNIQUE INDEX claims_one_active_per_seeker
  ON claims (seeker_id)
  WHERE status = 'active';
```

**Useful indexes**

- `(seeker_id, claimed_at DESC)` for history
- `(spot_id, status)` for lookups

### 7.4 `credit_transactions`

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | `uuid` | NO | PK; default `gen_random_uuid()` |
| `user_id` | `uuid` | NO | FK → `profiles(id)` |
| `spot_id` | `uuid` | YES | FK → `parking_spots(id)`; null for `initial_grant` |
| `claim_id` | `uuid` | YES | FK → `claims(id)`; null for `initial_grant` |
| `amount` | `integer` | NO | Signed; CHECK `amount <> 0` |
| `transaction_type` | `text` | NO | CHECK in allowed types |
| `created_at` | `timestamptz` | NO | Default `now()` |

**Constraints**

- PK(`id`); FKs as above
- CHECK `transaction_type IN ('initial_grant','handoff_debit','handoff_credit')`
- Convention: `handoff_debit` amount `-1` for seeker; `handoff_credit`
  amount `+1` for owner; `initial_grant` amount `+5`
- **Uniqueness for idempotent completion** (partial unique indexes):

```sql
CREATE UNIQUE INDEX credit_tx_one_debit_per_claim
  ON credit_transactions (claim_id)
  WHERE transaction_type = 'handoff_debit';

CREATE UNIQUE INDEX credit_tx_one_credit_per_claim
  ON credit_transactions (claim_id)
  WHERE transaction_type = 'handoff_credit';
```

**Useful indexes:** `(user_id, created_at DESC)` for history.

## 8. Relationships between tables

```text
auth.users 1 ── 1 profiles
profiles 1 ── * parking_spots          (owner_id)
profiles 1 ── * claims                 (seeker_id)
profiles 1 ── * credit_transactions    (user_id)
parking_spots 1 ── * claims            (spot_id)
parking_spots 1 ── * credit_transactions (spot_id, optional)
claims 1 ── * credit_transactions      (claim_id, optional)
```

- A spot has at most one **active** claim (index + claim RPC).
- A completed handoff produces exactly two handoff transactions (debit +
  credit) linked to the same `claim_id` and `spot_id`.

## 9. Database constraints and indexes

| Concern | Mechanism |
|---------|-----------|
| Non-negative credits | `CHECK (credits >= 0)` on `profiles` |
| Valid statuses / types | `CHECK` on text columns |
| One open spot per user | Partial unique on `parking_spots(owner_id)` where status in (`available`,`claimed`) |
| One active claim per spot | Partial unique on `claims(spot_id)` where `status = 'active'` |
| One active claim per seeker | Partial unique on `claims(seeker_id)` where `status = 'active'` |
| No double payout | Partial unique on handoff debit/credit per `claim_id` |
| Claim race | `claim_spot` RPC locks spot row (`SELECT … FOR UPDATE`) then inserts/updates |
| Map performance | Index on `(status, expires_at)` |

Application constants (window lengths) are validated in Zod and stored as
`available_at` / `expires_at` / claim `expires_at`. Exact durations can be
tuned in implementation (e.g. spot window 30 minutes, claim window 15
minutes) without schema changes.

## 10. Authentication flow

1. User registers on `/register` with email, password, and display name only
   (Step 1 of 2). Vehicle data is **not** stored in auth metadata.
2. Supabase creates `auth.users` row.
3. DB trigger creates `profiles` (`credits = 5`, `role = 'user'`, vehicle
   columns NULL) and `initial_grant` transaction.
4. New users redirect to `/onboarding/vehicle` (Step 2 of 2) to save vehicle
   fields on `public.profiles` via server action.
5. `src/proxy.ts` refreshes the session and redirects unauthenticated users
   away from protected routes. Vehicle completeness is enforced in
   `AuthenticatedShell` (one profile query per protected page), not in proxy.
6. Incomplete users are redirected to onboarding except during an active
   handoff (`/map` with active claim, `/spots/new` with open spot).
7. User logs in on `/login`; post-auth redirect sends complete users to
   `/map` and incomplete users to onboarding (or active handoff route).
8. Logout clears the session via a Server Action.
9. If email confirmation redirects are enabled in Supabase, use a Route
   Handler at `/auth/callback` to exchange the code for a session.
   Prefer disabling mandatory email confirm in local/demo if it blocks the
   course demo — document the chosen Supabase Auth setting.

No OAuth providers in the MVP.

## 11. Authorization and Row Level Security strategy

### Principles

- Every table has RLS enabled.
- Policies use `auth.uid()`.
- Frontend checks are UX only.
- Privileged multi-row updates run inside `SECURITY DEFINER` functions that
  **re-check** `auth.uid()` and ownership/seeker rules before mutating.

### Suggested RLS (MVP)

**`profiles`**

- SELECT: authenticated users can read profiles needed for display (or
  restrict to own row + public display_name if tightened later).
- UPDATE: users can update only their own `display_name` (not `credits`,
  not `role`) — prefer column-level restriction or a dedicated function.
- INSERT: only via signup trigger (no direct client insert).

**`parking_spots`**

- SELECT: authenticated users can read spots (map filters available +
  non-expired in queries).
- INSERT: `owner_id = auth.uid()`.
- UPDATE/DELETE: prefer RPCs for status changes; if direct update allowed,
  only owner and only safe fields / statuses.

**`claims`**

- SELECT: seeker, spot owner, or (optionally) authenticated read of
  non-sensitive claim status for a spot they can see.
- INSERT/UPDATE: via RPCs only (`claim_spot`, `complete_claim`,
  `cancel_claim`, `cancel_spot`).

**`credit_transactions`**

- SELECT: `user_id = auth.uid()` only.
- INSERT: via trigger/RPC only (no direct client insert).

### `SECURITY DEFINER` implications

Functions that bypass RLS must:

1. Be owned by a privileged DB role.
2. Set a fixed `search_path` (e.g. `pg_catalog, public`) to avoid search-path
   attacks.
3. Immediately reject if `auth.uid()` is null.
4. Authorize explicitly (seeker/owner checks) before any write.
5. Perform all related writes in one transaction.
6. Be granted `EXECUTE` only to `authenticated` (not `anon`), unless a
   specific function must be public (none in this MVP).

Never put the **service-role** key in browser code or in Client Components.
Avoid service-role for normal user operations; prefer the patterns above.
If a service-role client is ever needed (e.g. rare admin script), it stays
server-only, env-protected, and out of the MVP user path.

### Vehicle identity UI (presentation)

- **Authoritative data:** make, model, color label, type label, and formatted
  license plate from `get_handoff_counterpart_vehicle` (active handoffs only).
- **Illustrations:** local SVG silhouettes in `VehicleIllustration`, one shared
  architecture with per-type paths in `illustration-silhouettes.tsx`. Colors use
  the controlled palette only; no brand logos or external imagery.
- **Representative only:** UI may note that the illustration is representative;
  text identity remains the source of truth for recognition.
- **Future extension:** `VehicleIllustration` accepts an optional `illustrationKey`
  prop for approved local/CDN assets later. Unknown keys fall back to the generic
  type silhouette. No database column in the MVP.
- **Handoff approach animation:** `HandoffVehicleAnimation` plays once per
  browser session (sessionStorage key per claim/spot) when a handoff becomes
  live. CSS transform/opacity only; `prefers-reduced-motion` shows the final
  frame immediately. Decorative only (`aria-hidden`).

### Seeker spot discovery carousel (presentation)

- Horizontal native-scroll carousel of compact spot cards over the seeker map.
- Synchronized with map markers via a single `selectedId` in `ParkingMapMapLibre`.
- Distance is approximate Haversine only (not ETA); omitted when location is unknown.
- Availability labels update on a shared minute-level tick; SelectedSpotCard keeps
  the precise countdown and claim CTA.
- Hidden while an active claim overlay is shown.

### Application feedback (presentation)

- Global client toasts via `AppFeedbackRoot` → `FeedbackShell` (`FeedbackProvider` +
  `FeedbackViewport`) + `FeedbackUrlListener`, mounted once in the root layout.
- Queue max **2** items; success/info auto-dismiss sooner than errors; manual
  dismiss; no persistence (no DB / localStorage).
- Accessibility: success/info `role="status"` + `aria-live="polite"`; errors
  `role="alert"`; dismiss labeled; no autofocus; CSS motion respects
  `prefers-reduced-motion`.
- Placement: mobile above the safe-area bottom inset; desktop
  top-right under the header.
- Canonical RPC/app codes map through `mapAppError` / `APP_ERROR_MESSAGES` —
  never raw Supabase/SQL text, UUIDs, or status enums in UI. Do not log handoff
  codes or license plates.
- **Field vs toast:** Zod/field validation stays inline. Toast for network, RPC
  rejection, and mutation success. Exception: `INVALID_HANDOFF_CODE` and
  `HANDOFF_TEMPORARILY_LOCKED` stay next to the code input only (no duplicate toast).
- **Redirect-safe success:** allowlisted `?feedback=` keys only
  (`FEEDBACK_SUCCESS_KEYS`); consumed once by `FeedbackUrlListener` then stripped
  via `router.replace`. No arbitrary messages or sensitive values in query params.
- Mutation buttons use consistent pending labels (`Sharing…`, `Claiming…`,
  `Verifying…`, etc.) + `Button` `loading`/`disabled`/`aria-busy`.
- No automatic retries for state-changing operations.

### Two-intent navigation (presentation)

- Authenticated chrome exposes exactly two primary intents:
  **Find parking** (`/map`) and **Share a spot** (`/spots/new`).
- One shared `ModeSwitch` in the header; the current route is authoritative.
  localStorage mode is a secondary convenience only.
- Profile and Log out live in a compact `ProfileMenu` (no permanent Log out
  button; no My spot / Looking / Leaving labels).
- Mobile: brand + profile on the first row; full-width mode switch on the
  second. No bottom tab bar.
- Desktop: brand, mode switch, and profile on one row.
- Mode content uses a short CSS fade/slide (`motion-mode-content`); the
  sliding mode pill uses `motion-mode-pill` (~200ms ease-out). Respect
  `prefers-reduced-motion`.
- Publish CTA copy is **Share spot** / **Sharing…**.

## 12. Server Actions or Route Handlers

### Server Actions (default)

| Action | Purpose |
|--------|---------|
| `register` / rely on client auth helpers + trigger | Sign-up path as implemented |
| `login` / `logout` | Session management wrappers if used |
| `publishSpot` | Create `available` spot |
| `claimSpot` | Call `claim_spot` RPC |
| `completeClaim` | Call `complete_claim` RPC (seeker only) |
| `cancelClaim` | Call `cancel_claim` RPC (seeker only) |
| `cancelSpot` | Call `cancel_spot` RPC (owner; cancels active claim too) |
| `updateProfile` | Update display name |

### Route Handlers

- Use only when technically required (e.g. `/auth/callback` for Supabase
  PKCE/email redirect).
- Do not implement core business mutations as REST Route Handlers.

## 13. Main CRUD operations

### 13.1 Register

| | |
|--|--|
| **Who** | Anonymous |
| **Input** | email, password, display_name |
| **Validation** | Zod: email format, password min length, non-empty display_name |
| **DB changes** | `auth.users` insert; trigger → `profiles` + `initial_grant` (+5) |
| **Errors** | Email already registered; weak password; validation failure |
| **Result** | Session (if confirm disabled) or “check email”; profile with 5 credits |

### 13.2 Login / logout

| | |
|--|--|
| **Who** | Anonymous (login) / authenticated (logout) |
| **Input** | email, password / none |
| **Validation** | Zod for login fields |
| **DB changes** | None beyond Auth session |
| **Errors** | Invalid credentials |
| **Result** | Redirect to `/map` or cleared session |

### 13.3 Publish spot

| | |
|--|--|
| **Who** | Authenticated user with no non-terminal spot |
| **Input** | latitude, longitude, optional address, available_at, expires_at |
| **Validation** | Zod: required coords, `expires_at > available_at`, windows within allowed bounds |
| **DB changes** | INSERT `parking_spots` with `status = 'available'`, `owner_id = auth.uid()` |
| **Errors** | Unauthenticated; validation; already has available/claimed spot (unique index); invalid times |
| **Result** | New spot visible on map (until expiry/claim) |

### 13.4 List / browse available spots

| | |
|--|--|
| **Who** | Authenticated |
| **Input** | None or simple bounds (optional) |
| **Validation** | N/A or Zod for optional filters |
| **DB changes** | Lazy: spots with `expires_at < now()` and status in (`available`,`claimed`) may be marked `expired` (and active claims expired) when the page/action runs |
| **Errors** | Unauthenticated |
| **Result** | Spots with `status = 'available'` and `expires_at > now()` (expired hidden) |

### 13.5 Claim spot (`claim_spot` RPC)

| | |
|--|--|
| **Who** | Authenticated seeker ≠ owner |
| **Input** | `spot_id` |
| **Validation** | Zod UUID; SQL re-validates all rules |
| **DB changes (atomic)** | `SELECT spot FOR UPDATE`; lazy-expire check; require `status = 'available'`; require seeker credits ≥ 1; require seeker has no active claim; require seeker ≠ owner; INSERT claim `active`; UPDATE spot `claimed` |
| **Errors** | Not available; expired; own spot; insufficient credits; seeker already has active claim; spot already claimed (unique violation / RPC error) |
| **Result** | Active claim; spot `claimed`; **no** credit balance change |

### 13.6 Complete claim (`complete_claim` RPC)

| | |
|--|--|
| **Who** | Seeker of the active claim only |
| **Input** | `claim_id`, `handoff_code` (5-digit string) |
| **Validation** | Zod UUID + handoff code schema; SQL: `seeker_id = auth.uid()`, status active, not expired, bcrypt code verify |
| **DB changes (atomic, idempotent)** | Lock claim → spot → secret → profiles (deterministic profile order); if already `completed`, return success without new txs and without requiring the code; else verify code with attempt throttling; set claim `completed`; set spot `completed`; insert one `handoff_debit` and one `handoff_credit`; update credits |
| **Errors** | `INVALID_HANDOFF_CODE`, `HANDOFF_TEMPORARILY_LOCKED`, `HANDOFF_UNAVAILABLE`, not seeker, insufficient credits |
| **Result** | Completed handoff; seeker −1; owner +1; two transaction rows |

**Handoff secrets:** stored in private table `claim_handoff_secrets` with RLS
and no direct client access. One secret is created atomically in `claim_spot`.
Owner retrieves plaintext code via `get_handoff_code`; seeker never receives
the code through any RPC.

**Attempt throttling:** max 5 incorrect attempts, then 2-minute lockout.
No credit movement on failed or locked attempts.

**Note:** Credits are checked at claim (≥ 1) and again at complete so a
seeker cannot complete if their balance was reduced by another completed
handoff in between (MVP has at most one active claim, but balance can still
change only via completion — still re-check for safety).

### 13.7 Cancel claim (`cancel_claim` RPC)

| | |
|--|--|
| **Who** | Seeker of the active claim |
| **Input** | `claim_id` |
| **Validation** | Zod UUID; SQL ownership of claim |
| **DB changes** | Claim → `cancelled` + `cancelled_at`; spot → `available` if spot not past `expires_at`, else `expired`; **no** credit txs |
| **Errors** | Not seeker; not active; already terminal |
| **Result** | Claim cancelled; balances unchanged |

### 13.8 Cancel spot (`cancel_spot` RPC)

| | |
|--|--|
| **Who** | Spot owner |
| **Input** | `spot_id` |
| **Validation** | Zod UUID; SQL `owner_id = auth.uid()` |
| **DB changes (atomic)** | If spot `available`: set `cancelled`. If spot `claimed`: set active claim `cancelled` + `cancelled_at`, set spot `cancelled`. No credit changes. |
| **Errors** | Not owner; spot already terminal |
| **Result** | Spot cancelled; any active claim cancelled; balances unchanged |

### 13.9 Read profile / history

| | |
|--|--|
| **Who** | Authenticated self |
| **Input** | None |
| **Validation** | Session only |
| **DB changes** | Optional lazy expiry maintenance |
| **Errors** | Unauthenticated |
| **Result** | Own profile; own spots/claims/transactions |

## 14. Parking spot lifecycle

```text
                  publish
                     │
                     ▼
                available ──────── expires (lazy) ──► expired
                     │
                     │ claim
                     ▼
                 claimed ───────── expires (lazy) ──► expired
                     │                │
        complete     │                │ owner cancel / seeker cancel*
                     ▼                ▼
                completed         cancelled
```

\*Seeker cancel on an active claim returns the spot to `available` if still
within `expires_at`, otherwise `expired`. Owner `cancel_spot` always ends in
spot `cancelled` and cancels any active claim.

Terminal statuses: `completed`, `cancelled`, `expired`.  
Non-terminal: `available`, `claimed` (limit: one per owner).

## 15. Claim lifecycle

```text
        claim_spot
            │
            ▼
         active ─── lazy expiry ──► expired
            │
            ├── seeker complete_claim ──► completed  (credits transfer once)
            ├── seeker cancel_claim   ──► cancelled  (no credits)
            └── owner cancel_spot     ──► cancelled  (no credits)
```

Only the **seeker** may complete. Only one `active` claim per spot and per
seeker (partial unique indexes + RPC checks).

## 16. Credit transaction logic

| Event | Seeker balance | Owner balance | Transactions |
|-------|----------------|---------------|--------------|
| Register | +5 | — | `initial_grant` +5 |
| Claim | unchanged | unchanged | none |
| Complete (first time) | −1 | +1 | `handoff_debit` −1, `handoff_credit` +1 |
| Complete (retry) | unchanged | unchanged | none (idempotent) |
| Cancel claim / cancel spot / expire | unchanged | unchanged | none |

Rules:

- Require `credits >= 1` before claim and before applying complete debit.
- Never deduct or hold on claim.
- Never change balances on cancel/expire.
- Idempotency via claim status check + unique indexes on handoff txs per
  `claim_id`.

## 17. Data validation with Zod

Place schemas in `src/lib/validations/`. Server Actions parse with
`.safeParse` / `.parse` before any DB call.

| Schema | Fields (indicative) |
|--------|---------------------|
| `registerSchema` | email, password, display_name |
| `loginSchema` | email, password |
| `publishSpotSchema` | latitude, longitude, address optional, available_at, expires_at |
| `claimSpotSchema` | spot_id (uuid) |
| `completeClaimSchema` | claim_id (uuid) |
| `cancelClaimSchema` | claim_id (uuid) |
| `cancelSpotSchema` | spot_id (uuid) |
| `updateProfileSchema` | display_name |

Zod enforces types and obvious ranges; SQL enforces authorization and
concurrency.

## 18. State management approach

- **Server Components** load spots, profile, and history from Supabase.
- **Server Actions** perform mutations and `revalidatePath` / `revalidateTag`.
- **Client Components** only for map, interactive forms, and local UI state.
- No Redux, Zustand, or global client store.
- URL + server data are the source of truth after each mutation.

## 19. Error handling strategy

1. Zod failures → field-level or form-level messages; no DB call.
2. Auth failures → redirect or “sign in required”.
3. RPC / constraint failures → map known Postgres error codes / RPC messages
   to stable app error codes, e.g. `SPOT_UNAVAILABLE`, `INSUFFICIENT_CREDITS`,
   `OWN_SPOT`, `ACTIVE_CLAIM_EXISTS`, `OPEN_SPOT_EXISTS`.
4. Unexpected errors → generic message; log server-side.
5. Actions return a result object `{ ok: true, data } | { ok: false, error }`
   instead of throwing opaque errors to the client whenever practical.

## 20. Loading and empty states

| Surface | Loading | Empty |
|---------|---------|-------|
| `/map` | Map skeleton / “Loading spots…” | “No available spots nearby. Publish one or check back.” |
| `/history` | List placeholder | “No activity yet.” |
| `/profile` | Soft placeholder | N/A (profile always exists after signup) |
| Claim/publish buttons | Disabled + pending state on submit | — |
| Spot details | Panel spinner | Spot no longer available |

Expired spots are omitted from available lists (lazy expiry + filter).

## 21. Security-sensitive decisions

1. Email/password Auth only; sessions via httpOnly cookies (`@supabase/ssr`).
2. RLS on all app tables; no anon writes to business tables.
3. Credits and roles not updatable by general profile UPDATE policy.
4. Claim/complete/cancel via authenticated RPCs with `auth.uid()` checks.
5. `SECURITY DEFINER` functions locked down (`search_path`, execute grants).
6. No service-role key in browser or Client Components.
7. Zod validation on every mutation input.
8. Race-safe claim with row lock + partial unique indexes.
9. Idempotent completion with unique handoff transactions.
10. Middleware protects product routes; `/` stays public.
11. Clear UI copy: the app coordinates handoffs; it does not guarantee the
    physical spot.

## 22. Testing boundaries

| Layer | What to test | What not to over-test |
|-------|--------------|------------------------|
| Unit | Pure helpers; credit rules; status transitions | Full Next.js wiring |
| SQL / integration (if feasible) | Claim race; double complete; cancel spot with active claim | Entire Supabase hosted setup in every run |
| Component | Forms validation messaging; empty states | Leaflet internals |
| E2E | Register → publish → other user claim → complete; double-claim fails; cancel does not change credits | Visual pixel perfection |

Central flows for automated coverage: claim concurrency, completion
idempotency, cancel/expire credit neutrality.

## 23. Deployment architecture

```text
Vercel (Next.js)
  env: NEXT_PUBLIC_SUPABASE_URL
       NEXT_PUBLIC_SUPABASE_ANON_KEY
       (no service role in frontend env)

Supabase project
  Auth (email/password)
  Postgres + migrations from supabase/migrations
  RLS + RPCs
```

- Apply schema via migration files (not manual-only dashboard edits for
  final state).
- Preview/production Vercel projects point at the appropriate Supabase
  project (one project is enough for the course demo).
- Document required Auth URL config for local and production redirects.

## 24. Technical limitations and future improvements

### MVP limitations

- Lazy expiry only (no cron); expired rows update when touched/read paths
  run.
- No realtime map subscriptions (refresh on navigation / after actions).
- No push notifications or chat.
- Single role `user`; no admin UI.
- Completion requires seeker-entered handoff code verified against a private
  server-side secret; owner sees the code during active claims only.
- Leaflet/OSM accuracy depends on user pin placement.
- At most one open spot and one active claim per user (simplifies demo and
  concurrency).

### Possible future improvements

- Scheduled expiry job or Supabase cron.
- Realtime spot updates.
- Owner confirmation step for completion.
- OAuth providers.
- Admin role + moderation tools (using existing `role` column).
- Stronger geospatial queries (PostGIS).
- Notifications before claim/spot expiry.

---

## Appendix A – Approved numeric defaults

| Constant | Value |
|----------|-------|
| Starting credits | 5 |
| Handoff debit (seeker) | 1 |
| Handoff credit (owner) | 1 |
| Credits held on claim | 0 (none) |
| Minimum credits to claim | 1 |

## Appendix B – Status and type catalogs

**`parking_spots.status`:** `available` | `claimed` | `completed` | `cancelled` | `expired`  
**`claims.status`:** `active` | `completed` | `cancelled` | `expired`  
**`credit_transactions.transaction_type`:** `initial_grant` | `handoff_debit` | `handoff_credit`  
**`profiles.role`:** `user` (MVP only)
