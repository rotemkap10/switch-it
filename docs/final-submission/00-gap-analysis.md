# Gap analysis — RUNI Internet Technologies final submission

This file compares the **official assignment PDF** requirements against the **current Switch It repository**.

Legend:

- **COMPLETE** — implemented and/or documented in this pack
- **PARTIAL** — exists but incomplete, or needs student action before submit
- **MISSING** — required for submission but not finished

| Assignment requirement | Status | Evidence in repository | Recommended action before submission | Priority |
| --- | --- | --- | --- | --- |
| 1. Choose a web product with real business meaning | COMPLETE | Parking handoff product in `README.md`, `/map`, `/spots/new` | Keep two demo accounts ready | LOW |
| 2. Product specification document | COMPLETE (this pack) | `01-product-spec.md` | Prefer this pack over older `docs/PRODUCT_SPEC.md` | MEDIUM |
| 3. Software architecture planning | COMPLETE (this pack) | `02-technical-design.md` | Review Mermaid diagrams against live demo | LOW |
| 4. Detailed technical design | COMPLETE (this pack) | `02-technical-design.md` | Study RPCs before presentation | HIGH (study) |
| 5. Implement with Next.js + TypeScript + Supabase (+ Vercel deploy) | COMPLETE (code) / PARTIAL (deploy proof) | `package.json` (`next@16.2.12`, TS, `@supabase/*`); GitHub remote present | Attach **live Vercel URL** on the submission cover sheet; confirm production Supabase has latest migrations | HIGH |
| 6. Test specification document | COMPLETE (this pack) | `03-test-plan.md` | Do not submit stale older `docs/TEST_PLAN.md` sections | HIGH |
| 7. Implement tests for main flows | COMPLETE | Vitest + Testing Library; **235 files / 1414 tests** (`npm run test:run`, re-verified) | Re-run once more before submit | MEDIUM |
| 8. Basic scalability document | COMPLETE (this pack) | `04-scale.md`; older `docs/SCALABILITY.md` is empty | Submit this pack | MEDIUM |
| 9. Basic security document | COMPLETE (this pack) | `05-security.md`; older `docs/SECURITY.md` is empty | Prepare honest fraud/Sybil answers | HIGH (study) |
| 10. Deploy to Vercel + Supabase; live URL, GitHub URL, local run, env explanation | PARTIAL | Local instructions: `06-local-setup.md` + `README.md`; GitHub remote present | Confirm live Vercel URL, production Supabase project, and `npx supabase db push` applied. A `vercel.json` is **not** required for a standard Next.js Vercel deploy | HIGH |
| 11. Optional coding agents; student must understand everything | COMPLETE (process) | Study guide: `08-system-study-guide.md` | Fill `docs/AI_USAGE.md` if the course asks for AI disclosure | MEDIUM |
| 12. 10–15 minute presentation | PARTIAL — presentation outline is complete; final slide deck still needs to be created | `07-presentation-outline.md` | Build PPT/PDF from the outline; rehearse 12–13 minutes with two devices | HIGH |
| Authentication | COMPLETE | Supabase email/password; `/login`, `/register`, `/auth/callback`; `src/proxy.ts` | Be ready to explain cookie session refresh | MEDIUM |
| Database with meaningful entities | COMPLETE | `profiles`, `parking_spots`, `claims`, `credit_transactions` (+ support tables) | Know status enums and unique indexes | HIGH |
| Server Actions / backend mutations | COMPLETE | `src/actions/*` + Postgres RPCs | Explain why claim/complete live in SQL | HIGH |
| Authorization / permissions | COMPLETE | RLS + RPC `auth.uid()` checks | Give a concrete “cannot steal another claim” example | HIGH |
| External services | COMPLETE | MapTiler, CarImages, Supabase Auth/Realtime | Distinguish public `NEXT_PUBLIC_*` keys vs service role | MEDIUM |
| Meaningful automated tests | COMPLETE | Large Vitest suite including migration SQL contract tests and UI/actions | Note: **no Playwright E2E project** in `package.json` | MEDIUM |
| Pagination where appropriate | COMPLETE | History keyset pagination (`HISTORY_PAGE_SIZE = 20`, RPC `get_handoff_history`) | Map discovery is not geo-paginated (honest limitation) | LOW |
| Indexes | COMPLETE | See `04-scale.md` | Mention discovery still loads available spots without PostGIS | MEDIUM |
| Input validation | COMPLETE | Zod on actions + DB CHECKs/RPC raises | Mention plate digits validated in RPC | LOW |
| Secrets handling | COMPLETE (pattern) | `.env.example` placeholders; no secrets in examples | Verify `.env.local` not committed; never put service role in `NEXT_PUBLIC_` | HIGH |

## Risks that may raise instructor questions

| Risk | Why it matters | Mitigation for submission |
| --- | --- | --- |
| Older docs contradict current product | Root `docs/TECHNICAL_DESIGN.md` / `TEST_PLAN.md` lag; empty scale/security stubs | Submit **`docs/final-submission/`** as authoritative |
| Push wording | Infra exists, but production iOS/APNs delivery is not fully verified | Describe push as **optional/experimental**, not a core verified MVP feature |
| Leaflet still in dependencies | Seeker map is MapLibre + MapTiler; Leaflet is legacy/alternate | Say primary map stack is MapLibre + MapTiler |
| Geographic discovery without PostGIS | Available spots queried by status + `expires_at`; distance enforced at **claim** (1500 m) | Honest scale answer for MVP density |
| Public parking cannot be reserved | Product limitation, not a bug | Lead with this — shows product maturity |
| Multi-account / credit farming | App does not prove one-human-one-account | Use residual-risk wording from `05-security.md` |
| Deployed migration lag | Timing/reclaim behavior depends on latest RPCs | Before demo: `npx supabase db push` |

## What this gap analysis is *not*

- Not a claim that every older document in `docs/` is accurate.
- Not a claim that Playwright E2E exists (it does **not** in `package.json`).
- Not a claim that production push delivery is fully verified.
- Not a substitute for your live Vercel URL and oral understanding.

# Repository references

- Assignment PDF (course handout)
- `package.json`
- `README.md`
- `docs/PRODUCT_SPEC.md`, `docs/TECHNICAL_DESIGN.md`, `docs/TEST_PLAN.md`, `docs/SCALABILITY.md`, `docs/SECURITY.md`, `docs/AI_USAGE.md`
- `supabase/migrations/`
- `src/app/`, `src/actions/`, `src/lib/`, `src/components/`
