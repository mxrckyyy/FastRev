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

**Phase 9 — not yet defined.**
Phases 0–6 are complete: project setup, Supabase schema/auth, deck CRUD, review +
FSRS, AI generation, analytics + docs, schema repair, material import, and UI/UX
plan Phases 1–8 (design system, app shell, dashboard/decks, review focus mode,
upload, analytics, authentication, interaction/motion/feedback). **App-wide Final
QA & Polish (audit & fix pass) completed 2026-10-06** — control-boundary contrast
(`--input`), type-scale fixes, dead `tabs.jsx` removed, ARIA/landmark gap-fills,
icon-size + error-tint consistency, chart text alternatives; no functionality
changed. See `AGENTS.md` → Completed Phases + `architecture.md` → § Final QA & Polish.

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
├── README.md                    # setup: Supabase, AI keys, cron, Vercel deploy
├── index.html                   # entry; inline pre-paint dark-mode bootstrap
├── vite.config.js               # react + tailwindcss plugins, @ alias (JS, not .ts)
├── jsconfig.json                # @/* path mapping
├── components.json              # shadcn config (JavaScript mode)
├── .env                         # VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (gitignored)
├── supabase/
│   ├── schema.sql               # canonical schema to run in SQL Editor
│   ├── migrations/0001_initial_schema.sql
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
    │   ├── supabase.js          # client singleton (placeholder fallback)
    │   ├── fsrs.js              # ts-fsrs wrapper (scheduleCard, Rating)
    │   ├── ai.js                # provider chain + transcription + key helpers
    │   ├── extract.js           # PDF/image/.docx/txt material extraction
    │   ├── nav.js               # NAV_ITEMS single source + link class builders
    │   ├── ratings.js           # RATINGS config (Again/Hard/Good/Easy, keys 1–4)
    │   ├── theme.js             # dark-mode read/apply/toggle/subscribe
    │   ├── authForm.js          # auth validation + Supabase error → friendly copy
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
- Dark mode: `.dark` on `<html>`, bootstrapped pre-paint by inline script in
  `index.html`, persisted in localStorage `fastrev_theme` (`src/lib/theme.js`).
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
Latest run (Final QA): lint 1 warning · build ✓ · 49/49 smoke · 84/84 contrast
(+2 documented INFO) · 9 routes + 13 modules HTTP 200.

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
