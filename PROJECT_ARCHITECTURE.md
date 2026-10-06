# PROJECT_ARCHITECTURE.md — FastRev

Current-state architecture summary. The long-form reference is `architecture.md`
(this file stays aligned with it; where they differ, `architecture.md` wins).

## 1. High-level architecture

```
Browser (React 19 SPA, static on Vercel)
├── react-router-dom v7         route guards: GuestRoute / ProtectedLayout
├── AuthProvider (useAuth)      Supabase auth session, user/loading
├── AppShell                    chrome for standard routes (sidebar/top/bottom nav)
│                               focus-mode routes are siblings, not children
│                               keyed 150ms fade on route change (Phase 8)
├── Toaster (sonner)            global success/error toasts (Phase 8) — bottom-center,
│                               5rem offset, unstyled + token classNames
├── Data hooks                  useDecks / useCards / useReviews / useAnalytics
├── Design system               src/index.css tokens + shadcn/ui components
└── Client-side integrations
    ├── Supabase REST + Auth    RLS-scoped reads/writes (anon key)
    ├── AI providers            Gemini → Groq → Cerebras (fetch from browser,
    │                           keys in localStorage, 45s timeout, chain on failure)
    └── Material extraction     PDF (pdf.js local) · docx (mammoth local) ·
                                images (Gemini vision OCR)
        → no application server anywhere; Vercel serves static files only.
```

## 2. Data model (Supabase)

Three tables, each with `user_id` + RLS (schema: `supabase/schema.sql`):

- **decks** — `id, user_id, name, description, created_at`
  (card counts merged client-side via `cards(count)` join; `due_count` merged
  from a second query of cards with `due <= now()`).
- **cards** — `id, deck_id (FK cascade), user_id, question, answer, source,
  + FSRS columns: due, state, stability, difficulty, elapsed_days,
  scheduled_days, reps, lapses, last_review`
- **review_logs** — `id, card_id (FK), user_id, rating (1–4), reviewed_at`
  Analytics joins `card:cards(deck:decks(id,name))` for weak-deck stats.

RLS: enable on all tables; per-user policies on select/insert/update/delete
(`auth.uid() = user_id`). Aggregation happens **client-side** (two queries) —
accepted free-tier trade-off (Supabase 1000-row default cap).

## 3. Routing & layout architecture

```
BrowserRouter (main.jsx)
└── ErrorBoundary → AuthProvider → App
    ├── /auth                    GuestRoute → Auth (full-screen card, no shell)
    └── ProtectedLayout          Loading… | redirect to /auth if signed out
        ├── AppShell             h-dvh: sidebar (≥lg) + top bar + <main> + bottom nav (<lg)
        │   │                     Outlet wrapped in Suspense (Phase 11 lazy routes)
        │   ├── /dashboard       learning overview, stats, priority decks (EAGER)
        │   ├── /decks           full deck grid (lazy)
        │   ├── /decks/:id       deck detail + card list (lazy)
        │   ├── /upload          two-panel AI generation workspace (lazy)
        │   ├── /analytics       charts + insights (lazy — keeps recharts off first paint)
        │   └── /settings        API-key form (lazy)
        └── /review              FOCUS MODE — sibling of AppShell (ReviewShell:
                                 own minimal header, no nav; lazy + own Suspense)
    / → /dashboard · * → /
```

- Focus mode = routing, not flags: a route opts out by being a sibling of
  `AppShell` inside `ProtectedLayout`.
- `src/lib/nav.js` is the single source for navigation (sidebar, bottom bar,
  hamburger, top-bar titles all read `NAV_ITEMS` / `getPageMeta`).
- Route transitions: `AppShell` wraps `<Outlet/>` in a `key={pathname}` fade
  (`animate-in fade-in-0 duration-150` + `motion-reduce:animate-none`); focus
  routes sit outside the shell and keep their own entrance animations.
- **Code splitting (Phase 11):** all routes except AppShell/Auth/Dashboard are
  `React.lazy`; the shell's `Suspense` boundary sits **inside** the keyed fade
  div so the chrome never unmounts while a chunk loads (spinner =
  `RouteFallback`, reduced-motion aware). `/review` has its own boundary.

## 4. Auth architecture

```
supabase.auth (email/password, email confirmation ON by default)
        │ onAuthStateChange / getSession
AuthProvider (src/hooks/useAuth.js)
  exposes: user, loading, signIn(email, pw), signUp(email, pw), signOut
        │ user
   ┌────┴─────────────────┐
GuestRoute (/auth)      ProtectedLayout (everything else)
 signed in → /dashboard   loading → Loading…
                           signed out → /auth
```

- `signUp` returns `{ error, needsConfirmation }` where
  `needsConfirmation = !session` (email confirmation flow).
- Successful login updates `user` → `GuestRoute` redirects to `/dashboard`;
  sign-out (UserMenu) flips `user` → protected routes redirect to `/auth`.
- `Auth.jsx` is the only auth UI (Phase 7): default export owns form state,
  client-side validation (`lib/authForm.js` — `validateAuthEmail`,
  `validateAuthPassword` with the 6-char minimum only at signup) and the
  Supabase calls; the exported `AuthView({ … })` is a stateless view. One
  mode-driven shared form — labeled `h-10` inputs (autocomplete email /
  current-password / new-password), show/hide password, inline field errors
  (`aria-invalid` + `aria-describedby`), friendly `role="alert"` server errors
  via `friendlyAuthError` (unknown messages → generic copy), loading =
  inputs+button disabled with mode-specific busy labels, `needsConfirmation` →
  `role="status"` confirmation panel, bottom switch link for the mode change.
  Focus: first invalid field on submit, mode heading after a switch, submit
  button after a server error.
- **Out of scope / not implemented:** password reset, social login, remember-me.

## 5. Review & FSRS architecture

```
useReviews.fetchDueCards()        cards WHERE due <= now(), RLS-scoped, limit 50
        │ queue (Review.jsx, one card at a time)
Flashcard → reveal → RatingButtons (Again/Hard/Good/Easy, keys 1–4, Space reveals)
        │ rating
useReviews.submitReview(cardId, rating)
   1. re-read row (stale guard)
   2. lib/fsrs.js scheduleCard(row, rating)   ts-fsrs wrapper
   3. update card row (FSRS fields as ISO; strip learning_steps)
   4. insert review_logs { card_id, user_id, rating }
```

- Learning-step convention: an "Again" card leaves the session (next due in
  minutes) rather than being re-queued.
- Keyboard + focus management live in `Review.jsx`; presentation in
  `ReviewShell` / `Flashcard` / `RatingButtons` / `ShortcutHint`;
  `RATINGS` config in `src/lib/ratings.js` is the single source.

## 6. AI generation & material import

```
Upload.jsx
  notes/material → extractFromFile() (lib/extract.js)
      PDF → pdf.js (local, legacy build, lazy chunk)
      .docx → mammoth (local, lazy chunk)   .txt/.md → text
      image → transcribeImage() (Gemini vision OCR)
  → generateCards(notes, keys?) (lib/ai.js)
      Gemini 2.5 Flash → Groq → Cerebras chain (skips providers without keys,
      JSON-mode response, fence-stripping parse, AiError codes, 45s timeout)
  → preview (GeneratedCard rows, edit/remove/select)
  → useCards.createCard() loop → redirect /decks/:id
```

- API keys: localStorage only (`gemini_api_key`, `groq_api_key`,
  `cerebras_api_key`) via helpers in `ai.js`; sent only to the matching provider.
- Settings dialog/route (`SettingsForm`) writes those keys; no server storage.
- **Usability fixes (Phase 10):** `/upload?deck=<id>` deep-link preselects the
  target deck (DeckDetail's "Generate cards" action + empty-state link); Save
  buttons require the deck to *resolve* (stale links can't FK-fail); after a
  successful save `saving` stays armed through the 1-second redirect so a second
  click can't duplicate cards; deck-load failure shows a friendly `role="alert"`
  panel with Try again.

## 7. Analytics architecture

`useAnalytics` runs two RLS-scoped selects (`review_logs` with deck embed;
`cards.due/state`) and aggregates client-side with exported pure helpers:
`computeSummary` (retention, counts), `computeStreak`, `buildDueForecast`
(overdue clamped into today), `buildActivity` (14-day buckets),
`computeWeakDecks` (accuracy ascending). `Analytics.jsx` renders stats,
Highlights, activity/trend, forecast, rating-breakdown meter, weak topics,
plus loading/error/no-history states.

## 8. Design-system architecture

- **Single token file:** `src/index.css` — Tailwind v4 `@theme inline` maps every
  token to a utility (`--color-primary` → `bg-primary`, …). Light in `:root`,
  dark in `.dark`; no `tailwind.config.js`.
- **Boundary tokens:** `--border` = 1 px structural hairline (dividers, card
  edges); `--input` = control boundaries (inputs, textareas, select, outline
  buttons), ≥3:1 vs surfaces in both themes (WCAG 1.4.11 — Final QA fix).
- **Component layer:** shadcn/ui primitives under `src/components/ui/`
  (JSX, `cn` = tailwind-merge) — extend by adding utilities/classes, never by
  hardcoding colors. Irreversible confirms (delete deck/card) render
  `AlertDialogAction` with the solid **`danger`** button variant so the
  destructive action is visually distinct from primary actions (Phase 10, U-07);
  trim-first validation guards every name/question/answer form (U-02/U-03).
- **Theming:** pre-paint inline script in `index.html` sets `.dark` before React
  loads; `lib/theme.js` helpers + `ThemeToggle` persist/sync (`fastrev_theme`,
  cross-tab).
- **State-driven color tokens:** success/warning/danger (reviews, errors,
  analytics); `destructive` is an alias so stock shadcn classes resolve to
  the same token.
- **Motion (Phase 8):** tw-animate-css + CSS transitions only — framer-motion
  is not installed. Global `prefers-reduced-motion` clamp in `index.css`
  (0.01 ms) is the backstop; moving parts also carry `motion-reduce:*`.
  Entrances: route fade (shell), `fade-in-0 duration-200` on EmptyState /
  ErrorState / StatCard values, existing dialog/dropdown open-close animations.
- **Feedback (Phase 8):** one `<Toaster>` (sonner, `main.jsx`) styled entirely
  with token utilities — call sites import `toast` directly; policy = CRUD/save
  successes + delete-failure errors only, never for validation or panel-managed
  failures. Async submits outside Auth use `components/LoadingButton.jsx`
  (disabled + `aria-busy` + `LoaderCircle` + action-specific `loadingLabel`);
  skeletons are shape-mirroring (DeckDetail gained a real one); no fake progress
  anywhere.

## 9. External services & configuration

| Service              | Purpose                    | Config                                        |
| -------------------- | -------------------------- | --------------------------------------------- |
| Supabase project     | DB + Auth + RLS            | `.env` → `VITE_SUPABASE_URL/ANON_KEY` (Vercel too); schema via SQL Editor |
| Google Gemini        | card generation + image OCR| `gemini_api_key` (localStorage)               |
| Groq                 | fallback generation        | `groq_api_key`                                |
| Cerebras             | fallback generation        | `cerebras_api_key`                            |
| cron-job.org (opt.)  | keep Supabase awake        | user-created job (README)                     |
| Vercel               | static hosting             | env vars must exist at build time             |

## 10. Build & quality

- Vite 8 build. **Phase 11 split the initial chunk: 1,150.61 kB → 657.37 kB
  (gzip 335 → 192 kB)**; recharts now lives in the lazy `Analytics` chunk
  (387 kB), route pages are 0.5–26 kB lazy chunks, pdf.js/mammoth stay lazy.
- **Lighthouse (lab, mobile throttled, `vite preview`): 94 / 100 / 100 / 100**
  (performance / a11y / best-practices / SEO); FCP 2.3 s · LCP 2.6 s · TBT 10 ms
  · CLS 0. Baseline was 88 / 98 / 100 / 82 — full detail + method in
  `PERFORMANCE_AUDIT.md` (scores are lab-only, never field data).
- oxlint: 1 tolerated pre-existing warning (`ui/button.jsx` fast-refresh; the
  second disappeared with Final QA's deletion of the dead `ui/tabs.jsx`).
- Every UI phase validates: lint → build → SSR smoke → contrast audit →
  dev-server routes → built-CSS utility check (temp scripts, deleted after).
- Latest (Phase 11): build ✓ · 27/27 perf smoke · 10 routes + 5 modules HTTP 200
  · Lighthouse after-run 94/100/100/100 (stored JSON, temp dir). Interactive
  browser QA still pending — see AGENTS.md risks.
