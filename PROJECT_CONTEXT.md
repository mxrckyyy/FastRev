# PROJECT_CONTEXT.md — FastRev

Fast on-ramp for (re)discovering this project. Full phase history, key decisions and
risks live in `AGENTS.md`; full architecture reference lives in `architecture.md`.
This file documents the current state only.

## What the app is

FastRev — a free-tier spaced-repetition flashcard web app for students.

- Students keep **decks of Q/A cards**, scheduled by **FSRS** (ts-fsrs).
- Cards can be **AI-generated** from pasted notes or imported material (PDF /
  image / .docx / .txt / .md) through a client-side provider chain:
  Gemini → Groq → Cerebras (API keys in browser localStorage, free tiers only).
- A **review focus mode** (keyboard: Space / 1–4) and a **dashboard + analytics**.
- Backend: **Supabase** (Postgres + Auth + RLS) — every table has `user_id` and
  RLS. Hosted on **Vercel** static hosting.
- Hard constraint: **zero monetary cost** (free tiers only; no paid services).

## Current phase

**Phase 14 — not yet defined.**
Phases 0–6 are complete: project setup, Supabase schema/auth, deck CRUD, review +
FSRS, AI generation, analytics + docs, schema repair, material import, and UI/UX
plan Phases 1–8 (design system, app shell, dashboard/decks, review focus mode,
upload, analytics, authentication, interaction/motion/feedback). **App-wide Final
QA & Polish (audit & fix pass) completed 2026-10-06** — control-boundary contrast
(`--input`), type-scale fixes, dead `tabs.jsx` removed, ARIA/landmark gap-fills,
icon-size + error-tint consistency, chart text alternatives; no functionality
changed. **UI/UX Phase 10 — Usability Audit & targeted fixes completed
2026-10-06**: `USABILITY_AUDIT.md` (Flows A–F, 18 issues) + fixes — double-save
guard on Upload, whitespace validation on deck/card forms, `/upload?deck=` deep
link from DeckDetail, Add Card dialog stays open for batch entry, delete confirms
now solid `danger`, decks-error retry, label/due-count/copy polish. Deck **rename
still has no UI** (documented as U-08, needs a shared decks context).
**Phase 11 — Performance Audit & Optimization completed 2026-10-06**:
`PERFORMANCE_AUDIT.md` — real Lighthouse lab runs (mobile, throttled) went
**88/98/100/82 → 94/100/100/100** (perf/a11y/BP/SEO); initial JS chunk
**1,150.61 kB → 657.37 kB** (gzip 335 → 192 kB) via React.lazy route splitting
(recharts now rides the Analytics chunk), `useDecks` in-flight request dedupe,
meta description + `public/robots.txt`, `<main>` landmarks on the auth/loading
screens. **Phase 12 — Security & Production Readiness completed 2026-10-06**:
`SECURITY_AUDIT.md` (findings SEC-01…SEC-26) + `PRODUCTION_CHECKLIST.md`
(verified-only boxes) — security headers + CSP in `vercel.json` (theme bootstrap
moved to `public/theme-init.js`, no `unsafe-inline`), safe errors via
`src/lib/errors.js` (raw detail dev-only), `maxLength` validation on every text
field + notes 60k cap, upload 10 MB/25 MB size guards, AI output caps (40 cards),
enumeration-safe signup copy, fail-safe config screen when env vars are missing,
and DB hardening SQL (ownership triggers + length CHECKs in
`supabase/migrations/0002_authorization_hardening.sql` — **written, not yet
executed**). Verified here: lint · build · 56/56 security smoke · dist + git
secret scans clean · local server + headless Chrome (headers on the wire, full
Auth screen under CSP with zero violations, inline-script probe blocked). **Outstanding
(user steps):** run the 0002 SQL + verify live RLS, confirm Vercel env vars, check
headers on the deployed URL. See `AGENTS.md` → Completed Phases +
`architecture.md` → § Security & Production Readiness (Phase 12).
**Phase 13 — Cross-Browser & Device QA completed 2026-10-07**:
`CROSS_BROWSER_QA.md` (method, environment/responsive/browser-compat tables,
issues **CB-01…CB-07**) — evidence came from a temp-dir headless-Chrome CDP
harness running the production build with the real `vercel.json` headers and a
mocked backend: **179/179 checks, 0 console errors**, 10 scenarios × 12 widths
(375…1440 incl. 639/640, 767/768, 1023/1024 edges) + dark/reduced-motion +
36 screenshots. App fixes: DeckDetail long-text containment (240-char unbroken
token no longer overflows at 375/1440) + header long-name wrapping; inline edit
focus (question textarea on Edit, Edit-button refocus on Cancel/save); MobileMenu
close now returns focus to the hamburger; dialog close 28→32 px; Upload
"Browse files" 28→36 px (30 px project floor). Documented-only: `handleRating`
has no try/finally (CB-07, unreachable in production), compact touch targets
kept, Firefox/Safari/physical devices Not Tested. Harness lessons (PostgREST
`.single()` replies, ts-fsrs state 0–3, provider CORS preflight) are recorded in
`AGENTS.md` → Key Decisions § Phase 13.

## Tech stack (locked)

| Layer      | Choice                                                            |
| ---------- | ----------------------------------------------------------------- |
| Frontend   | React 19 + Vite 8, **JavaScript/JSX only** (no TypeScript)         |
| Styling    | Tailwind CSS v4, CSS-first — **no `tailwind.config.js`**, tokens in `src/index.css` |
| UI kit     | shadcn/ui (JavaScript mode) + `radix-ui` monolith + `lucide-react` |
| Backend    | Supabase (PostgreSQL + Auth + RLS)                                 |
| Scheduling | ts-fsrs (FSRS algorithm)                                           |
| Routing    | react-router-dom v7                                                |
| Charts     | recharts                                                           |
| Toasts     | sonner (Phase 8; framer-motion deliberately **not** added)         |
| Tooling    | npm, oxlint (`npm run lint`), Vite build                           |
| Hosting    | Vercel (static)                                                    |

## Project structure

```
FastRev/
├── AGENTS.md                    # full project context: phases, decisions, risks
├── architecture.md              # full architecture reference
├── PROJECT_CONTEXT.md           # this file — current-state on-ramp
├── PROJECT_ARCHITECTURE.md      # current-state architecture summary
├── USABILITY_AUDIT.md           # Phase 10 audit: Flows A–F, 18 issues + statuses
├── PERFORMANCE_AUDIT.md         # Phase 11 perf audit: baseline → Lighthouse 94/100/100/100
├── SECURITY_AUDIT.md            # Phase 12 security audit: SEC-01…SEC-26 + tests
├── PRODUCTION_CHECKLIST.md      # Phase 12 deploy checklist (verified-only boxes)
├── README.md                    # setup: Supabase, AI keys, cron, Vercel deploy
├── vercel.json                  # security headers + CSP for every response (Phase 12)
├── index.html                   # entry; loads /theme-init.js (external pre-paint theme bootstrap)
├── vite.config.js               # react + tailwindcss plugins, @ alias (JS, not .ts)
├── jsconfig.json                # @/* path mapping
├── components.json              # shadcn config (JavaScript mode)
├── .env                         # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (gitignored)
├── .env.example                 # names/placeholders only — copy this, never commit .env
├── public/theme-init.js         # pre-paint dark-mode bootstrap (external for CSP)
├── supabase/
│   ├── schema.sql               # canonical schema to run in SQL Editor (incl. Phase 12 hardening)
│   ├── migrations/0001_initial_schema.sql
│   ├── migrations/0002_authorization_hardening.sql   # triggers + CHECKs — NOT yet executed
│   └── README.md                # how to run/verify the schema
└── src/
    ├── main.jsx                 # ErrorBoundary + BrowserRouter + AuthProvider
    │                            #   + global sonner Toaster
    ├── App.jsx                  # routes (see below)
    ├── index.css                # THE design system: all tokens, themes, base rules
    ├── components/
    │   ├── AppShell.jsx         # sidebar + top bar + scrollable main + bottom nav
    │   ├── Sidebar.jsx, TopBar.jsx, MobileNav.jsx, MobileMenu.jsx, UserMenu.jsx
    │   ├── Breadcrumbs.jsx, StatCard.jsx, DeckCard.jsx, CreateDeckDialog.jsx
    │   ├── EmptyState.jsx, ErrorState.jsx, ErrorBoundary.jsx, ThemeToggle.jsx
    │   ├── LoadingButton.jsx     # shared async submit (spinner + aria-busy)
│   │   RouteFallback.jsx     # Suspense fallback for lazy routes (Phase 11)
    │   ├── ReviewShell.jsx, ReviewProgress.jsx, Flashcard.jsx,
    │   │   RatingButtons.jsx, ShortcutHint.jsx          # review focus mode
    │   ├── GeneratedCard.jsx, GenerationSkeleton.jsx    # upload preview
    │   └── ui/                  # shadcn components (button, card, input, dialog,
    │                            #   alert-dialog, textarea, checkbox, badge,
    │                            #   skeleton, dropdown-menu)
    ├── hooks/
    │   ├── useAuth.js           # AuthProvider + useAuth (signIn/signUp/signOut)
    │   ├── useDecks.js, useCards.js, useReviews.js, useAnalytics.js
    ├── lib/
    │   ├── supabase.js          # client singleton (placeholder fallback) + supabaseConfigured
    │   ├── fsrs.js              # ts-fsrs wrapper (scheduleCard, Rating)
    │   ├── ai.js                # provider chain + transcription + key helpers
    │   ├── extract.js           # PDF/image/.docx/txt material extraction
    │   ├── nav.js               # NAV_ITEMS single source + link class builders
    │   ├── ratings.js           # RATINGS config (Again/Hard/Good/Easy, keys 1–4)
    │   ├── theme.js             # dark-mode read/apply/toggle/subscribe
    │   ├── authForm.js          # auth validation + Supabase error → friendly copy
    │   ├── errors.js            # friendlyDbError: raw DB error → safe copy at render
    │   └── utils.js             # cn()
    └── pages/
        ├── Auth.jsx             # login/signup — Phase 7 screen (AuthView + state)
        ├── Dashboard.jsx, Decks.jsx, DeckDetail.jsx, Review.jsx,
        ├── Upload.jsx, Analytics.jsx, Settings.jsx, SettingsPage.jsx
```

## Routes

| Path          | Guard              | Layout                        |
| ------------- | ------------------ | ----------------------------- |
| `/auth`       | guest-only         | full-screen card (no shell)   |
| `/dashboard`  | protected          | AppShell                      |
| `/decks`      | protected          | AppShell                      |
| `/decks/:id`  | protected          | AppShell                      |
| `/upload`     | protected          | AppShell                      |
| `/analytics`  | protected          | AppShell                      |
| `/settings`   | protected          | AppShell                      |
| `/review`     | protected          | **focus mode** (sibling of AppShell — no chrome) |
| `/`           | —                  | redirect → `/dashboard`       |
| `*`           | —                  | redirect → `/`                |

`ProtectedLayout` shows "Loading…" while auth resolves, then redirects
unauthenticated users to `/auth`. `GuestRoute` mirrors it (signed-in → `/dashboard`).

## Auth flow (current)

1. `src/lib/supabase.js` creates the client from `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (falls back to placeholders + console.warn if unset).
2. `AuthProvider` (`src/hooks/useAuth.js`): subscribes to
   `supabase.auth.onAuthStateChange`, exposes `{ user, loading, signIn, signUp, signOut }`.
   - `signIn(email, password)` → `signInWithPassword` → `{ error }`.
   - `signUp(email, password)` → `signUp` → `{ error, needsConfirmation }`
     (`needsConfirmation = !session`; Supabase email confirmation is ON by default).
   - All three are async and return `{ error }`.
3. `src/pages/Auth.jsx` is the single login/signup screen (Phase 7): default
   export owns state/validation/Supabase calls; exported `AuthView({ … })` is
   the presentational view. One mode-driven shared form (`mode: login |
   signup`): inline field errors from `lib/authForm.js`
   (`validateAuthEmail` / `validateAuthPassword` — 6-char minimum only at
   signup), Supabase errors mapped by `friendlyAuthError` into a `role="alert"`
   box (raw provider text never shown), show/hide password toggle,
   loading/disabled submit ("Signing in…" / "Creating account…"), a
   `role="status"` confirmation panel when `needsConfirmation`, and a bottom
   switch link instead of tabs.
4. On successful auth the provider updates `user`; `GuestRoute` redirects to
   `/dashboard`; sign-out (UserMenu) returns to `/auth`.

**Not implemented (do not add without being asked):** password reset,
Google/social OAuth, remember-me, profile editing.

## Design-system essentials

- **All tokens live in `src/index.css`** (`@theme inline` + `:root` / `.dark`,
  oklch). Never hardcode hex/oklch in components; no `tailwind.config.js`.
- Semantic colors: `primary`, `secondary`, `muted`, `accent`, `border`, `input`,
  `ring`, `card`, `background`, `foreground`, `success` / `warning` / `danger`
  (+ `-foreground` pairs; `destructive` aliases `danger`).
  Meaning: success = Good/positive · warning = Hard/attention · danger = Again/errors.
- **Warning-as-text rule:** warning-colored text on a tint uses
  `text-warning-foreground dark:text-warning` (light `--warning` fill is only 2.9:1 as text).
- Type scale: 12/14/16/18/24/32/48 (`text-xs` … `text-3xl`). Weights: 400 body,
  500/600 headings/actions. Font: Inter Variable.
- Radius: base `0.75rem`, multipliers (`rounded-lg` cards, `rounded-xl` dialogs…).
- **Control boundaries:** `--border` is the 1 px structural hairline (~1.3:1, by
  design); `--input` draws input/textarea/select/outline-button edges and is
  calibrated ≥3:1 vs all surfaces in both themes (WCAG 1.4.11 — Final QA fix).
- Dark mode: `.dark` on `<html>`, bootstrapped pre-paint by the **external**
  `public/theme-init.js` (loaded with `<script src>` from `index.html` — external
  so CSP `script-src 'self'` needs no inline-script allowance), persisted in
  localStorage `fastrev_theme` (`src/lib/theme.js`).
- Animation: `tw-animate-css` + CSS transitions only (**framer-motion is not
  installed and must not be added**); global `prefers-reduced-motion` clamp in
  `index.css`, plus explicit `motion-reduce:*` variants on moving parts.
- Feedback (Phase 8): global **sonner** `<Toaster>` in `main.jsx` —
  bottom-center, 5rem offset (clears the mobile bottom nav), `unstyled` +
  token classNames, success/error lucide icons. Toasts are narrow: 6 CRUD/save
  successes + the 2 delete-failure errors only; validation/panel errors stay
  inline (full policy in `architecture.md` § Interaction). Async submits use
  `LoadingButton` (spinner + `aria-busy` + disabled); route changes fade in
  150 ms via the keyed wrapper in `AppShell`.
- Layout rule: **AppShell owns `<h1>` and the single `<main>`** — pages render
  content with `<h2>`+. Exceptions: focus-mode routes (`/review`) render their own
  chrome; full-screen routes (`/auth`) have no shell.
- Accessibility: ≥4.5:1 text contrast (verified in both themes), focus-visible
  ring on every control, icon-only buttons carry `aria-label`, decorative icons
  `aria-hidden`, never state-by-color-alone.

## Commands

```bash
npm run dev      # Vite dev server on :5173
npm run build    # production build (must pass before finishing a phase)
npm run lint     # oxlint — only the 1 pre-existing warning allowed (button.jsx fast-refresh)
npm run preview  # serve the production build
```

Validation recipe used by every UI phase (run before reporting done):
lint → build → SSR render smoke via temp `ssr-smoke.mjs` (Vite `ssrLoadModule` +
`renderToString` + check assertions) → contrast audit via temp `contrast-audit.mjs`
(oklch → WCAG ratio; ≥4.5 text / ≥3 UI, light + dark) → dev-server route/module
HTTP 200s → built-CSS contains new utilities → delete temp scripts.
Latest run (Phase 12 — security): lint 1 warning · build ✓ · **56/56 security
smoke** (error-mapping + auth-copy units, renders, CSP/SQL/source assertions) ·
dist + git-history secret scans clean · local server + headless Chrome: headers
on the wire, full Auth screen under CSP with **zero violations**, inline-script
probe **blocked**, missing-env production guard shown · `npm audit` recorded in
`SECURITY_AUDIT.md`. (Phase 11's Lighthouse after-run: **94 / 100 / 100 / 100**.)

## Conventions worth knowing

- JSX only in `.jsx`; hooks/libs are `.js` (Vite 8 won't parse JSX in `.js`).
- Data-fetch functions use `.then()` callbacks (oxlint `set-state-in-effect`);
  mutations are async/await (event handlers only). Hooks return
  `{ data }`/`{ error }` and mirror `loading`/`error`.
- Every page may auto-fetch in its own effect; `useReviews` deliberately does not
  (Dashboard/Review call its fetchers themselves).
- shadcn CLI runs locally: `node node_modules/shadcn/dist/index.js <cmd>` (never `npx`).
- Icons: lucide-react **v1.52** — legacy names are gone
  (`BarChart3` → `ChartColumn`, `Loader2` → `LoaderCircle`, `CheckCircle2` → `CircleCheck`).
- Toasts: call sites import `{ toast } from 'sonner'` directly (no wrapper);
  `LoaderCircle` is the only spinner in the app; Auth keeps its own inline
  loading pattern (do not "convert" it — Phase 7 smoke asserts that markup).
- Docs convention: `AGENTS.md` + `architecture.md` are the canonical long-form
  docs (updated every phase); this file + `PROJECT_ARCHITECTURE.md` are the
  current-state summaries.
- Performance conventions (Phase 11): routes are code-split with `React.lazy`
  (`App.jsx`) — **only AppShell/Auth/Dashboard stay eager**; a new heavy page
  must be lazy too. Suspense for shell routes lives **inside AppShell's outlet**
  (chrome never unmounts — no CLS); focus-mode routes carry their own boundary.
  `RouteFallback` is the one fallback (spinner + sr-only status). Duplicate
  concurrent fetches are collapsed by module-level in-flight promises keyed by
  user id (`useDecks` pattern) — results are never cached, only deduped.
  Lighthouse is run against `vite preview` with a temp-dir install (never add
  lighthouse to package.json); baseline and after numbers live in
  `PERFORMANCE_AUDIT.md` — never restate scores from memory.
- Security conventions (Phase 12): raw errors are sanitized **where they are
  displayed** via `friendlyDbError` (`src/lib/errors.js`) / `friendlyAuthError` —
  hooks keep raw messages (debugging), dev builds show/log raw, production never
  does; never add an inline `<script>` (CSP `script-src 'self'` — use an external
  file like `public/theme-init.js`); headers/CSP live only in `vercel.json`
  (not applied by `npm run dev`/`preview`); cap any new text input with
  `maxLength` + a matching DB CHECK when the field is new; `.env` names only in
  `.env.example`, real values never committed. Verification + open items live in
  `SECURITY_AUDIT.md` / `PRODUCTION_CHECKLIST.md` — never claim live-deploy
  verification that wasn't performed.
