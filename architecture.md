# Architecture — Student Review System

## High-Level Flow
1. User authenticates via Supabase Auth.
2. User creates a deck (course).
3. User pastes or imports notes (PDF / image / .docx / text) → AI generates atomic flashcards.
4. User reviews cards → FSRS schedules next review.
5. Dashboard shows retention, weak topics, due cards.

## Component Map
- `src/components/AppShell.jsx` — layout shell for standard routes: sidebar + top bar + scrollable main + bottom nav; owns scroll reset and `document.title`.
- `src/components/Sidebar.jsx` — desktop sidebar (≥1024px): brand, primary nav, account footer.
- `src/components/TopBar.jsx` — reusable page bar: hamburger (mobile), title or breadcrumb, theme toggle, account menu.
- `src/components/MobileNav.jsx` — bottom nav below `lg` (Dashboard/Decks/Review/Upload), in normal flow.
- `src/components/MobileMenu.jsx` — hamburger dialog: full nav list + sign-out (reuses shadcn Dialog).
- `src/components/UserMenu.jsx` — account dropdown (top-bar icon + sidebar row variants): Settings, Sign out.
- `src/components/Breadcrumbs.jsx` — reusable trail; last item is the current page (not a link).
- `src/lib/nav.js` — NAV_ITEMS / MOBILE_NAV_ITEMS, `getPageMeta(pathname, decks)`, shared NavLink class builders.
- `src/components/ui/dropdown-menu.jsx` — shadcn-style wrapper over radix-ui DropdownMenu.
- `src/lib/supabase.js` — Supabase client singleton.
- `src/lib/fsrs.js` — FSRS scheduling wrapper.
- `src/lib/ai.js` — Gemini card generation + fallback providers + image transcription.
- `src/lib/extract.js` — material import: PDF (pdf.js, local), images (Gemini vision), .docx (mammoth), .txt/.md.
- `src/lib/theme.js` — dark-mode helpers (read/apply/toggle/subscribe, localStorage `fastrev_theme`).
- `src/index.css` — design system: Tailwind v4 `@theme` tokens + light/dark variables.
- `src/components/ThemeToggle.jsx` — light/dark toggle button used in every page header.
- `src/hooks/useAuth.js` — Auth context (user, signIn, signUp, signOut).
- `src/hooks/useDecks.js` — CRUD for decks.
- `src/hooks/useCards.js` — CRUD for cards.
- `src/hooks/useReviews.js` — Review queue, submission, FSRS update.
- `src/hooks/useAnalytics.js` — Aggregations: retention, streak, due forecast, activity, weak decks.
- `src/components/ErrorBoundary.jsx` — Global error boundary wrapping the router.
- `src/pages/Auth.jsx` — Login / signup page.
- `src/pages/Decks.jsx` — `/decks` route: content width + shared `DeckList`.
- `src/pages/SettingsPage.jsx` — `/settings` route: wraps the existing `SettingsForm`.
- `src/pages/DeckList.jsx` — Deck list + create deck.
- `src/pages/DeckDetail.jsx` — Cards inside a deck.
- `src/pages/Review.jsx` — Daily review session UI.
- `src/pages/Upload.jsx` — Notes → card generation UI.
- `src/pages/Settings.jsx` — API key settings dialog (localStorage only).
- `src/pages/Analytics.jsx` — Retention stats and forecasts.
- `src/pages/Dashboard.jsx` — Post-login landing: welcome + sign-out (gains stats later).
- `src/App.jsx` — Router + layout.
- `src/main.jsx` — App entry point.

## Styling & Design System
Tailwind CSS v4, CSS-first — **no `tailwind.config.js` exists and none may be added**. Everything lives in `src/index.css`:

- **Token layer** — `@theme inline` maps semantic names to CSS variables (`--background`, `--foreground`, `--card`, `--border`, `--primary`, `--muted`, `--success`, `--warning`, `--danger`, each with a `-foreground` pair, plus `--chart-*` and `--elevated`). Components consume utilities only (`bg-primary`, `text-muted-foreground`, `bg-success/10`, …) — never hardcoded hex/oklch in JSX. The one exception is Recharts, which takes inline `var(--token)` styles.
- **Themes** — all values are oklch variables defined under `:root` (light) and `.dark`. Dark mode is a class, not an inversion: three slate steps form an elevation ladder (background → card → elevated) with translucent white borders. `.dark` on `<html>` is applied before first paint by the inline script in `index.html`, persisted in localStorage `fastrev_theme`, and toggled by `src/lib/theme.js` / `ThemeToggle.jsx`. `@custom-variant dark (&:is(.dark *))` rebinds `dark:` to the class (overriding Tailwind's default media-query variant).
- **Typography** — Inter Variable (`@fontsource-variable/inter`), fixed scale `12/14/16/18/24/32/48` (`--text-xs … --text-3xl`) with per-size line-heights (body 1.5, headings 1.2); two weights in practice (400 body, 500/600 titles).
- **Radius** — one base `--radius: 0.75rem` multiplied per step (`--radius-sm/md/lg/xl/…`); buttons/inputs `rounded-lg`, cards/dialogs `rounded-xl`.
- **Spacing** — stock Tailwind scale only (`space-y-*`, `gap-*`, `px-*`); page containers are `mx-auto max-w-2xl/3xl/5xl px-4 sm:px-6` so 375 px viewports keep comfortable gutters; breakpoints `sm:` 640 / `lg:` 1024 for grids (`sm:grid-cols-2 lg:grid-cols-3`).
- **Interaction states** — controls use `focus-visible:ring-2 focus-visible:ring-ring/50` + a global `:where(a, button, input, …):focus-visible` outline fallback; hover/active/disabled/loading (`data-[loading]`, `disabled:opacity-50`) come from the shadcn components; status is never color-only (rating buttons carry text labels).
- **Accessibility** — every foreground/background token pair is ≥ 4.5:1 in both themes; icon-only buttons carry `aria-label`, decorative icons `aria-hidden="true"`; `prefers-reduced-motion` disables all animation/transition; `color-scheme` flips with the theme so native controls/scrollbars match.
- **Validation habit** — after styling changes run `npm run lint`, `npm run build`, `npm run dev` (HTTP 200 on `/auth`, `/dashboard`, `/review`, `/upload`, `/analytics`, `/decks/:id`), and re-check both themes at 375 px and 1440 px.

## App Shell & Navigation (Phase 2)
One reusable shell owns all chrome for standard pages; pages render **content only**.

```
Desktop (≥1024px)               Mobile (<1024px)
┌─────────┬──────────────┐      ┌─────────────────┐
│ Sidebar │ Top bar      │      │ Top bar (≡ ☾ 👤)│
│ 240px   ├──────────────┤      ├─────────────────┤
│         │ <main>       │      │ <main>          │
│         │  scrolls     │      │  scrolls        │
│         │  <Outlet/>   │      │  <Outlet/>      │
└─────────┴──────────────┘      ├─────────────────┤
                                │ bottom nav (4)  │
                                └─────────────────┘
```

- **Routing** — `App.jsx`: `<ProtectedLayout>` → `<AppShell>` wraps `/dashboard`, `/decks`, `/decks/:id`, `/upload`, `/analytics`, `/settings`; `/review` is a **sibling**, not a child — that is the focus-mode opt-out (no sidebar/top bar/bottom nav; Review renders its own minimal header). Adding a focus route = add it outside `<AppShell>`.
- **Sidebar** (`w-60`, `bg-card`, `border-r`) — brand → 6 primary items (Dashboard, Decks, Review, Upload, Analytics, Settings) → account footer. Stable: the root is `h-dvh overflow-hidden`, only `<main class="min-h-0 flex-1 overflow-y-auto">` scrolls.
- **Navigation config** — `src/lib/nav.js` is the single source: sidebar, bottom bar, hamburger menu and top-bar titles all read `NAV_ITEMS`/`MOBILE_NAV_ITEMS`/`getPageMeta()`. Active state = `bg-primary/10 + text-primary + font-medium` (≥ 5.6:1 in both themes) plus NavLink's `aria-current="page"` — never color alone.
- **Top bar** — title derived from the route (`getPageMeta`), never authored by pages: plain routes render an `<h1>`; nested deck pages render a breadcrumb (`Decks / Biology`, last segment = current page, `aria-current`). Right side: ThemeToggle + account menu. Below `lg` a hamburger opens the menu.
- **Mobile bottom nav** — the 4 core destinations, rendered **in normal flow** inside the shell column (not `fixed`), so it physically cannot cover content; `env(safe-area-inset-bottom)` padding clears the iOS home indicator. Everything mobile switches at `lg` (1024px), matching the sidebar's breakpoint.
- **Mobile menu** — shadcn Dialog (Radix focus trap/Escape/labelling): full 6-item nav + email + sign-out. Upload's toast moved to `bottom-20 lg:bottom-6` so it clears the bottom nav.
- **User menu** — `UserMenu.jsx` (radix DropdownMenu): email label + Settings + Sign out only — no invented profile backend. Sidebar (full-width row) and top-bar (avatar) variants.
- **Content width** — shell adds no padding; each page keeps its own container (`mx-auto max-w-2xl/3xl/5xl px-4 py-6 sm:px-6`), so review/analytics/full-width pages stay in control.
- **Headings** — shell top bar owns the page `<h1>`; pages use `h2`+ (DeckDetail keeps its `h1` because its top bar shows a breadcrumb, not a title). Exactly one document `<main>`: the shell's (Review's own `<main>` only exists in focus mode, where the shell is absent).
- **Page chrome removed in Phase 2** — per-page headers/back-links/`min-h-screen` wrappers deleted from Dashboard/DeckDetail/Upload/Analytics; their content (welcome text, subtitles) was kept.

## Database Schema (Supabase)
- `decks` (id, user_id, name, description, created_at)
- `cards` (
    id, deck_id, user_id, question, answer, source,
    due, stability, difficulty, elapsed_days, scheduled_days,
    reps, lapses, state, last_review, created_at
  )
- `review_logs` (id, card_id, user_id, rating, reviewed_at)

All tables have RLS enabled with `auth.uid() = user_id` policies.

## External Services
- Supabase (DB, Auth, RLS, pgvector)
- Google Gemini (gemini-3.8-flash, card generation + image text transcription)
- Groq (`openai/gpt-oss-120b`) / Cerebras (`llama-3.3-70b`) — fallback LLM providers
- Vercel (frontend hosting)

## Data Flow: Card Generation
1. User pastes notes in `Upload.jsx`, or imports a file (button / drag-and-drop → `extract.js` extracts text into the notes box; images are transcribed via `ai.js transcribeImage` using the user's Gemini key).
2. `ai.js` sends notes to Gemini with a structured JSON prompt.
3. Gemini returns array of `{ question, answer, source }`.
4. User edits/approves cards in the preview UI.
5. `useCards.js` inserts approved cards into the `cards` table.

## Data Flow: Review Session
1. `useReviews.js` queries `cards WHERE due <= now() AND user_id = auth.uid()`.
2. User rates card (Again / Hard / Good / Easy).
3. `fsrs.js` computes the next scheduling state via `ts-fsrs`.
4. `useReviews.js` updates the card row + inserts a `review_logs` row.
5. UI advances to the next card in the queue.

## File Extension Rules
- React components: `.jsx`
- Hooks, libs, utilities: `.js`
- Config: `vite.config.js`, `tailwind.config.js` (if needed)
- NO `.ts` or `.tsx` files in this project.
- `ts-fsrs` is an external npm package (compiled JS) — safe to import from `.js`.