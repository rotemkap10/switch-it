# Gap analysis — RUNI Internet Technologies final submission

This file compares the **official assignment PDF** requirements against the **current Switch It repository**.

Legend:

- **COMPLETE** — implemented and/or documented in this pack
- **PARTIAL** — exists but incomplete, or needs student action before submit
- **MISSING** — required for submission but not finished

| Assignment requirement | Status | Evidence in repository | Recommended action before submission | Priority |
| --- | --- | --- | --- | --- |
| 1. Choose a web product with real business meaning | COMPLETE | Parking handoff product in `README.md`, `/map`, `/spots/new` | Keep two demo accounts ready | LOW |
| 2. Product specification document | COMPLETE (this pack) | `01-product-spec.md` + `submission/product-specification.md` | Submit this pack | LOW |
| 3. Software architecture planning | COMPLETE (this pack) | `02-technical-design.md` | Review Mermaid diagrams against live demo | LOW |
| 4. Detailed technical design | COMPLETE (this pack) | `02-technical-design.md` | Study RPCs before presentation | HIGH (study) |
| 5. Implement with Next.js + TypeScript + Supabase (+ Vercel deploy) | COMPLETE | `package.json` (`next@16.2.12`, TS, `@supabase/*`); live [https://switch-it-wine.vercel.app](https://switch-it-wine.vercel.app); GitHub [https://github.com/rotemkap10/switch-it](https://github.com/rotemkap10/switch-it) | Confirm production Supabase has latest migrations + `handoff-seeker-location` | HIGH |
| 6. Test specification document | COMPLETE (this pack) | `03-test-plan.md` + `submission/test-specification.md` | Keep test counts in sync after last `npx vitest run` | LOW |
| 7. Implement tests for main flows | COMPLETE | Vitest + Testing Library; **277 files / 1744 tests** (`npx vitest run`, this pass) | Re-run once more immediately before submit if more code lands | MEDIUM |
| 8. Basic scalability document | COMPLETE (this pack) | `04-scale.md` + `submission/scale.md` | Submit this pack | LOW |
| 9. Basic security document | COMPLETE (this pack) | `05-security.md` + `submission/security.md` | Prepare honest fraud/Sybil + anti-enumeration answers | HIGH (study) |
| 10. Deploy to Vercel + Supabase; live URL, GitHub URL, local run, env explanation | COMPLETE (documented) | `06-local-setup.md` + `README.md`; production URL and GitHub URL recorded | Confirm the live URL still loads; `npx supabase db push` on production; deploy `handoff-seeker-location`. A `vercel.json` is **not** required | HIGH |
| 11. Optional coding agents; student must understand everything | COMPLETE (process) | Study guide: `08-system-study-guide.md` | Fill `docs/AI_USAGE.md` if the course asks for AI disclosure | MEDIUM |
| 12. 10–15 minute presentation | PARTIAL — outline complete; **PPT/PDF deck is not in the repository** | `07-presentation-outline.md` | Build the actual slide deck from the outline; rehearse 12–13 minutes with two devices | HIGH |
| Authentication | COMPLETE | Email/password; Confirm email; Forgot password (`/forgot-password` → `/auth/reset-password`); `/login`, `/register`, `/auth/callback`; `src/proxy.ts` | Be ready to explain cookie session refresh + anti-enumeration UX | MEDIUM |
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
- Not a substitute for confirming the live URL still loads, or for oral understanding.

# Repository references

- Assignment PDF (course handout)
- `package.json`
- `README.md`
- `docs/final-submission/` (canonical) and `submission/` (copies for upload)
- `supabase/migrations/`
- `src/app/`, `src/actions/`, `src/lib/`, `src/components/`
