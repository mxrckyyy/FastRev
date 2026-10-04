# Project Context — Student Review System

## Current Phase
Phase 6: (to be defined)

## Completed Phases
- Phase 0: Project Setup & Context Initialization — Vite + React (JavaScript) scaffold at project root, Tailwind CSS v4 configured (vite.config.js + src/index.css), shadcn/ui initialized (JavaScript mode), dependencies installed (@supabase/supabase-js, ts-fsrs, react-router-dom), `.env` placeholders, `src/` directory structure. Dev server verified (HTTP 200 on :5173); `npm run build` and `npm run lint` both pass.
- Phase 1: Supabase Database Schema & Auth — SQL schema + RLS policies written to `supabase/migrations/0001_initial_schema.sql` (re-runnable; NOT yet executed — Supabase project creation deferred, see Key Decisions), `src/lib/supabase.js` client singleton, `src/hooks/useAuth.js` (AuthProvider + useAuth: user, loading, signIn, signUp, signOut), `src/pages/Auth.jsx` (login/signup form with shadcn Card/Input/Button/Tabs), `src/pages/Dashboard.jsx` (welcome + sign-out placeholder), protected routing in `src/App.jsx` + `src/main.jsx` (unauthenticated → /auth). shadcn components added: button, card, input, tabs. Verified: lint, production build, SSR render smoke test, `npm run dev` (HTTP 200).
- Phase 2: Deck CRUD & Navigation — `src/hooks/useDecks.js` (fetch/create/update/delete + loading/error, deck card counts via `select('*, cards(count)')`), `src/hooks/useCards.js` (fetch/create/update/delete + FSRS defaults on insert: due=now, state=0, stability/difficulty/elapsed/scheduled/reps/lapses=0), `src/pages/DeckList.jsx` (deck grid, New Deck dialog, AlertDialog delete confirm, click → /decks/:id), `src/pages/DeckDetail.jsx` (card list, Add Card dialog, inline edit, AlertDialog delete confirm, back link), `Dashboard.jsx` reworked (header + sign-out, "Due Today" placeholder stat, renders DeckList), routes added: `/dashboard`, `/decks/:id` (ProtectedLayout + Outlet), `/` → `/dashboard`. shadcn components added: dialog, alert-dialog, textarea. Verified: lint, production build, 7-case SSR render smoke test, `npm run dev` (HTTP 200, all new modules transform clean). NOT yet tested against a live Supabase DB (deferred — see Known Risks).
- Phase 3: Review Session & FSRS Wiring — `src/lib/fsrs.js` (ts-fsrs wrapper: `Rating` enum re-export, `scheduleCard(card, rating)` reads a DB row → returns updated FSRS fields as ISO strings, `createEmptyCardFSRS()` for new-card defaults; `generatorParameters({ enable_fuzz: true })`), `src/hooks/useReviews.js` (fetchDueCards(limit=50) `due <= now()` + `user_id` ordered by due asc, fetchDueCount exact count head query, submitReview: read row → scheduleCard → update card → insert review_logs), `src/pages/Review.jsx` (loading skeleton, one-card-at-a-time flow, Show Answer reveal, color-coded Again/Hard/Good/Easy buttons, `N / total · remaining` progress, "All caught up!" empty state, session-complete screen, fetch-retry + submit-error states), `Dashboard.jsx` updated (live `fetchDueCount()` — shows `—` until loaded — + prominent "Start Review" button → `/review`), `useCards.createCard` now spreads `...createEmptyCardFSRS()`, route `/review` added (ProtectedLayout). Verified: lint, production build, SSR smoke (FSRS unit checks: fresh/reviewed rows with Good/Again/Easy ratings; Review skeleton; Dashboard stat/link; route protection), `npm run dev` (HTTP 200, all new modules transform clean). NOT yet tested against a live Supabase DB (deferred — see Known Risks).
- Phase 4: AI Card Generation — `src/lib/ai.js` (`generateCards(notes, apiKeys?)` → `{ cards, provider, failures }`: Gemini 2.5 Flash → Groq Llama 3.3 70B → Cerebras chain, skips providers with no key, `responseMimeType: "application/json"`, fence-stripping JSON parse + shape validation, `AiError` with `.code` ∈ missing_key / invalid_key / rate_limit / network / malformed / provider_error, 45 s `AbortSignal.timeout`, plus localStorage key helpers `loadApiKey`/`loadApiKeys`/`saveApiKey`/`hasAnyApiKey` and `providerLabel` helper), `src/pages/Settings.jsx` (`SettingsDialog` default export + `SettingsForm`: Gemini/Groq/Cerebras password inputs saved to localStorage `gemini_api_key` / `groq_api_key` / `cerebras_api_key`, privacy note), `src/pages/Upload.jsx` (deck `<select>`, notes textarea, Generate button disabled without key/notes, generating state, editable preview rows — question/answer/source — with per-row delete + Add blank card, "Save to Deck (n)" via `useCards.createCard`, success toast → redirect `/decks/:id` after 1 s, friendly error box: rate-limit copy / invalid-key → Open Settings / network+malformed → Retry, provider + failed-provider caption), `Dashboard.jsx` header nav (Generate Cards → `/upload`, Settings button opens dialog), route `/upload` added (ProtectedLayout). Verified: lint, production build, 27-check smoke (mocked-fetch chain: gemini success, 429 → groq fallback with code-fenced JSON, malformed JSON, missing key, all-rate-limited, invalid key, network failure, providerLabel, storage keys; SSR renders of Upload/Dashboard/SettingsForm; `/upload` behind auth gate), `npm run dev` (HTTP 200, all new modules transform clean). NOT tested against real provider APIs (no keys yet) or live Supabase DB — see Known Risks.

- Phase 5: Analytics, Polish & Docs — installed `recharts` 3.10.1 + shadcn `skeleton` (local CLI), `src/hooks/useAnalytics.js` (two Supabase queries: `review_logs` with `card:cards(deck:decks(id, name))` embed + `cards(due, state)`; exported pure helpers `computeSummary`/`computeStreak`/`buildDueForecast`/`buildActivity`/`computeWeakDecks`; auto-fetch on mount with all setState inside promise callbacks), `src/pages/Analytics.jsx` (4 stat cards — retention / total reviews / streak / cards learned; 7-day due **BarChart**; 14-day review **LineChart**; weak decks list sorted lowest-accuracy-first, `<60%` shown destructive; Skeleton loading view; error box + Retry; empty state for every chart and list), `src/components/ErrorBoundary.jsx` (class component wrapping the router in `main.jsx`), Dashboard header (Analytics nav link + `flex-wrap`), route `/analytics` (ProtectedLayout), `README.md` written (overview, local setup, Supabase + RLS setup, AI provider keys, cron-job.org keep-alive + Edge Function alternative, Vercel deploy steps, free-tier limits table). Git repo initialized (`main`) with initial commit `9d57bac`; GitHub push + Vercel import left to the user (no `gh` CLI/credentials — see Key Decisions). Verified: lint, production build, 31-check smoke (13 helper unit checks incl. streak gaps/overdue clamping/weak ordering; SSR renders of Analytics skeleton, Dashboard nav, protected `/analytics` route, ErrorBoundary), `npm run dev` (HTTP 200, all new modules transform clean). NOT tested against a live Supabase DB or production deploy — see Known Risks.

## Next Phase
Phase 6: (to be defined)

## Tech Stack (Locked)
- Frontend: React 19 + Vite 8 (scaffolded via create-vite@latest on 2026-10-04; spec said Vite 7) + JavaScript (JSX, no TypeScript)
- Styling: Tailwind CSS v4
- UI Components: shadcn/ui (JavaScript mode)
- Backend/DB: Supabase (PostgreSQL + Auth + RLS)
- Spaced Repetition: ts-fsrs (FSRS) — imported as a compiled JS package
- AI Card Generation: Google Gemini 2.5 Flash (free tier)
- Hosting: Vercel (free tier)
- Package Manager: npm
- Routing: react-router-dom

## Project Constraints
- Zero monetary cost. All tools must have free tiers.
- Supabase free tier: 500 MB DB, 50K MAU, pauses after 7 days inactivity.
- AI must use free-tier APIs only. Rotate Gemini → Groq → Cerebras if rate-limited.
- No paid services. No Stripe. No paid hosting.

## Key Decisions
- Use plain JavaScript (JSX), not TypeScript. File extensions: .jsx / .js
- Use Vite + React (not Next.js) for simplicity and zero-cost static hosting.
- Use RLS on all tables. Every table must have `user_id` and an RLS policy.
- Use pgvector for semantic search (enable later when needed).
- shadcn/ui init: JavaScript mode (`components.json` has `"tsx": false`), style `radix-nova`, base library `radix`, icon library `lucide`, alias `@/*` (mapped in both `vite.config.js` and `jsconfig.json`).
- shadcn CLI is a local devDependency; run it as `node node_modules/shadcn/dist/index.js <cmd>` — NOT via `npx` (see Known Risks).
- `.env` holds `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` placeholders; it is gitignored — never commit real keys.
- Vite 8 only parses JSX in `.jsx` files, not `.js` — so `AuthProvider` in `useAuth.js` uses `React.createElement`. JSX stays in `.jsx` files only (hooks/libs remain `.js`).
- Auth API shape: `signIn` / `signUp` / `signOut` are async and return `{ error }`; `signUp` also returns `{ needsConfirmation }` when Supabase requires email confirmation. UI displays `error.message`.
- Supabase setup deferred until all phases are done (user decision, 2026-10-04): no real project yet, `.env` stays empty. `src/lib/supabase.js` falls back to placeholder values + `console.warn` so the app boots before setup; real auth works once `.env` is filled.
- Schema lives in `supabase/migrations/0001_initial_schema.sql`; it is re-runnable (`drop policy if exists` before each create) and must be executed in the Supabase SQL Editor when the project is created (anon key cannot run DDL).
- Data-hook convention: fetch functions are written with `.then()` callbacks (not async/await) so oxlint's `set-state-in-effect` rule stays clean when they're invoked from effects; mutations stay async/await (they only run from event handlers). All hook functions return `{ data }` / `{ error }` (or bare data for fetches) and mirror state into `loading` / `error`.
- CRUD/decks convention: deck delete is confirmed via shadcn AlertDialog; deck create via Dialog; card delete also confirmed; card edit is inline within the card row. Deck card counts come from a `cards(count)` join (`card_count`), not a separate query.
- Routing: `/auth` is guest-only; `/dashboard`, `/decks/:id`, `/review` are protected via `ProtectedLayout` (Outlet-based); `/` redirects to `/dashboard`; wildcard → `/`.
- ts-fsrs API (v5.4.2, verified): `f.next(card, now, rating)` → `{ card, log }`; card fields include Date `due`/`last_review` (→ `.toISOString()` for the DB) plus `learning_steps` which is NOT a DB column (must be stripped from updates); `Rating` = Manual 0, Again 1, Hard 2, Good 3, Easy 4; `createEmptyCard(now)` omits `last_review`.
- Phase 3 review convention: `useReviews` does NOT auto-fetch on mount (unlike useDecks/useCards) — Dashboard calls `fetchDueCount()` and Review calls `fetchDueCards()` in their own page effects, so neither page runs the other's query. `dueCount` starts as `null` → Dashboard renders `—` (caption "Checking what's due…" until loaded / "Could not load due count" on error).
- `submitReview(cardId, rating)`: re-reads the card row (guards stale data), runs `scheduleCard`, updates the row, then inserts `review_logs { card_id, user_id, rating }`; returns `{ data }` or `{ error }`. The review queue advances one-way — an "Again" card leaves the session (its next due is minutes away per the FSRS learning step) rather than being re-queued.
- Phase 4 AI convention: `generateCards(notes, apiKeys?)` accepts a bare Gemini key string, a `{ gemini, groq, cerebras }` object, or nothing (falls back to localStorage). It returns `{ cards, provider, failures }` and throws `AiError` (`.code` ∈ missing_key / invalid_key / rate_limit / network / malformed / provider_error). Upload maps `.code` → friendly copy + action (invalid/missing key → Open Settings, network/malformed → Retry).
- API keys live only in browser localStorage (`gemini_api_key`, `groq_api_key`, `cerebras_api_key`) via the helpers in `ai.js`; they are sent only to the matching provider endpoint — never to Supabase or any other server.
- Settings is a dialog, not a route: `src/pages/Settings.jsx` default-exports `SettingsDialog` (plus named `SettingsForm`), opened from the Dashboard header and the Upload header. Key state lives in `SettingsForm`, which remounts on each open so it re-reads localStorage.
- Upload uses `useCards()` with NO deckId (so it never auto-fetches) and passes the chosen deck id as `createCard(targetDeckId, …)`; save runs sequentially and on a partial failure removes only the saved rows from the preview.
- Deck picker is a native `<select>` styled with Tailwind (no shadcn Select component installed).
- Upload success: toast (auto-clears after 3 s) then `navigate('/decks/:id')` after 1 s.
- Phase 5 analytics convention: `useAnalytics` auto-fetches on mount (like useDecks/useCards — only Analytics.jsx consumes it). ALL state changes happen inside `.then()` callbacks, including the `setLoading(true)` toggle, so oxlint's `set-state-in-effect` rule stays clean (a synchronous `setLoading` reachable from an effect WILL warn).
- Aggregation is client-side over two Supabase selects (full `review_logs` with deck embed + `cards.due/state`); RLS scopes rows automatically. Supabase's default 1000-row cap per query is accepted as a free-tier-scale limit (documented, revisit if users exceed it).
- Metric definitions: retention = Good+Easy / total; streak = consecutive days with ≥1 review counting back from today (yesterday is the starting point if today is empty); due forecast clamps overdue cards into today's bucket; "cards learned" = `state >= 2`; weak decks sorted by accuracy ascending (weak % = 100 − accuracy).
- Recharts styling: theme tokens directly — bars `fill="var(--chart-3)"`, line `stroke="var(--foreground)"`, Tooltip uses `--popover/--border` contentStyle; fixed-height wrapper divs (`h-56`) for `ResponsiveContainer`.
- ErrorBoundary is a class component in `.jsx` (default export only) and wraps `BrowserRouter` in `main.jsx`; fallback offers "Try again" (reset) + "Reload page".
- Git/deploy: repo initialized on branch `main` with initial commit `9d57bac` (staged set verified free of `.env`/`node_modules`/`dist`/logs). No remote configured and no `gh` CLI — GitHub push + Vercel import are the user's steps (README § Deploy to Vercel).

## Known Risks / Watch Items
- Supabase project pauses after 7 days of inactivity → add cron ping.
- Gemini free tier has rate limits → implement fallback provider chain.
- 500 MB DB limit → store only text (cards ~1 KB each).
- npm 11.17 `EALLOWSCRIPTS`: user-level `~/.npmrc` has an `allow-scripts` setting; when npm is spawned under `npx`/npm exec, that config leaks into the child env and project-scoped installs fail. Workaround: run CLIs directly from local `node_modules` instead of `npx`.
- `npm audit`: 7 high-severity findings in the `braces` chain via `@shadcn/registry` (pulled in by the shadcn CLI devDependency). Only fix is breaking `shadcn@1.0.0` — revisit later; runtime deps are unaffected.
- Supabase Auth "Confirm email" is ON by default → sign-ups need email confirmation before login. Disable it in Dashboard → Auth → Email for smoother testing (the UI already shows a "check your email" message via `needsConfirmation`).
- Phase 2 CRUD (useDecks/useCards) is only verified via lint/build/SSR — NOT against a live Supabase DB (project deferred). Once `.env` is filled and the SQL migration runs, manually verify: deck create/delete with RLS scoping, card counts via the `cards(count)` join, cascade delete of cards when a deck is deleted.
- Phase 3 review flow is only verified via lint/build/SSR + FSRS unit checks — NOT against a live Supabase DB. Once set up, manually verify: due queue respects RLS/user scoping, `submitReview` updates the card row and inserts `review_logs`, Dashboard due count matches the queue, and a rated "Again" card disappears from the current session but reappears minutes later.
- Phase 4 AI generation is only verified with a mocked `fetch` (no real provider keys yet). Once a key exists, manually verify: real Gemini response parsing, live rate-limit → Groq → Cerebras fallback, and browser CORS when deployed to Vercel (Groq/Cerebras in-browser CORS is unverified — if blocked, the chain will surface a `network` error).
- API keys in localStorage are readable by any script on the same origin — acceptable for this single-user free-tier app; never add third-party scripts/trackers to the origin.
- Phase 5 analytics verified via helper unit checks + SSR only — NOT against a live Supabase DB. Once set up, manually verify: the `card:cards(deck:decks(id, name))` embed returns joined rows (weak-decks list populates), retention/streak match manual counts, due forecast matches the review queue, and the deck-less/empty-data states appear correctly.
- Vercel deploy is PENDING user action (GitHub push + Vercel import + env vars). Production verification (auth → review flow) is blocked until the Supabase project exists and `.env`/Vercel env vars are set. Revisit when user does setup.
- Bundle: main chunk is ~1 MB minified (1,018 kB) after Recharts → Vite warns over 500 kB. Consider lazy-loading the `/analytics` route (`React.lazy`) as a future optimization; not required for correctness.
- Supabase queries in `useAnalytics` fetch full `review_logs` (no pagination) — fine for free-tier scale, but if a user accumulates >1000 logs, analytics will silently undercount (Supabase default row cap).

## File Index
- `AGENTS.md` — this file (project context)
- `architecture.md` — system architecture reference
- `README.md` — setup, Supabase + AI key setup, cron keep-alive, Vercel deploy, free-tier limits
- `package.json` — deps + scripts (`dev`, `build`, `lint` (oxlint), `preview`)
- `vite.config.js` — Vite config (JavaScript, NOT .ts): react + tailwindcss plugins, `@` alias
- `jsconfig.json` — `@/*` path mapping for editors and shadcn alias detection
- `components.json` — shadcn/ui config (JavaScript mode)
- `.env` — Supabase URL/anon-key placeholders (gitignored; empty until Supabase setup)
- `index.html` — Vite entry HTML (title: FastRev)
- `src/index.css` — Tailwind v4 import + shadcn theme tokens (Geist font, CSS variables)
- `src/main.jsx` — entry point: BrowserRouter + AuthProvider wrapping App
- `src/App.jsx` — router: `/auth` (guest-only) + `/dashboard`, `/decks/:id`, `/review`, `/upload`, `/analytics` (ProtectedLayout) + `/` → `/dashboard` + wildcard redirect
- `src/lib/supabase.js` — Supabase client singleton (placeholder fallback until `.env` is set)
- `src/lib/fsrs.js` — ts-fsrs wrapper: Rating enum, scheduleCard, createEmptyCardFSRS
- `src/lib/ai.js` — Gemini → Groq → Cerebras chain: generateCards, AiError codes, localStorage key helpers, providerLabel
- `src/lib/utils.js` — `cn` helper
- `src/hooks/useAuth.js` — AuthProvider + useAuth (user, loading, signIn, signUp, signOut); uses `createElement`, no JSX
- `src/hooks/useDecks.js` — deck CRUD: fetchDecks/createDeck/updateDeck/deleteDeck + loading/error
- `src/hooks/useCards.js` — card CRUD: fetchCards/createCard/updateCard/deleteCard + FSRS defaults via createEmptyCardFSRS + loading/error
- `src/hooks/useReviews.js` — fetchDueCards/fetchDueCount/submitReview + loading/error (no auto-fetch on mount)
- `src/hooks/useAnalytics.js` — aggregation: summary/streak/forecast/activity/weakDecks (pure helpers exported) + auto-fetch
- `src/pages/Auth.jsx` — login/signup form (shadcn Card, Input, Button, Tabs)
- `src/pages/Dashboard.jsx` — header + Analytics / Generate Cards / Settings / sign-out, live "Due Today" count (fetchDueCount) + "Start Review" button, renders DeckList
- `src/pages/DeckList.jsx` — deck grid, New Deck dialog, delete confirmation, navigate to deck
- `src/pages/DeckDetail.jsx` — deck header + card count, Add Card dialog, inline card edit, delete confirmation
- `src/pages/Review.jsx` — one-card-at-a-time review session: skeleton, Show Answer, color-coded ratings, progress, empty/complete states
- `src/pages/Upload.jsx` — notes → generateCards → editable preview → save to deck; friendly error box + toast + redirect
- `src/pages/Settings.jsx` — SettingsDialog (default) + SettingsForm: API keys → localStorage, privacy note
- `src/pages/Analytics.jsx` — stat cards, due BarChart, activity LineChart, weak decks, skeletons/empty/error states
- `src/components/ErrorBoundary.jsx` — class error boundary wrapping the router (main.jsx)
- `src/components/ui/` — shadcn components: alert-dialog.jsx, button.jsx, card.jsx, dialog.jsx, input.jsx, skeleton.jsx, tabs.jsx, textarea.jsx
- `supabase/migrations/0001_initial_schema.sql` — decks/cards/review_logs tables + indexes + RLS policies (run in SQL Editor when Supabase project exists)
- `supabase/` — SQL migrations and edge functions (if any)

## Last Updated
2026-10-05 — Phase 5 completed: recharts + skeleton installed, useAnalytics.js (two-query aggregation + tested pure helpers), Analytics.jsx (stat cards, BarChart forecast, LineChart activity, weak decks, skeleton/error/empty states), ErrorBoundary.jsx wrapping router, Dashboard Analytics nav + /analytics route, README.md (setup/Supabase/AI/cron/Vercel/free-tier docs), git repo initialized with initial commit `9d57bac` (push + Vercel import left to user); lint/build/31-check smoke/dev verified. `architecture.md` Component Map gained two entries (`useAnalytics.js`, `ErrorBoundary.jsx`) — the only change; `Analytics.jsx` was already listed.
2026-10-05 — Phase 4 completed: ai.js (Gemini → Groq → Cerebras chain, AiError codes, localStorage key helpers, providerLabel), Settings.jsx (SettingsDialog/SettingsForm), Upload.jsx (deck select, generate, editable preview, save + toast + redirect, friendly errors), Dashboard nav (Generate Cards / Settings), `/upload` route; lint/build/27-check smoke/dev verified. `architecture.md` Component Map gained one entry (`src/pages/Settings.jsx`) — the only change; data flows already described this phase.
2026-10-04 — Phase 3 completed: fsrs.js (scheduleCard/createEmptyCardFSRS/Rating), useReviews.js (due queue, due count, submitReview), Review.jsx session UI, Dashboard live count + Start Review, /review route, useCards wired to createEmptyCardFSRS; lint/build/SSR/dev verified. `architecture.md` unchanged (its Component Map + Review data flow already described these files).
2026-10-04 — Phase 2 completed: useDecks/useCards hooks, DeckList/DeckDetail pages, Dashboard rework (DeckList + Due Today placeholder), /dashboard and /decks/:id routes; lint/build/SSR/dev verified. `architecture.md` unchanged (its Component Map already described these components).
