# DEVELOPER_HANDOFF.md — FastRev (Student Review System)

The fastest way to understand this project. Read this first, then
`PROJECT_CONTEXT.md` (current state + conventions), then
`PROJECT_ARCHITECTURE.md` (architecture), then the source.

---

## 1. What this project is

FastRev is a **free-tier spaced-repetition flashcard web app**. Students keep
decks of Q/A cards, generate cards from their own study material with AI
(paste notes or import PDF / image / .docx / .txt), review them daily with the
FSRS scheduling algorithm, and track progress on an analytics dashboard.

- Single-page React app, static-hosted on Vercel — **there is no application
  server**. All data lives in Supabase (Postgres + Auth + Row Level Security).
- AI calls go **directly from the browser** to Gemini → Groq → Cerebras using
  the user's own free-tier API keys (stored in localStorage).
- Hard project constraint: **zero monetary cost** — free tiers only.

## 2. Current status

**Completed (Phases 0–13, 2026-10-04 → 2026-10-07):**

- Core app: auth, deck/card CRUD, FSRS review with keyboard flow, AI
  generation + material import, analytics, settings.
- Full UI/UX program: design system, app shell/navigation, dashboard, review
  focus mode, upload workspace, analytics, auth redesign, motion/feedback,
  app-wide QA pass, usability audit (12/18 issues fixed).
- Performance audit: Lighthouse (lab) 88/98/100/82 → **94/100/100/100**;
  initial JS chunk split 1,150.61 → 657.37 kB.
- Security audit: SEC-01…SEC-26 — no Criticals; headers/CSP, safe errors,
  input caps, config fail-safe shipped; secrets scans clean.
- Cross-browser/device QA: **179/179 automated checks** (headless Chrome,
  production build, mocked backend).
- Phase 14 (this): documentation finalized and cross-checked against source;
  `DEVELOPER_HANDOFF.md` created.

**Still pending (real, confirmed — see `PRODUCTION_CHECKLIST.md`):**

1. **Run `supabase/migrations/0002_authorization_hardening.sql`** in the SQL
   Editor and verify live RLS — SECURITY_AUDIT **SEC-05**, the only open
   High-severity item.
2. Verify Vercel env vars exist **at build time** and confirm security headers
   on the deployed URL.
3. Live end-to-end smoke (signup → deck → generate → review → analytics) with
   real credentials — never performed from this environment.
4. Manual browser pass on Safari/Firefox and a physical phone (Chromium-only
   automation so far), plus real-AI CORS check for Groq/Cerebras.
5. Deck rename has no UI (USABILITY_AUDIT **U-08**) — hook exists, needs a
   shared decks context to build properly.

## 3. Tech stack (actual — verify against `package.json`)

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite 8, **JavaScript/JSX only** (no TypeScript) |
| Styling | Tailwind CSS v4 CSS-first — tokens in `src/index.css`, **no `tailwind.config.js`** |
| UI | shadcn/ui (JavaScript mode), `radix-ui`, `lucide-react`, `cn`, `class-variance-authority` |
| Backend | Supabase (PostgreSQL + Auth + RLS) via `@supabase/supabase-js` |
| Scheduling | `ts-fsrs` (FSRS algorithm; `generatorParameters({ enable_fuzz: true })`) |
| Routing | `react-router-dom` v7 |
| Charts | `recharts` (only loaded by the lazy `/analytics` route) |
| Toasts | `sonner` (**framer-motion is not installed — do not add it**) |
| Import | `pdfjs-dist` (legacy build), `mammoth`, Gemini vision OCR |
| Font | Inter Variable (`@fontsource-variable/inter`) |
| Animation | `tw-animate-css` + CSS transitions + global reduced-motion clamp |
| Lint | oxlint (`npm run lint`) — 1 tolerated pre-existing warning |
| Hosting | Vercel static (`vercel.json` = security headers + CSP) |

No test runner, no typechecker, no state library, no CSS-in-JS.

## 4. How to run

From `package.json` — these are the **only** scripts that exist:

```sh
npm install       # dependencies
copy .env.example .env   # then fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev       # dev server on http://localhost:5173
npm run build     # production build → dist/
npm run preview   # serve the built dist/ (note: no vercel.json headers here)
npm run lint      # oxlint
```

Do **not** document or run `npm run test` / `npm run typecheck` — they do not
exist. Prerequisites: Node 20.19+ (Node 22/24 LTS recommended), npm.
Full setup (Supabase schema, AI keys, deploy) is in `README.md`.

## 5. Important files

| File | Why it matters |
| --- | --- |
| `src/App.jsx` | route table, guards (`ProtectedLayout`/`GuestRoute`), `React.lazy` split, production config fail-safe |
| `src/main.jsx` | ErrorBoundary → BrowserRouter → AuthProvider → App + global sonner `<Toaster>` |
| `src/index.css` | **the entire design system** — every token, both themes, base rules, reduced-motion clamp |
| `src/lib/nav.js` | single source of navigation (`NAV_ITEMS`, `getPageMeta`, link classes) |
| `src/lib/ratings.js` | single source for Again/Hard/Good/Easy (value, label, variant, keys 1–4) |
| `src/lib/ai.js` | provider chain, pinned model IDs, `AiError` codes, localStorage key helpers |
| `src/lib/extract.js` | file → text dispatcher (PDF/docx/image/txt) + size/type guards |
| `src/lib/fsrs.js` | ts-fsrs wrapper (`scheduleCard`, `createEmptyCardFSRS`, `Rating`) |
| `src/lib/supabase.js` | client singleton + `supabaseConfigured` guard |
| `src/lib/authForm.js` / `src/lib/errors.js` | validation + friendly error mapping (**sanitize at render, hooks keep raw**) |
| `src/hooks/use*.js` | all Supabase data access — the only place queries live |
| `src/pages/Review.jsx` | session logic: keyboard, focus management, submit flow (presentation is in components) |
| `src/pages/Upload.jsx` | generation workspace: import → generate → preview → save |
| `src/components/AppShell.jsx` | sidebar/top bar/main/bottom nav; route fade; owns `<h1>` and `<main>` |
| `supabase/schema.sql` | canonical DB schema — run in the SQL Editor |
| `vercel.json` | all security headers + CSP (not applied by dev/preview) |

## 6. Architecture (short version)

```
User → Browser (React 19 SPA, static files from Vercel)
         ├── react-router-dom guards: /auth guest-only, everything else protected
         ├── AuthProvider → Supabase Auth (session, signIn/signUp/signOut)
         ├── AppShell chrome (sidebar ≥ lg / bottom nav < lg) — /review is a
         │     focus-mode sibling with no chrome
         ├── Data hooks (useDecks/useCards/useReviews/useAnalytics)
         │        └── Supabase PostgREST — every query RLS-scoped by auth.uid()
         └── Client-side integrations
                  ├── AI providers (Gemini → Groq → Cerebras, user keys)
                  └── Material extraction (pdf.js/mammoth local, images via Gemini)
```

There is no API layer of our own and no server code. Route detail, component
map, data flows: `PROJECT_ARCHITECTURE.md` / `architecture.md`.

## 7. Database

Supabase Postgres, three tables (all with `user_id`, all RLS-enabled —
`supabase/schema.sql`):

| Table | Key columns | Relationships |
| --- | --- | --- |
| `decks` | `name` (≤100), `description` (≤500), `created_at` | has many cards |
| `cards` | `question`/`answer` (≤2000), `source` (≤500), FSRS columns: `due`, `state`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `last_review` | `deck_id` → decks (**FK, cascade delete**); has many review_logs |
| `review_logs` | `rating` (1–4 CHECK), `reviewed_at` | `card_id` → cards (**FK**); user_id → auth.users |

- **RLS:** `auth.uid() = user_id` policies on select/insert/update/delete for
  all three tables. This — not the frontend — is the authorization boundary.
- **Hardening (Phase 12):** migration `0002_authorization_hardening.sql`
  adds `SECURITY DEFINER` ownership triggers (a card can only reference your
  own deck, a log only your own card) + length CHECKs. **Written but not yet
  executed — run it in the SQL Editor (SEC-05).**
- Aggregation (analytics, due counts) happens **client-side** over 1–2
  queries; Supabase's default 1000-row cap is a known free-tier limit
  (analytics silently undercounts beyond 1000 logs).
- Schema file to run: `supabase/schema.sql` (idempotent; includes 0002 content).

## 8. Authentication

- **Provider:** Supabase Auth, email/password. Email confirmation is ON by
  default — signup shows a `role="status"` confirmation panel
  (`needsConfirmation = !session`).
- **Session:** managed by `supabase.auth.onAuthStateChange` inside
  `AuthProvider` (`src/hooks/useAuth.js`), which exposes
  `{ user, loading, signIn, signUp, signOut }`. Session lives in
  localStorage (Supabase default — accepted risk SEC-16).
- **Guards:** `ProtectedLayout` (loading → "Loading…", signed out → `/auth`)
  wraps every non-guest route; `GuestRoute` sends signed-in users from
  `/auth` to `/dashboard`. Guards only hide UI — **RLS protects the data**.
- **UI:** one mode-driven form in `src/pages/Auth.jsx`; validation in
  `src/lib/authForm.js` (6-char minimum only at signup); Supabase errors are
  mapped to friendly copy — raw provider text never renders.
- **Not implemented (by design):** password reset, OAuth/social login,
  remember-me, profile pages. Do not add them unless explicitly asked.

## 9. UI system

- **Tokens only, one file:** `src/index.css` (`@theme inline` + `:root` /
  `.dark`, oklch). Semantic utilities (`bg-card`, `text-muted-foreground`,
  `bg-success`, `text-warning-foreground dark:text-warning`, …). Never
  hardcode a color; never add `tailwind.config.js`.
- **Boundaries:** `--border` = decorative hairline; `--input` = control edge,
  calibrated ≥3:1 (WCAG 1.4.11) in both themes.
- **Type:** Inter Variable, fixed scale 12/14/16/18/24/32/48 (floor = 12 px).
- **Radius:** base `0.75rem` + multiplier scale.
- **Dark mode:** `.dark` class, bootstrapped pre-paint by external
  `public/theme-init.js` (CSP forbids inline scripts), persisted as
  `fastrev_theme`.
- **Components:** shadcn primitives in `src/components/ui/` + shared
  composites (`StatCard`, `DeckCard`, `EmptyState`, `ErrorState`,
  `LoadingButton`, `CreateDeckDialog`, skeletons, review set, upload set).
  Reuse them; do not fork.
- **Motion:** tw-animate-css + CSS transitions only; global
  `prefers-reduced-motion` clamp; `motion-reduce:*` on moving parts.
- **Toasts:** one global sonner `<Toaster>` (`main.jsx`, bottom-center, 5rem
  offset). Policy: CRUD/save successes + delete-failure errors only —
  validation and panel-managed errors stay inline.
- **Layout law:** AppShell owns `<h1>` and the single `<main>`; pages use
  `<h2>`+. Focus-mode routes (`/review`) are shell siblings; `/auth` has no shell.

## 10. Important development rules

1. **Read `PROJECT_CONTEXT.md` + the relevant source before changing anything.**
2. Preserve existing functionality — this app is finished; change minimally.
3. No new dependencies without a real need; specifically never re-add
   framer-motion, never create `tailwind.config.js`, never use `npx shadcn`
   (local CLI: `node node_modules/shadcn/dist/index.js <cmd>`).
4. JSX in `.jsx` only; hooks/libs stay `.js` (Vite 8 won't parse JSX in `.js`).
5. Data fetches use `.then()` callbacks (oxlint `set-state-in-effect`);
   mutations are async/await from event handlers. Hooks return
   `{ data }`/`{ error }` + mirror `loading`/`error`.
6. New routes: add to `App.jsx` **and** `src/lib/nav.js` if navigable; make
   them `React.lazy` unless first-paint-critical (only AppShell/Auth/Dashboard
   are eager); focus mode = sibling of `AppShell`, never a prop.
7. Accessibility is a requirement: labels, roles, focus management, ≥4.5:1
   text contrast in both themes, reduced motion, no color-only meaning.
8. Never fabricate data — show `—`/empty states when data isn't there.
9. Errors: sanitize where displayed (`friendlyDbError`/`friendlyAuthError`);
   raw text only in dev builds.
10. Security: no inline `<script>` (CSP), headers live only in `vercel.json`,
    cap new text inputs with `maxLength` + DB CHECK, `.env` never committed.
11. Validate before saying "done": `npm run lint` && `npm run build`, plus a
    dev-server smoke of affected routes for anything user-visible.
12. Update documentation (`PROJECT_CONTEXT.md`, `PROJECT_ARCHITECTURE.md`,
    `README.md`, this file) whenever architecture, routes, commands, env vars
    or conventions change.

## 11. Known issues (confirmed, not hypothetical)

| # | Issue | Where |
| --- | --- | --- |
| 1 | `0002_authorization_hardening.sql` not executed + live RLS unverified (only open High) | `SECURITY_AUDIT.md` SEC-05 |
| 2 | No deck-rename UI (`useDecks.updateDeck` is unused) | `USABILITY_AUDIT.md` U-08 |
| 3 | `Review.handleRating` has no `try/finally` — a throw would leave `submittingRef` stuck (unreachable with valid FSRS states 0–3) | `CROSS_BROWSER_QA.md` CB-07 |
| 4 | `npm audit`: 7 high dev-only (shadcn CLI chain) + 3 moderate runtime (`mammoth → sprintf-js`, no non-breaking fix) | `SECURITY_AUDIT.md` SEC-14 |
| 5 | Gemini key sent as URL query param (provider API constraint) | `SECURITY_AUDIT.md` SEC-10 |
| 6 | Analytics client-side aggregation hits Supabase's 1000-row default cap | `AGENTS.md` Known Risks |
| 7 | Supabase Free pauses after ~7 days idle (needs cron ping — README) | README |
| 8 | Firefox/WebKit/physical devices never executed (Chromium-only harness) | `CROSS_BROWSER_QA.md` |
| 9 | Groq/Cerebras in-browser CORS with real endpoints unverified | `CROSS_BROWSER_QA.md` |
| 10 | No automated test suite; verification = lint/build/smoke/audits | this file §4 |

## 12. Future improvements (reasonable, in rough priority order)

1. **Execute + verify the Phase 12 DB hardening** (item 1 above) — closes the
   last High-severity security gap.
2. **Deck rename UI** — needs a shared decks context so DeckDetail, the deck
   list and the AppShell breadcrumb agree (U-08's stated follow-up).
3. **Manual QA pass** in real browsers (Safari, Firefox, a phone) while
   logged in — the one validation class this environment never performed.
4. Password-reset email flow (Supabase supports it; UI just doesn't).
5. Analytics pagination / RPC aggregation if users approach the 1000-row cap.
6. Optional Edge Function for AI generation with per-user quotas if abuse
   ever appears (`SECURITY_AUDIT.md` SEC-12 documents the path).
7. Undo/re-rate for a mistaken review rating (U-15, deliberately not built —
   needs FSRS log reversion design).
8. Periodic backups of Supabase data (SEC-19 — no automated backups on Free).

## 13. OpenCode recovery

If the OpenCode session or Windows environment resets:

```text
1. Read PROJECT_CONTEXT.md.
2. Read PROJECT_ARCHITECTURE.md.
3. Read the relevant audit/documentation file
   (USABILITY_AUDIT / PERFORMANCE_AUDIT / SECURITY_AUDIT /
    CROSS_BROWSER_QA / PRODUCTION_CHECKLIST / README / AGENTS).
4. Inspect the relevant source files — the code is the source of truth.
5. Continue from the documented project state.
6. Do not recreate existing architecture without checking the source first.
7. Make the smallest appropriate change; test (npm run lint && npm run build).
8. Update documentation when architecture or behavior changed.
```

Docs order of authority:
`AGENTS.md` + `architecture.md` (canonical long-form) →
`PROJECT_CONTEXT.md` + `PROJECT_ARCHITECTURE.md` (current state) →
audit files (evidence & statuses) → **source code (ultimate truth)**.
