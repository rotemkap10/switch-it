# Local development / run instructions — Switch It

Accurate setup instructions for this repository. **No secret values** are included.

---

# Prerequisites

- Node.js (compatible with Next.js 16; use a current LTS)
- npm
- Git
- A Supabase project (cloud) **or** local Supabase CLI workflow you already use for this repo
- Optional: Supabase CLI (`npx supabase`) for `db push`

---

# Clone

```bash
git clone <YOUR_GITHUB_REPO_URL>
cd switch-it
```

The development remote observed during documentation audit:

```text
git@github.com:rotemkap10/switch-it.git
```

Use your submission GitHub URL on the cover sheet.

---

# Install dependencies

```bash
npm install
```

---

# Environment variables

Copy the example file:

```bash
cp .env.example .env.local
```

`.env.example` currently lists:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_MAPTILER_API_KEY=
```

Also used by the app (set in `.env.local` as needed):

| Name | Required for | Why |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Almost everything | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Almost everything | User-scoped Supabase key (RLS) |
| `NEXT_PUBLIC_MAPTILER_API_KEY` | Maps + geocoding | MapLibre style + MapTiler geocoding |
| `NEXT_PUBLIC_CARIMAGES_API_KEY` | Vehicle catalog images | Public CarImages JS-loader key (generic fallback if missing) |
| `NEXT_PUBLIC_PWA_DEV=true` | Optional | Enable service worker during local `next dev` |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable.

Do not commit `.env.local`.

### Auth — Confirm email (required for new accounts)

Switch It expects Supabase Auth **Confirm email** to be enabled so new registrations must verify before entering the app.

**Local (`supabase/config.toml`):**

```toml
[auth.email]
enable_confirmations = true
```

After changing this, restart local Supabase (`npx supabase stop && npx supabase start`) so Auth picks it up. In-app Mailpit / Inbucket (or your local SMTP) receives confirmation messages.

**Production (Supabase Dashboard — manual):**

1. Authentication → Providers → Email → enable **Confirm email**.
2. Authentication → URL configuration:
   - **Site URL** = your production app origin (e.g. `https://your-app.vercel.app`)
   - **Redirect URLs** include `https://your-app.vercel.app/auth/callback` (and any preview origins you use)
3. Optional: customize the Confirm signup email template; the confirmation link must keep `{{ .ConfirmationURL }}` (or equivalent) so users land on `/auth/callback`.

**Signup + existing emails:** With Confirm email on, production Auth often returns a successful-looking `signUp` response for an address that already has an account (anti-enumeration). Local GoTrue sometimes returns `User already registered` instead. The app only shows the hard “already exists” message when that explicit error appears; otherwise it uses the neutral Check your email + Sign in hint UX.

**Forgot password:** Login → `/forgot-password` → Supabase `resetPasswordForEmail` with `redirectTo` = `{origin}/auth/callback?next=/auth/reset-password`. After the user opens the email link, `/auth/callback` exchanges the PKCE code and sends them to `/auth/reset-password` to set a new password (shared password policy). The existing Redirect URL wildcard `https://switch-it-wine.vercel.app/**` covers this path. Default **Reset Password** email template (`{{ .ConfirmationURL }}`) is sufficient when Site URL / Redirect URLs are set correctly — no app-side Dashboard change.

No `npx supabase db push` is required for this Auth setting alone.

### Auth — Password policy

Production Dashboard password policy should require:

- minimum **8** characters
- uppercase + lowercase + digit + symbol (`lower_upper_letters_digits_symbols`)

Local `supabase/config.toml` mirrors that (`minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits_symbols"`). The app validates the same rules for Create Account UX via `src/lib/auth/password-policy.ts`; **Supabase Auth remains the final enforcer**. Login does **not** apply this policy locally.

Restart local Supabase after changing password settings in `config.toml`.

---

# Supabase setup / migrations

1. Create or link a Supabase project.
2. Apply migrations with your linked workflow, for example:

```bash
npx supabase db push
```

Migrations live in:

```text
supabase/migrations/
```

Important: product timing/reclaim behavior depends on **latest** migrations being applied on the remote database.

Edge Functions under `supabase/functions/` are required for the **native live-location bridge** (`handoff-seeker-location`). Deploy after migrations:

```bash
npx supabase functions deploy handoff-seeker-location
```

They are optional for the core **web-only** publish/claim/complete demo (web live location uses client Broadcast). Experimental push paths also live under `supabase/functions/`.

---

# Development server

```bash
npm run dev
```

Open the local URL Next prints (typically `http://localhost:3000`).

---

# Quality commands

From `package.json`:

```bash
npm run lint
npm run test:run
npm run build
```

Useful related scripts:

```bash
npm run test          # Vitest watch
npm run test:watch
npm run start         # production server after build
```

---

# Production build (local verification)

```bash
npm run build
npm run start
```

---

# Deployment notes (submission)

Assignment requires:

1. **Live Vercel URL** for the app  
2. **GitHub** repository URL  
3. These local instructions  
4. Short env explanation (table above)

A Next.js app on Vercel does **not** require a `vercel.json` for this assignment. Deploy with the standard Next.js Vercel integration and set the same `NEXT_PUBLIC_*` variables in the Vercel project.

After deploy, confirm:

- the linked **production Supabase** project is the one the app uses
- latest migrations are applied (`npx supabase db push`), including security hardening (`20260823100000` through `20260823120000`)
- if using native live location: Edge Function `handoff-seeker-location` is deployed

---

# Native / Capacitor (optional)

Not required for the core web course demo. See `native/README.md` if discussing the native pilot.

---

# Repository references

- `package.json`
- `.env.example`
- `README.md` (Local setup / Environment variables)
- `supabase/migrations/`
- `next.config.ts`
- `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`
