# PROJECT_CONTEXT.md — FastRev (Student Review System)

Fast on-ramp for (re)discovering this project — the file to read **first** in any
new OpenCode session. Full phase history, key decisions and risks live in
`AGENTS.md`; full architecture reference lives in `architecture.md`; the fastest
handoff summary lives in `DEVELOPER_HANDOFF.md`. This file documents the current
state only.

## 1. Project overview

**FastRev** — a free-tier spaced-repetition flashcard web app for students.

- Students keep **decks of Q/A cards**, scheduled by **FSRS** (ts-fsrs).
- Cards can be **AI-generated** from pasted notes or imported material (PDF /
  image / .docx / .txt / .md) through a client-side provider chain:
  Gemini → Groq → Cerebras (API keys in browser localStorage, free tiers only).
- A **review focus mode** (keyboard: Space / 1–4) and a **dashboard + analytics**.
- Backend: **Supabase** (Postgres + Auth + RLS) — every table has `user_id` and
  RLS. Hosted on **Vercel** static hosting.
- Hard constraint: **zero monetary cost** (free tiers only; no paid services).

**Target users:** individual students studying with their own material
(single-user-per-account; no sharing/collaboration features).

## 2. Current phase

**Phase 14 — Final Documentation & Developer Handoff — complete (2026-10-08).**

Phases 0–13 are complete (project setup · Supabase schema/auth · deck CRUD ·
review + FSRS · AI generation · analytics · material import · UI/UX plan
Phases 1–8 · Final QA & Polish · Phase 10 usability audit · Phase 11 performance
audit · Phase 12 security · Phase 13 cross-browser/device QA). Phase 14
reviewed every doc against the actual source, corrected stale claims, and
produced `DEVELOPER_HANDOFF.md`.

Documented status of every audit:

| Deliverable | Status |
| --- | --- |
| `USABILITY_AUDIT.md` (Phase 10) | 18 issues — 13 Fixed (U-18 closed by Phase 12), **5 Not Fixed: U-08 (deck rename UI) + U-14…U-17** |
| `PERFORMANCE_AUDIT.md` (Phase 11) | Lighthouse (lab) 88/98/100/82 → **94/100/100/100**; initial chunk 1,150.61 → 657.37 kB |
| `SECURITY_AUDIT.md` (Phase 12) | SEC-01…SEC-26 — no Critical; **SEC-05 (live RLS verification) still open** |
| `CROSS_BROWSER_QA.md` (Phase 13) | **179/179 checks** (headless Chrome, mocked backend); Firefox/WebKit/physical devices NOT tested |
| `PRODUCTION_CHECKLIST.md` | verified-only boxes — live-deploy steps remain unchecked for the user |

**Outstanding before production (user steps):** run
`supabase/migrations/0002_authorization_hardening.sql` + verify live RLS
(SEC-05), confirm Vercel env vars exist at build time, live smoke of auth +
review + AI generation, confirm security headers on the deployed URL.

## 3. Technology stack (locked)

| Layer | Choice |
| --- | --- |
| Frontend | React 19 + Vite 8, **JavaScript/JSX only** (no TypeScript) |
| Styling | Tailwind CSS v4, CSS-first — **no `tailwind.config.js`**, tokens in `src/index.css` |
| UI kit | shadcn/ui (JavaScript mode) + `radix-ui` monolith + `lucide-react` v1.52 + `cn` (class merge) |
| Backend | Supabase (PostgreSQL + Auth + RLS) |
| Scheduling | ts-fsrs (FSRS algorithm) |
| Routing | react-router-dom v7 |
| Charts | recharts (lazy Analytics chunk only) |
| Toasts | sonner (Phase 8; framer-motion deliberately **not** added) |
| Material import | pdfjs-dist (legacy build, local) · mammoth (local) · Gemini vision OCR (images) |
| Font | Inter Variable (`@fontsource-variable/inter`) |
| Animation | tw-animate-css + CSS transitions + global reduced-motion clamp |
| Tooling | npm, oxlint (`npm run lint`), Vite build — **no test runner, no typechecker** |
| Hosting | Vercel (static; security headers from `vercel.json`) |

## 4. Application features

All implemented unless marked otherwise:

- **Authentication** — email/password sign-up/sign-in via Supabase Auth
  (email confirmation ON by default → confirmation panel), sign-out from the
  UserMenu. *Not implemented by design:* password reset, OAuth, remember-me,
  profile editing.
- **Dashboard** — adaptive hero (Start Review / caught-up), 4 stat cards
  (Due Today, Streak, Total Cards, Retention), top-3 priority decks, empty state.
- **Deck management** — create (`CreateDeckDialog`), delete (confirmed), browse
  (`/decks` grid + priority section on Dashboard). **No rename UI** (hook
  `updateDeck` exists but is unused — U-08, needs a shared decks context).
- **Card management** — add cards (dialog stays open for batch entry), inline
  edit, delete with confirmation, per-deck due counts.
- **Review system** — one card at a time, Show Answer, Again/Hard/Good/Easy
  (keys 1–4, Space reveals), FSRS scheduling, progress bar, keyboard focus
  management, completion screen; empty queue → Generate cards CTA.
- **Upload + AI generation** — two-panel workspace: deck picker, notes
  textarea (60k cap), file import (PDF/images/.docx/.txt/.md, drag-and-drop),
  Generate via Gemini → Groq → Cerebras chain, editable/selectable preview
  rows, Save All / Save Selected, `/upload?deck=<id>` deep link.
- **Analytics** — retention, total reviews, streak, cards learned, highlights,
  week-over-week trend, 7-day due forecast bar chart, 14-day activity line
  chart, rating-breakdown meter, weakest-decks bars; no-history/empty states.
- **Settings** — `/settings` route (and dialog on Upload) storing AI keys in
  localStorage only.
- **Platform polish** — dark mode (`.dark`, pre-paint bootstrap), toasts
  (sonner), loading skeletons everywhere, global error boundary, responsive
  layout (mobile bottom nav → desktop sidebar at `lg`), focus-mode review route.

## 5. Project structure

```
FastRev/
├── AGENTS.md                    # full project context: phases, decisions, risks
├── architecture.md              # full architecture reference
├── PROJECT_CONTEXT.md           # this file — current-state on-ramp
├── PROJECT_ARCHITECTURE.md      # current-state architecture summary
├── DEVELOPER_HANDOFF.md         # fastest on-ramp for a new developer
├── README.md                    # setup: Supabase, AI keys, cron, Vercel deploy
├── PRODUCTION_CHECKLIST.md      # deploy checklist (verified-only boxes)
├── USABILITY_AUDIT.md           # Phase 10 audit: Flows A–F, 18 issues + statuses
├── PERFORMANCE_AUDIT.md         # Phase 11 perf audit: baseline → Lighthouse 94/100/100/100
├── SECURITY_AUDIT.md            # Phase 12 security audit: SEC-01…SEC-26 + tests
├── CROSS_BROWSER_QA.md          # Phase 13 device QA: CB-01…CB-07, 179/179 checks
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
    │   ├── RouteFallback.jsx     # Suspense fallback for lazy routes (Phase 11)
    │   ├── ReviewShell.jsx, ReviewProgress.jsx, Flashcard.jsx,
    │   │   RatingButtons.jsx, ShortcutHint.jsx          # review focus mode
    │   ├── GeneratedCard.jsx, GenerationSkeleton.jsx    # upload preview
    │   └── ui/                  # shadcn components (alert-dialog, badge, button,
    │                            #   card, checkbox, dialog, dropdown-menu, input,
    │                            #   skeleton, textarea — tabs.jsx deleted, dead)
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
    │   └── utils.js             # cn() re-export (shadcn `cn` package)
    └── pages/
        ├── Auth.jsx             # login/signup — Phase 7 screen (AuthView + state)
        ├── Dashboard.jsx        # /dashboard
        ├── Decks.jsx            # /decks route wrapper → DeckList
        ├── DeckList.jsx         # deck grid content (not a route itself)
        ├── DeckDetail.jsx       # /decks/:id
        ├── Review.jsx           # /review (focus mode)
        ├── Upload.jsx           # /upload
        ├── Analytics.jsx        # /analytics
        ├── Settings.jsx         # SettingsDialog + SettingsForm
        └── SettingsPage.jsx     # /settings route wrapper
```

## 6. Routes

| Path | Guard | Layout | Loading |
| --- | --- | --- | --- |
| `/auth` | guest-only | full-screen card (no shell) | eager |
| `/dashboard` | protected | AppShell | eager |
| `/decks` | protected | AppShell | lazy |
| `/decks/:id` | protected | AppShell | lazy |
| `/upload` | protected | AppShell | lazy |
| `/analytics` | protected | AppShell | lazy (keeps recharts off first paint) |
| `/settings` | protected | AppShell | lazy |
| `/review` | protected | **focus mode** (sibling of AppShell — no chrome) | lazy + own Suspense |
| `/` | — | redirect → `/dashboard` | — |
| `*` | — | redirect → `/` | — |

`ProtectedLayout` shows "Loading…" while auth resolves, then redirects
unauthenticated users to `/auth`. `GuestRoute` mirrors it (signed-in →
`/dashboard`). Production builds with missing env vars show the
"isn't configured yet" screen instead of a broken app.

## 7. Auth flow (current)

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

## 8. Design-system essentials

- **All tokens live in `src/index.css`** (`@theme inline` + `:root` / `.dark`,
  oklch). Never hardcode hex/oklch in components; no `tailwind.config.js`.
- Semantic colors: `primary`, `secondary`, `muted`, `accent`, `border`, `input`,
  `ring`, `card`, `background`, `foreground`, `success` / `warning` / `danger`
  (+ `-foreground` pairs; `destructive` aliases `danger`).
  Meaning: success = Good/positive · warning = Hard/attention · danger = Again/errors.
- **Warning-as-text rule:** warning-colored text on a tint uses
  `text-warning-foreground dark:text-warning` (light `--warning` fill is only 2.9:1 as text).
- Type scale: 12/14/16/18/24/32/48 (`text-xs` … `text-3xl`). Weights: 400 body,
  500/600 headings/actions. Font: Inter Variable. Floor is 12 px — no smaller.
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

## 9. Important rules (project conventions)

- JSX only in `.jsx`; hooks/libs are `.js` (Vite 8 won't parse JSX in `.js`).
- Tailwind v4 CSS-first: **never create `tailwind.config.js`**; tokens only in
  `src/index.css`; semantic utilities in components, never hardcoded colors.
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
- Focus mode = routing, not flags: a route that must hide the shell is a
  **sibling of `<AppShell>`** inside `ProtectedLayout` (only `/review` today).
- Navigation single source: `src/lib/nav.js` — a new destination = one
  `NAV_ITEMS` entry + one route in `App.jsx`.
- No backend invention: there is no application server, no first-party API
  routes, no server actions. All writes go through Supabase REST with RLS.
- Never fabricate data: stats, counts, forecasts and tallies come from real
  queries; empty/loading/error states show `—` or explanatory copy instead.
- Docs convention: `AGENTS.md` + `architecture.md` are the canonical long-form
  docs; this file + `PROJECT_ARCHITECTURE.md` are the current-state summaries;
  `DEVELOPER_HANDOFF.md` is the fast on-ramp. Update docs when architecture changes.
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

## 10. Development principles

1. **Preserve existing functionality.** This is a finished app — changes are
   additive or corrective, never rewrites.
2. **Read before writing.** The source is the source of truth; docs may lag,
   code does not. If they conflict, fix the docs.
3. **Reuse before creating.** `StatCard`, `DeckCard`, `EmptyState`,
   `ErrorState`, `LoadingButton`, `CreateDeckDialog`, skeletons and the `ui/`
   primitives exist for a reason — no duplicate components.
4. **Do not invent backend functionality** (no new endpoints, RPCs, or tables
   unless the task explicitly asks) **and do not fabricate data.**
5. **Maintain accessibility** — contrast, focus, ARIA roles/labels, semantic
   HTML, reduced motion. Never regress a verified contrast pair.
6. **Responsive** at 375 px and 1440 px minimum; the single nav breakpoint is `lg`.
7. **Test before declaring done:** `npm run lint` + `npm run build` at minimum;
   use the validation recipe below for anything user-visible.
8. **Update documentation** whenever architecture, routes, commands, env vars
   or conventions change.

## 11. Commands

```bash
npm run dev      # Vite dev server on :5173
npm run build    # production build (must pass before finishing a phase)
npm run lint     # oxlint — only the 1 pre-existing warning allowed (button.jsx fast-refresh)
npm run preview  # serve the production build (no vercel.json headers)
```

There is **no** test runner and **no** typechecker (JavaScript project) —
`npm run test` / `npm run typecheck` do not exist and must not be documented.

Validation recipe used by every UI phase (run before reporting done):
lint → build → SSR render smoke via temp `ssr-smoke.mjs` (Vite `ssrLoadModule` +
`renderToString` + check assertions) → contrast audit via temp `contrast-audit.mjs`
(oklch → WCAG ratio; ≥4.5 text / ≥3 UI, light + dark) → dev-server route/module
HTTP 200s → built-CSS contains new utilities → delete temp scripts.

Latest run (**Phase 14 — documentation**): lint 1 warning · production build ✓ ·
dev-server smoke of all 10 routes + module transforms HTTP 200 · documentation
consistency pass across `PROJECT_CONTEXT.md`, `PROJECT_ARCHITECTURE.md`,
`README.md`, `DEVELOPER_HANDOFF.md`, `PRODUCTION_CHECKLIST.md` and the four
audit files. Prior validation evidence lives in each audit file
(`CROSS_BROWSER_QA.md` = 179/179 harness checks; `SECURITY_AUDIT.md` = 56/56
smoke + header/CSP proof; `PERFORMANCE_AUDIT.md` = Lighthouse 94/100/100/100).

## 12. OpenCode recovery instructions

If the OpenCode session or Windows environment resets, before making **any**
change:

```text
1. Scan PROJECT_CONTEXT.md.            (this file — current state)
2. Scan PROJECT_ARCHITECTURE.md.       (current architecture)
3. Read the relevant audit/documentation file for the area
   (USABILITY_AUDIT / PERFORMANCE_AUDIT / SECURITY_AUDIT /
    CROSS_BROWSER_QA / PRODUCTION_CHECKLIST / README).
4. Inspect the relevant source files.  (code is the source of truth)
5. Understand the existing implementation.
6. Make the smallest appropriate change.
7. Test the change: npm run lint && npm run build (+ dev smoke if visible).
8. Update documentation when architecture or behavior changed.
```

Never recreate existing architecture without checking the source first, and
never reintroduce a removed dependency (`framer-motion`, `tailwind.config.js`,
`ui/tabs.jsx`, `npx shadcn`) that earlier phases deliberately removed.
