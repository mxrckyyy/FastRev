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
- `src/lib/ratings.js` — `RATINGS` config (value/label/Button-variant in keyboard order 1–4); single source for the rating buttons, shortcut hint, keyboard map and completion tally.
- `src/components/ui/dropdown-menu.jsx` — shadcn-style wrapper over radix-ui DropdownMenu.
- `src/components/ui/badge.jsx` — shadcn-style pill (`default` / `secondary` / `soft` primary tint); text always carries the meaning, never color alone.
- `src/components/StatCard.jsx` — dashboard statistic (icon chip + label + big value + caption) + `StatCardSkeleton`; tones: primary / success / warning / muted.
- `src/components/DeckCard.jsx` — deck preview card (name → due badge → description → count → Open → Delete) + `DeckCardSkeleton` + `CreateDeckCard` (dashed invitation tile); delete outcome reported via sonner toast (Phase 8).
- `src/components/CreateDeckDialog.jsx` — extracted create-deck dialog (self-contained form; calls the caller's `createDeck`), reused by DeckList and the Dashboard empty state; submit uses `LoadingButton` + success toast (Phase 8).
- `src/components/EmptyState.jsx` — shared empty state (icon, heading, description, CTA slot).
- `src/components/ErrorState.jsx` — shared loading-error panel (icon, friendly message, optional raw detail, real retry button).
- `src/components/ReviewShell.jsx` — focus-mode frame for `/review`: Exit + ThemeToggle header, pinned progress slot, centered scrollable `<main>`, optional footer slot (shortcut hint).
- `src/components/ReviewProgress.jsx` — position counter + determinate bar with `role="progressbar"` / `aria-valuetext`.
- `src/components/Flashcard.jsx` — question/answer card (focusable question heading, reveal block, source line).
- `src/components/RatingButtons.jsx` — the four rating actions (2×2 mobile / 4-across sm+, `role="group"`, `aria-keyshortcuts`).
- `src/components/ShortcutHint.jsx` — state-aware keyboard hint footer (Space / 1–4), hidden below `sm`.
- `src/components/GeneratedCard.jsx` — generated-card preview row: selection checkbox, question/answer scan view, aria-labelled Edit/Remove buttons, parent-driven inline editor (Save/Cancel + validation).
- `src/components/GenerationSkeleton.jsx` — generation loading state: `role="status"` line + decorative skeleton cards shaped like real preview rows; the status line's spinner is LoaderCircle (`animate-spin motion-reduce:animate-none`).
- `src/components/LoadingButton.jsx` — shared async submit button (Phase 8): disabled + `aria-busy` + Button's `data-[loading]` dimming while loading, label swaps for a LoaderCircle spinner + `loadingLabel` ("Creating…", "Saving…", …). Used by every async submit outside Auth (which keeps its own identical inline pattern).
- `src/components/ui/checkbox.jsx` — shadcn-style radix checkbox (added Phase 5); unchecked border uses `foreground/50` (≥3:1 vs card) instead of stock `border-input`.
- `src/lib/supabase.js` — Supabase client singleton.
- `src/lib/fsrs.js` — FSRS scheduling wrapper.
- `src/lib/ai.js` — Gemini card generation + fallback providers + image transcription.
- `src/lib/extract.js` — material import: PDF (pdf.js, local), images (Gemini vision), .docx (mammoth), .txt/.md.
- `src/lib/theme.js` — dark-mode helpers (read/apply/toggle/subscribe, localStorage `fastrev_theme`).
- `src/lib/authForm.js` — pure auth-form logic: `validateAuthEmail` / `validateAuthPassword` (signup-only 6-char minimum) / `friendlyAuthError` (Supabase message → friendly copy).
- `src/index.css` — design system: Tailwind v4 `@theme` tokens + light/dark variables.
- `src/components/ThemeToggle.jsx` — light/dark toggle button used in every page header.
- `src/hooks/useAuth.js` — Auth context (user, signIn, signUp, signOut).
- `src/hooks/useDecks.js` — CRUD for decks; also fetches per-deck `due_count` (deck rows with `cards(count)` + the deck_ids of currently-due cards, merged client-side).
- `src/hooks/useCards.js` — CRUD for cards.
- `src/hooks/useReviews.js` — Review queue, submission, FSRS update.
- `src/hooks/useAnalytics.js` — Aggregations: retention, streak, due forecast, activity, weak decks.
- `src/components/ErrorBoundary.jsx` — Global error boundary wrapping the router.
- `src/pages/Auth.jsx` — Phase 7 auth screen: default export (state/validation/Supabase calls) + exported `AuthView({ … })` presentational view (see Authentication below).
- `src/pages/Decks.jsx` — `/decks` route: content width + shared `DeckList`.
- `src/pages/SettingsPage.jsx` — `/settings` route: wraps the existing `SettingsForm`.
- `src/pages/DeckList.jsx` — deck grid (1/2/3 columns) + create deck, with loading skeletons / error retry / empty state.
- `src/pages/DeckDetail.jsx` — cards inside a deck: loading renders the Phase 8 `DeckDetailSkeleton` (header + card-row shapes, `aria-busy`, sr-only "Loading deck…"), CRUD success/failure reported via toasts.
- `src/pages/Review.jsx` — focus-mode review session: queue/submit via `useReviews`, keyboard shortcuts, focus management, progress, rating flow, loading/error/empty/completion states (Phase 4; see below).
- `src/pages/Upload.jsx` — two-panel card-generation workspace: material input + Generate → skeleton/preview with select/edit/remove → Save All / Save Selected (Phase 5; see below). Async submits use `LoadingButton`; the save-confirmation toast is the global sonner toast (Phase 8).
- `src/pages/Settings.jsx` — API key settings dialog (localStorage only).
- `src/pages/Analytics.jsx` — learning-analytics page: stats row, Highlights chips, activity/forecast charts, rating breakdown, weak topics (Phase 6; see below).
- `src/pages/Dashboard.jsx` — learning overview: greeting, Start Review hero, 4 stat cards, priority decks (Phase 3; see below).
- `src/App.jsx` — Router + layout.
- `src/main.jsx` — app entry: ErrorBoundary → BrowserRouter → AuthProvider → App + the global sonner `<Toaster>` (Phase 8, see Interaction & Feedback).

## Styling & Design System
Tailwind CSS v4, CSS-first — **no `tailwind.config.js` exists and none may be added**. Everything lives in `src/index.css`:

- **Token layer** — `@theme inline` maps semantic names to CSS variables (`--background`, `--foreground`, `--card`, `--border`, `--primary`, `--muted`, `--success`, `--warning`, `--danger`, each with a `-foreground` pair, plus `--chart-*` and `--elevated`). Components consume utilities only (`bg-primary`, `text-muted-foreground`, `bg-success/10`, …) — never hardcoded hex/oklch in JSX. The one exception is Recharts, which takes inline `var(--token)` styles.
- **Themes** — all values are oklch variables defined under `:root` (light) and `.dark`. Dark mode is a class, not an inversion: three slate steps form an elevation ladder (background → card → elevated) with translucent white borders. `.dark` on `<html>` is applied before first paint by the inline script in `index.html`, persisted in localStorage `fastrev_theme`, and toggled by `src/lib/theme.js` / `ThemeToggle.jsx`. `@custom-variant dark (&:is(.dark *))` rebinds `dark:` to the class (overriding Tailwind's default media-query variant).
- **Typography** — Inter Variable (`@fontsource-variable/inter`), fixed scale `12/14/16/18/24/32/48` (`--text-xs … --text-3xl`) with per-size line-heights (body 1.5, headings 1.2); two weights in practice (400 body, 500/600 titles).
- **Radius** — one base `--radius: 0.75rem` multiplied per step (`--radius-sm/md/lg/xl/…`); buttons/inputs `rounded-lg`, cards/dialogs `rounded-xl`.
- **Spacing** — stock Tailwind scale only (`space-y-*`, `gap-*`, `px-*`); page containers are `mx-auto max-w-2xl/3xl/5xl px-4 sm:px-6` so 375 px viewports keep comfortable gutters; breakpoints `sm:` 640 / `lg:` 1024 for grids (`sm:grid-cols-2 lg:grid-cols-3`).
- **Interaction states** — controls use `focus-visible:ring-2 focus-visible:ring-ring/50` + a global `:where(a, button, input, …):focus-visible` outline fallback; hover/active/disabled/loading (`data-[loading]`, `disabled:opacity-50`) come from the shadcn components; status is never color-only (rating buttons carry text labels).
- **Control boundaries (Final QA fix)** — `--border` and `--input` are different jobs: `--border` is the 1 px structural hairline (dividers, card/dialog edges — intentionally light, ~1.3:1) while `--input` draws control boundaries (text inputs, textareas, deck select, outline buttons) and is calibrated to WCAG 1.4.11's ≥3:1 against card/background/elevated/muted in both themes (Final QA darkened light `--input` to `oklch(0.64 0.006 264)` and dark to `oklch(1 0 0 / 38%)`).
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
- **Mobile menu** — shadcn Dialog (Radix focus trap/Escape/labelling): full 6-item nav + email + sign-out. Upload's inline toast was retired in Phase 8 in favour of the global sonner toast (Toaster offset clears the bottom nav).
- **User menu** — `UserMenu.jsx` (radix DropdownMenu): email label + Settings + Sign out only — no invented profile backend. Sidebar (full-width row) and top-bar (avatar) variants.
- **Content width** — shell adds no padding; each page keeps its own container (`mx-auto max-w-2xl/3xl/5xl px-4 py-6 sm:px-6`), so review/analytics/full-width pages stay in control.
- **Headings** — shell top bar owns the page `<h1>`; pages use `h2`+ (DeckDetail keeps its `h1` because its top bar shows a breadcrumb, not a title). Exactly one document `<main>`: the shell's (Review's own `<main>` only exists in focus mode, where the shell is absent).
- **Page chrome removed in Phase 2** — per-page headers/back-links/`min-h-screen` wrappers deleted from Dashboard/DeckDetail/Upload/Analytics; their content (welcome text, subtitles) was kept.

## Dashboard & Deck List (Phase 3)
Dashboard is the learning overview; `/decks` is the full library. Both are content-only pages inside the shell (top bar owns the `<h1>`; pages keep their own `mx-auto max-w-5xl px-4 py-6 sm:px-6` container).

```
Dashboard                            /decks (DeckList)
┌──────────────────────────────┐     ┌──────────────────────────────┐
│ Welcome + subtitle           │     │ Your decks · n decks · m c.  │
│ ┌ Hero: Ready to review? ┐   │     │                    [New Deck]│
│ │ icon · copy · [Start]  │   │     │ ┌ deck ┐ ┌ deck ┐ ┌ deck   ┐ │
│ └────────────────────────┘   │     │ └──────┘ └──────┘ └────────┘ │
│ ┌stat┐┌stat┐┌stat┐┌stat┐     │     │ ┌ deck ┐ ┌ dashed "Create" ┐ │
│ └────┘└────┘└────┘└────┘     │     │ └──────┘ └─────────────────┘ │
│ Your decks   [View all →]    │     └──────────────────────────────┘
│ ┌deck┐┌deck┐┌deck┐ (top 3)   │      grid: 1 col · sm:2 · lg:3
└──────────────────────────────┘
```

- **Dashboard data** — `useDecks()` (decks, `card_count`, `due_count`; also drives empty/error/loading) + `useAnalytics()` (streak, retention only). `useReviews` is NOT used here anymore: Due Today = Σ `deck.due_count`, the same source the badges use (no duplicate count query).
- **Hero (`ReviewHero`)** adapts to real data: cards due → "Ready to review?" + due sentence (+ streak nudge when a streak exists) + primary **Start Review**; zero due → "All caught up!" + **Generate Cards** (the useful next step) — no invented statistics.
- **Stat cards** — Due Today (primary) · Streak (warning) · Total Cards (muted) · Retention (success); icon chip = 10% token tint, label always spelled out (never color-only). Grid `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` (1 / 2×2 / 4-in-a-row). Analytics-only cards show their own skeletons while `useAnalytics` loads and `—` + a "Try again" strip (`fetchAnalytics`) if it fails.
- **Priority decks** — top 3 by `due_count` desc, then `created_at` desc (explainable, no scoring), caption says so; "View all" → `/decks`. Dashboard no longer renders `DeckList` — it has its own section; `DeckCard` is the shared piece.
- **Deck card** hierarchy: name (link) → due badge → description (`line-clamp-2`) → card count → **Open** → Delete (confirm dialog). The card body is clickable for mice but carries **no** `role`/`tabindex` — keyboard/screen-reader users use the title link and Open button (no interactive nesting); inner links `stopPropagation` so one click = one history entry. Hover/focus: `-translate-y-0.5`, shadow, `ring-primary/40` (`hover:`/`focus-within:` variants, so they override the base ring reliably).
- **Due badge** — `0 due` = neutral (`secondary`), `>0 due` = soft primary tint; the number is the message.
- **Create affordances** — `/decks`: header "New Deck" button + dashed `CreateDeckCard` tile at the end of the grid, both opening `CreateDeckDialog`; Dashboard: only inside the empty state (CTA), priority section links out via "View all".
- **States** — loading: `Skeleton`-based mocks shaped like the real content (`DashboardSkeleton`, `StatCardSkeleton`, `DeckCardSkeleton` ×6) with `sr-only role="status"` labels; empty: `EmptyState` (icon + heading + copy + CTA); error: `ErrorState` (alert role, friendly copy, raw detail small, real retry via `fetchDecks`/`fetchAnalytics`).
- **Conventions** — no new tokens; warning-colored *text* must use `text-warning-foreground dark:text-warning` (the light amber fill is only 2.9:1 as text); status info always has a text label; responsive = stock Tailwind breakpoints only (`sm` 640 / `lg` 1024 / `xl` 1280), no fixed widths.

## Review Focus Mode (Phase 4)
`/review` is the app's highest-frequency interaction and the one place that runs **without the shell** (route is a sibling of `<AppShell>` — see Phase 2 routing). Phase 4 rebuilt its presentation; `useReviews`/`fsrs.js` (queue, scheduling, submission, logs) are untouched.

```
Focus-mode viewport (h-dvh, no sidebar/bottom nav)
┌──────────────────────────────────────────────┐
│ ← Exit review                        ☾      │  header (border-b)
├──────────────────────────────────────────────┤
│              12 / 30 · 18 remaining          │  pinned (never scrolls)
│              ▓▓▓▓▓▓▓▓░░░░░░░░░░░░            │  role=progressbar
├──────────────────────────────────────────────┤
│                                              │
│   ┌──────────────────────────────────────┐   │  main: scrollable,
│   │ QUESTION              (24/32px)      │   │  centered max-w-2xl
│   │ ─────────────────────────────────    │   │  (672px ≈ 640 target)
│   │ answer (16/18px, after reveal)       │   │
│   │ Source: …                            │   │
│   └──────────────────────────────────────┘   │
│   [ Reveal Answer ]  /  Again Hard Good Easy │  below the card
│                                              │
├──────────────────────────────────────────────┤
│            ␣ Reveal · 1 Again … 4 Easy       │  footer hint (sm+ only)
└──────────────────────────────────────────────┘
   mobile: 2×2 rating grid (h-12), hint hidden, safe-area padding
```

- **Shell** (`ReviewShell`) — `h-dvh flex flex-col`: header (Exit ghost link → `/dashboard`, ThemeToggle) → optional `progress` slot pinned below the header (so progress stays visible while the card area scrolls) → `<main class="min-h-0 flex-1 overflow-y-auto overscroll-contain">` with an inner `min-h-full flex flex-col justify-center` column (`mx-auto max-w-2xl px-4 sm:px-6`, bottom padding includes `env(safe-area-inset-bottom)`) → optional `footer` slot. The shell owns the document's only `<h1>` (`sr-only`, "Review session") and the only `<main>` in focus mode.
- **Card** (`Flashcard`) — shadcn `Card` (`bg-card`, ring, `rounded-xl`, `shadow-sm`) with generous padding (`p-5/7` mobile → `px-8 py-9` sm+). Question = `text-xl sm:text-2xl` (24/32 on the fixed scale — closest steps to the 28px target), `font-semibold`, `break-words`, left-aligned so long questions wrap naturally; answer = `text-base sm:text-lg` (16/18) under a `border-t` divider with an uppercase label; `whitespace-pre-wrap` preserved; source line `text-xs`. No gradients/decoration — tokens only.
- **Reveal** — pre-reveal: question only + full-width primary **Reveal Answer** button (`h-12 sm:h-11`, `aria-keyshortcuts="Space"`) *below* the card. Post-reveal: answer block fades in (`animate-in fade-in-0 slide-in-from-bottom-1 duration-150`) and the button is replaced by the rating row. The answer never renders before reveal.
- **Progress** (`ReviewProgress`) — numeric `N / total` (+ `· remaining` on sm+, remaining = `total − position`) over a 6px bar; `role="progressbar"` with `aria-valuemin/max/now` + `aria-valuetext="Card N of total"`; fill animates via `transition-[width] duration-300` + `motion-reduce:transition-none`. Not rendered when there are zero due cards (no misleading bar).
- **Ratings** (`RatingButtons` + `src/lib/ratings.js`) — `RATINGS` is the single source (Again=1 danger · Hard=2 warning · Good=3 success · Easy=4 primary/default), also read by the shortcut hint, keyboard map and completion tally. `role="group"` + `aria-keyshortcuts="1"…"4"`; text labels always carry the meaning (never color alone). Grid: `grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3`, buttons `h-12` (48px) mobile / `sm:h-11` (44px) desktop. All four disabled while a submission is in flight.
- **Keyboard** — one `window` `keydown` listener (bound per card/reveal state, removed on cleanup): **Space** reveals only while the answer is hidden (`preventDefault` stops page scroll; skips `BUTTON`/`A` targets so a focused control activates itself exactly once); **1–4** rate only after reveal; ignored while typing (`INPUT`/`TEXTAREA`/`SELECT`/contentEditable) or with Ctrl/Meta/Alt. Ratings go through a **latest-ref mirror** (`handleRatingRef`) so the listener can never act on a stale card. Digits are `Number(e.key)`-validated (integers 1–4 only).
- **Double-submission guard** — synchronous `submittingRef` set at entry to `handleRating` (state alone would let two rapid keypresses both pass), plus `disabled` buttons during flight. On submit failure the ref/state unlock, `role="alert"` shows friendly copy + raw message, the card stays put and ratings can be retried; on success the queue advances exactly as before (`index + 1`, `revealed` resets).
- **Focus management** — advancing a card moves focus to the next question `<h2 tabindex="-1">` (only after a user rating — never on initial load, gated by `advanceFocusRef`); the heading carries an `sr-only` "Card x of y." prefix so focus announces position + question together. Finishing moves focus to the completion `<h2 tabindex="-1">`. A persistent `role="status"` sr-only region toggles "Answer shown." on reveal (region exists from first render so the text change is announced).
- **States** — loading: shell + progress/card skeletons matching the real shape, `sr-only role="status"` label, no fake data; zero due: shared `EmptyState` ("You're all caught up") + Back to dashboard (no progress bar); fetch error: shared `ErrorState` (friendly copy + raw detail + retry via `fetchDueCards`) + a safe-page link; completion: success chip + "Review complete!" + real session count + **real** per-rating tally chips (`N Again …`, zero-pick ratings omitted) + Back to dashboard / Browse decks.
- **Motion** — `tw-animate-css` only (no framer-motion: not installed, unnecessary for this). Card advance remounts on `key={card.id}` → `animate-in fade-in-0 slide-in-from-bottom-2 duration-200`; states fade in at `duration-200`; every animation is clamped to 0.01ms by the global `prefers-reduced-motion` rule in `index.css` (CSS-level, not JS) and card/bar transitions additionally carry `motion-reduce:animate-none` / `motion-reduce:transition-none`.
- **Mobile (375/390)** — full-width card inside `px-4` gutters, no horizontal scroll; reveal + ratings are ≥48px targets; shortcut footer is `hidden sm:flex` (shortcuts still work — desktop-only feature, keyboard unlikely); safe-area bottom padding prevents home-indicator clipping; progress stays pinned above the scroll area.

## Upload & Generation (Phase 5)
`/upload` is the "material → cards → save" workspace, rebuilt as a two-panel desktop layout that stacks on mobile. Only the UI changed: `ai.js generateCards`, `extract.js`, and `useCards.createCard` are untouched, and every generated card comes from the real AI response.

```
Desktop (≥1024px) — container max-w-6xl
┌──────────────────────┬────────────────────────────────┐
│ Study material       │ Generated cards           (12) │
│ deck select          │ [✓ Select all]   3 of 12 sel.  │
│ notes + char count   │ ┌ checkbox  Card 1     ✎  🗑 ┐ │
│ ┌ dropzone ────────┐ │ │ Q (font-medium)              │ │
│ │ 📄 Browse files  │ │ │ A (muted) · Source: …        │ │
│ └──────────────────┘ │ └──────────────────────────────┘ │
│ [  Generate Cards ]  │ [Add blank card]  Saving to Deck │
│                      │ [Save Selected (n)] [Save All(n)]│
└──────────────────────┴────────────────────────────────┘
  grid: 24rem + 1fr (xl: 26rem + 1fr)   mobile: single stack
```

- **Layout** — page container `mx-auto max-w-6xl px-4 py-6 sm:px-6`; page `<h2>` (top bar owns the `<h1>`); two `<section aria-labelledby>` landmarks in `lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]` (`xl:` 26rem) with `lg:items-start`. The input panel is capped so it never balloons; the preview panel takes the rest and becomes the focus after generation. Below `lg` everything stacks in workflow order: input → generate → status → cards → save.
- **Input panel** — deck `<select>` (existing native control, restyled tokens unchanged) → notes label with a live character count (`tabular-nums`, plain text so it doesn't flood screen readers) → `Textarea` (`min-h-36 max-h-60`, `field-sizing-content` grows to the cap, then scrolls) → dashed dropzone (`Browse files` button + `Supported: …` caption from `SUPPORTED_INPUTS`) → full-width primary Generate (`size="lg"`, `aria-busy`, disabled without notes/keys/while running; handler also guards re-entry). Drag-over highlights both the textarea (ring) and the dropzone (`border-primary bg-primary/5`). The dropzone is presentation over the **existing** import pipeline — same `accept`, same `extractFromFile`, same append-to-notes behavior, no second validation system. Import success/error and the no-API-key hint stay here.
- **Generation states** — the preview panel gets `aria-busy` while generating and shows `GenerationSkeleton`: a `role="status"` line ("Generating review cards…" — no fake steps or percentages; the backend reports none) plus 4 decorative (`aria-hidden`) skeleton cards mirroring the real row shape (checkbox + index chip + question/answer lines). Pulse is clamped to 0.01 ms by the global `prefers-reduced-motion` rule. On failure the notes **and any previously generated rows are kept** (only the request failed) and a `role="alert"` box shows the existing `friendlyMessage` copy with the same Settings/Retry/Try again actions.
- **Preview cards** (`GeneratedCard`) — checkbox → `Card N` (+ warning-colored "· needs question and answer" when invalid, `text-warning-foreground dark:text-warning`) → question (`font-medium`) → answer (muted) → optional source line; aria-labelled pencil Edit + trash Remove buttons (`text-destructive` hover). Selected rows get `border-primary/50 ring-1 ring-primary/20` **plus** the checkbox checkmark — state is never color-only. Long text is `break-words whitespace-pre-wrap`; empty fields show italic muted placeholders.
- **Selection & counts** — every generated row starts selected (`makeRow` seeds `selected: true`); the toolbar is a select-all `Checkbox` with an `htmlFor` label ("Select all" / "Deselect all") plus "N of M selected"; the panel-header `Badge variant="soft"` shows the generated total. Selection lives on the row objects, so removal and partial saves stay consistent automatically. Save-button labels carry counts: `Save All (12)`, `Save Selected (3)`.
- **Editing** — parent-owned draft (`editDraft = { id, question, answer, source } | null`): Edit seeds the draft; the row remounts with `key={id}::edit` (fresh validation state per session — errors can never leak between edits — and only one card edits at a time). Editor = labelled Question/Answer textareas (`min-h-16 max-h-40`, `aria-invalid` + `aria-describedby` while invalid) + optional Source input + **Save/Cancel**. Save validates (`role="alert"` "Question and answer are both required." + refocus) then commits; Cancel discards. "Add blank card" creates a row and opens it straight into edit (draft seeded to empty strings).
- **Removal & focus** — Remove is instant (local ephemeral preview — consistent with the old UX; no confirmation, no invented undo). Focus never gets lost: after Save/Cancel it returns to that card's Edit button; after removal it moves to the Edit button of the row that took the slot (via an Edit-button ref map), else the last row, else "Add blank card". Removing the row being edited also clears `editDraft`.
- **Save actions** — footer shows the destination ("Saving to **Deck**" / "Choose a deck to save these cards.") above a `flex-col sm:flex-row` button group: primary **Save All (n)** + outline **Save Selected (n)**. Save Selected is disabled at 0 valid selections with a "Select at least one card…" caption when relevant; both disable without a deck or while saving; `targets.length === 0` makes empty submissions impossible. `handleSave(mode)` filters valid rows (and `row.selected` for `mode='selected'`) and runs the unchanged sequential `createCard` loop: partial failure removes only the saved rows, keeps the rest **with their selection**, and shows `role="alert"` retry copy — no forced regeneration; full success uses the existing `role="status"` toast → navigate to `/decks/:id`.
- **Empty state** — shared `EmptyState` (Sparkles): "Your generated cards will appear here / Add study material and generate cards to get started." — shown only when there are no rows and no generation error.
- **Accessibility** — two labelled section landmarks; every icon button has an `aria-label`; the select-all checkbox is a real control with a `htmlFor` label (buttons are labelable elements); per-card checkboxes carry "Select card N" labels; generation status is `role="status"`, errors are `role="alert"`, the panel toggles `aria-busy`; DOM order = workflow order so tab order is logical; focus is managed as described above; no custom keyboard shortcuts. Text contrast verified for both themes (34-pair audit; checkbox border fixed to `foreground/50` to clear 3:1 where stock `border-input` measured 1.29/1.58).
- **Responsive** — single column below `lg`; at 375 px nothing scrolls horizontally (dropzone wraps, save buttons stack, cards are fluid); at 1024–1440 the input panel stays capped at 24/26rem while the preview grows. (Phase 8 replaced the in-page toast with the global sonner toast — see Interaction & Feedback.)
- **Conventions** — no new tokens and no framer-motion (CSS transitions + the global reduced-motion clamp); `ui/checkbox.jsx` came from the local shadcn CLI (radix monolith already present); styling is tokens-only with `bg-muted/30` for grouped footer surfaces. Phase 5 reused the then-existing inline toast (Sonner was deliberately not added at that point; Phase 8 later introduced it — see Interaction & Feedback).


## Analytics (Phase 6)
`/analytics` answers three questions on one screen — how am I doing, what's weak, what's next. Presentation-only rebuild: `useAnalytics` (queries + aggregation helpers) is untouched and every number/chart comes from the real stats it returns.

```
Container max-w-5xl (stacks to 1 column below lg)
┌──────────────────────────────────────────────┐
│ Your learning at a glance (h2) + subtitle    │
│ ┌stat────┐┌stat────┐┌stat───┐┌stat────┐      │  Retention · Total reviews
│ └────────┘└────────┘└────────┘└────────┘      │  Streak · Cards learned
│ ┌ Highlights ─────────────────────────────┐   │  chips (wrap): due today ·
│ │ [📅12 due today][🔥4-day streak][⚠ deck]│   │  streak · weak-deck callout
│ └──────────────────────────────────────────┘   │
│ ┌ Review activity (14 d) ┐┌ Cards due (7 d) ┐ │  lg: grid-cols-3
│ │ line chart             ││ bar chart        │ │  activity = col-span-2
│ │ [+12% vs previous 7 d] ││                  │ │  badge in CardAction
│ └─────────────────────────┘└──────────────────┘ │
│ ┌ Rating breakdown ─────────────────────────┐  │  75% retention + meter
│ │ 75% retention ▓▓▓▓▓▓▓▓░░░░                 │  │  + Good/Easy · Again/Hard
│ └────────────────────────────────────────────┘  │  counts legend
│ ┌ Weak topics ──────────────────────────────┐  │  rank · deck · reviews ·
│ │ 1 Algorithms ▓▓▓░░░░░░░░░░░░░ 41%  …      │  │  progressbar · %
│ │ Strongest: “Biology” — 90% accuracy.       │  │
│ └────────────────────────────────────────────┘  │
```

- **Structure** — page `<h2>` + intro (top bar owns the `<h1>`); the default export owns loading / error / no-data, and an exported `AnalyticsView({ stats })` renders every loaded state so smoke tests can render empty and full shapes in isolation.
- **Stats row** — shared `StatCard` ×4: Retention (success, Target) · Total reviews (muted, Repeat) · Streak (warning, Flame) · Cards learned (primary, Brain); same `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4` grid as Dashboard, wrapped in `<section aria-label="Key statistics">`.
- **Highlights** — short chips derived from real stats only: cards due today (`forecast[0]`), streak sentence (positive when going / nudge when 0), weakest-deck callout **only when accuracy < 60**. Icon chips use the verified tone pairs (muted / success / destructive); decorative icons are `aria-hidden`.
- **Trend badge** — `computeTrendPct(activity)` compares the last 7 activity buckets with the previous 7; rendered in the activity card's `CardAction` as `+N% vs previous 7 days` (up = success, down = warning pairing `text-warning-foreground dark:text-warning`, flat = muted). Hidden when the previous window is 0 — a percentage against zero would be noise.
- **Charts** — Recharts unchanged from Phase 5 (Bar forecast / Line activity, token-based `tooltipStyle`, `var(--chart-3)` bars, `var(--foreground)` line); `lg:grid-cols-3` puts activity at `lg:col-span-2` beside the forecast, full width below `lg`; each card keeps its own zero-data inline note.
- **Rating breakdown** — retention headline (`text-3xl`) + a single success fill over the muted track (standard meter), with `role="img"` aria-label spelling both bucket counts and a Good/Easy · Again/Hard legend. Deliberately not a two-color stacked bar: light-theme warning fill measured 2.88:1 against the track (and success-vs-warning segments only 1.94:1).
- **Weak topics (= deck performance)** — every deck with review history, weakest accuracy first: rank, name, review count, `role="progressbar"` (`aria-valuenow/min/max` + per-deck aria-label, `transition-[width] duration-300` + `motion-reduce:transition-none`), value in text (destructive below 60 — the app's existing weak convention), fill destructive/primary by the same threshold; footer "Strongest: …" when there is more than one deck. One section covers both the weak-topics and deck-performance requirements (sorted list with accuracy + review counts answers both).
- **No review history** — shared `EmptyState` ("Your analytics will appear here" + Start Review CTA) instead of zero-filled charts and stats; the due forecast still renders when non-empty (it reflects real card data, not review history) and hides when it is all zeros too.
- **No time-range filter** — the hook aggregates fixed windows (all-time totals, 14-day activity, 7-day forecast) and does not expose raw logs; adding range filtering would mean changing analytics calculations, which is out of scope (documented decision, not an oversight).
- **States** — loading: skeleton mirroring the full layout (stat cards, chips, both chart cards, breakdown, deck rows) with `aria-busy` + `sr-only role="status"`; error: shared `ErrorState` with friendly copy + real retry and **no raw error detail** (Phase 6 a11y rule); every chart/list has its own compact zero-state.
- **Accessibility / responsive** — real `<ul>` lists, decorative icons `aria-hidden`, meters/progressbars labeled, text carries every number (never color-only); 24-pair contrast audit ≥4.5:1 text / ≥3:1 fills in BOTH themes; rows and grids collapse for 375 px (stats 1-col, weak rows stack below `sm`, charts stack below `lg`).

## Authentication (Phase 7)
`/auth` is a guest-only, shell-free screen (`GuestRoute`): a centered card on `min-h-dvh` with the ThemeToggle at the top-right corner. The default export owns state, validation and the Supabase calls; an exported `AuthView({ … })` is a stateless presentational view (same pattern as `AnalyticsView`) so smoke tests can render every state in isolation.

```
┌ page: min-h-dvh, centered, px-4          (ThemeToggle absolute top-right)
│ ┌ Card (max-w-sm, entrance animation) ────────────────────────────┐
│ │        [✨ size-11 chip]   brand chip = Sidebar mark            │
│ │              FastRev — h1 (page heading, no shell here)         │
│ │   Spaced-repetition review for students  (CardDescription)      │
│ │   Welcome back / Create your account — h2 id="auth-heading"     │
│ │   Email        → label + input (h-10, name=email, autocomplete  │
│ │                  email, type=email, inline error below)         │
│ │   Password     → label + input (pr-10) + 👁 show/hide button     │
│ │                  autocomplete current-password | new-password    │
│ │                  signup hint "At least 6 characters." / error    │
│ │   ⚠ role="alert" box — friendly server error (danger/10 tint)   │
│ │   [ Sign in / Create account  ·  "Signing in…" while busy ]     │
│ │   Don't have an account?  Create account  (bottom switch link)  │
│ └──────────────────────────────────────────────────────────────────┘
confirmation (needsConfirmation) replaces the form:
│ ┌ role="status" ──────────────────────────────────────────────────┐
│ │  ✓ CircleCheck (success/10 chip) · Check your email             │
│ │  link to <span break-all>you@…</span>, then sign in             │
│ │  [ Back to sign in → switchMode('login') ]                      │
```

- **One form, two modes** — `mode: login | signup` changes only copy, `autocomplete` and validation; there is no duplicated Login/Signup markup. The former Tabs (Radix `role="tab"` without tabpanels) were replaced by a bottom secondary-action switch link (`text-primary`, `cursor-pointer`, disabled while submitting) — visually secondary to the filled submit.
- **Validation (`lib/authForm.js`)** — `noValidate` form with app-styled inline errors instead of native bubbles. `validateAuthEmail` (required + loose pattern, trimmed); `validateAuthPassword` (required; 6-char minimum **only for signup** — Supabase decides acceptability at sign-in, a client block would lock out older passwords). Submit focuses the first invalid field (`aria-invalid` + `aria-describedby` wire each error to its input); fields revalidate on keystroke only once an error exists.
- **Error mapping** — `friendlyAuthError()` turns the common Supabase messages into specific copy (invalid credentials → "Email or password is incorrect.", already registered, email not confirmed, password minimum, rate limit, unreachable server); anything unrecognized becomes a generic "Something went wrong…" so raw provider text never reaches the screen. Rendered in a `role="alert"` box.
- **Loading** — while submitting: inputs AND button disabled, `aria-busy`, LoaderCircle + "Signing in…"/"Creating account…" (the button is `w-full`, so the label swap cannot shift the layout), a synchronous `if (submitting) return` guard blocks double submits, and focus is restored to the submit button after a server error (disabling it dropped focus).
- **Confirmation** — `signUp`'s `needsConfirmation` swaps the form for the `role="status"` panel above (email-confirmation is ON by default in Supabase).
- **Mode switch** — keeps the entered email/password, clears every error state, and focuses the mode `<h2 tabIndex={-1}>` (rAF after commit) so keyboard/screen-reader users hear the change.
- **Accessibility** — real `<label htmlFor>` pairs; `autocomplete` email / current-password / new-password; `name` attributes for password managers; icon-only Eye/EyeOff toggle carries `aria-label` + `title`; decorative icons `aria-hidden`; page `<h1>` is the brand (no shell to own it); `text-base` inputs prevent iOS zoom; focus rings come from the global design-system rules; 24-pair contrast audit ≥4.5:1 text / ≥3:1 UI in BOTH themes.
- **Responsive** — `w-full max-w-sm` card in `min-h-dvh` with `px-4`: at 375 px the card fills the viewport minus padding; no fixed widths anywhere (structural check only — see AGENTS Known Risks for the manual browser pass).
- **Not implemented** (documented, not faked): password reset, social/OAuth login, remember-me — `useAuth` exposes none of these APIs.

## Interaction, Motion & Feedback (Phase 8)
One restrained system for how the app responds while work happens — motion, microinteractions, loading states and toasts. Presentation only: no page structures, data flows, keyboard shortcuts, forms/validation or FSRS logic changed.

```
Feedback channel matrix (what reports what)
validation  → inline field errors (auth, card editor)          [unchanged]
failure     → role="alert" panel with actions (generate/save/  [unchanged]
              load errors, ErrorState)
progress    → role="status" text + skeleton shapes             [DeckDetail gained one]
confirm     → sonner toast: 6 success + 2 delete-failure error [new channel]
navigate    → keyed fade of the new page (AppShell routes)     [new]
```

### Toasts — sonner 2.0.8 (the one new dependency)
- **Why sonner, not framer-motion:** the phase brief allowed either if genuinely needed. Sonner was installed (production-quality live-region a11y, swappable styling, tiny); framer-motion was **deliberately skipped** — CSS animations + tw-animate-css + the global reduced-motion clamp already cover every motion this plan needs, and installing an animation library for three fades would violate the project's minimal-dependency habit.
- **SSR/CSS facts:** sonner auto-injects its stylesheet at runtime (guarded for `document`, so it is SSR-safe and its CSS never enters our bundle — built-CSS checks cover only our own utilities).
- **Single host** — `<Toaster>` in `main.jsx` (inside AuthProvider, after `<App/>`): `position="bottom-center"`, `offset={{ bottom: '5rem' }}` **and** `mobileOffset={{ bottom: '5rem' }}` (the mobile bottom nav renders up to `lg`=1024 while sonner's own mobile breakpoint is only 600 — one value clears it everywhere). `toastOptions.unstyled: true` turns off sonner's hardcoded white/black surface so **every visual comes from tokens**: `rounded-xl border border-border bg-elevated px-4 py-3 text-sm font-medium text-foreground shadow-lg` (the popover/dialog vocabulary), plus `content`/`icon` layout classes. No `theme` prop: tokens flip with `.dark` automatically. `icons` prop supplies lucide `CircleCheck text-success` / `CircleAlert text-destructive` (both `aria-hidden`).
- **No wrapper library** — call sites import `{ toast } from 'sonner'` directly.
- **Toast policy (deliberately narrow):**

  | Site | Toast |
  | ---- | ----- |
  | CreateDeckDialog | success `Deck “Name” created` |
  | DeckCard delete | success `Deck “Name” deleted` · error `Couldn’t delete “Name” — try again.` |
  | DeckDetail card CRUD | success `Card added` / `Card updated` / `Card deleted` · error `Couldn’t delete that card — try again.` |
  | Upload save | success `12 cards saved to Deck` (fired **before** the 1 s redirect so it survives navigation — the old in-page toast died with the route) |

  Only the **two delete failures** get error toasts (point-of-action; there is no inline channel for a background delete). Everything else that can fail already has a `role="alert"` panel with retry actions — adding toasts there would stack duplicate notifications. Validation errors stay inline; Settings save keeps its existing "Saved ✓"; review completion keeps its dedicated screen; import/generate/save failures keep their action panels.
- **Toast a11y:** sonner v2 mounts a persistent `aria-live="polite"` region (`aria-label="Notifications alt+T"`, present even when empty, so the first toast is announced). Alt+T focuses it — a modifier combo, so the Review key guard (which ignores Alt) is unaffected. Sonner's stock focus outline is black-alpha (invisible on dark toasts); `index.css` overrides it with a doubled-attribute rule — `[data-sonner-toast][data-sonner-toast]:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px }` — whose specificity beats sonner's runtime-injected stylesheet without `!important`.

### Loading states & skeletons
- **`LoadingButton` (new component)** — the extracted version of Auth's canonical pattern: while `loading` it is disabled (blocks double submits), sets `aria-busy`, dims via Button's `data-[loading=true]` styles, and swaps its label for a `LoaderCircle` + mode-specific `loadingLabel` ("Creating…", "Adding…", "Saving…", "Importing…", "Generating…"). Used at 7 submits across CreateDeckDialog, DeckDetail (add/save) and Upload (import/generate/save-all/save-selected). Auth.jsx deliberately untouched (its markup is asserted by Phase 7's smoke).
- **One spinner app-wide** — `LoaderCircle` + `animate-spin motion-reduce:animate-none`. GenerationSkeleton's status-line spinner was swapped RefreshCw → LoaderCircle (RefreshCw remains only as retry-button *icons*, where it is an arrow, not a spinner). `aria-busy` also marks the Upload preview panel while generating.
- **Skeletons** — DeckDetail's "Loading …" text replacement became a real `DeckDetailSkeleton` (same `max-w-3xl` wrapper: header + button + three card-row shapes, `aria-busy`, `sr-only role="status"` "Loading deck…"), matching the established skeleton grammar (pulse clamped globally; shapes mirror the real content; never fake data).
- **No invented progress** — generation keeps its honest plain-text "Generating review cards…" status (the backend reports no percentage; fake steps are forbidden by the phase brief).

### Motion & microinteractions
- **Route transitions** — `AppShell` wraps `<Outlet/>` in `<div key={pathname} className="animate-in fade-in-0 duration-150 motion-reduce:animate-none">`: a short fade when navigation changes the page, nothing else. Focus-mode routes (`/review`, `/auth`) are outside the shell and keep their own Phase 4/7 entrance animations — no double animation.
- **Entrance fades on feedback surfaces** — `EmptyState`, `ErrorState` and StatCard's value/caption fade in (`fade-in-0 duration-200`), so skeleton→content swaps and empty/error mounts no longer pop. Dialog/dropdown open-close animations are unchanged from Phases 1–2 (`data-open:animate-in` / `data-closed:animate-out`).
- **Review untouched** — Phase 4 motion (card remount fade+slide, answer reveal, `transition-[width]` progress bar) is exactly as shipped.
- **Reduced motion, belt and suspenders** — the global `prefers-reduced-motion` rule in `index.css` clamps every animation/transition to 0.01 ms (CSS-level, works for sonner's own animations too); everything new additionally carries `motion-reduce:animate-none` so the state-specific intent is in the markup.

### Verification (Phase 8)
lint (2 pre-existing warnings only) → production build → **42/42 SSR smoke** (LoadingButton idle/busy incl. `aria-busy`/disabled/spinner, Toaster SSR-safe persistent live region, `toast.success/error` store pushes, EmptyState/ErrorState/StatCard fades, CreateDeckDialog, DeckDetailSkeleton, AppShell keyed fade, Upload without its old inline toast, Auth/Dashboard regressions) → **46-pair contrast audit** ≥4.5 text / ≥3 UI in light AND dark (toast message/icons/ring pairs included; the `--border` edge is reported as the documented known exception at 1.23/1.45) → 9 routes + 11 module transforms HTTP 200 → built CSS contains the new utilities (`fade-in-0`, `bg-elevated`, `text-success`, `motion-reduce:*`, the sonner focus rule; sonner's stylesheet is runtime-injected by design). **Not interactively browser-tested** — see AGENTS.md Known Risks.

## Final QA & Polish
App-wide audit-and-fix pass over everything shipped in UI/UX Phases 1–8: design system, typography/spacing, component consistency, accessibility, contrast, dark mode, responsive structure (375–1440), motion/feedback, per-page QA, performance, cleanup. Scope rule: **real issues only — no redesign, no functionality changes** (auth, CRUD, FSRS review + keyboard shortcuts, AI generation, analytics untouched).

### What changed
- **Control-boundary contrast (the headline fix)** — `--input` darkened in both themes (≥3:1 vs all surfaces); inputs, textareas, the deck `<select>` and outline buttons now meet WCAG 1.4.11. `--border` remains the structural hairline by design. Comments in `index.css` document the division of labor; `ui/button.jsx`'s outline variant now reads `border-input` (was `border-border` in light).
- **Type-scale compliance** — `ui/button.jsx` sm size `text-[0.8rem]` → `text-xs` (12 px floor); Analytics chart axis ticks `fontSize: 11` → `12`.
- **Cleanup** — dead `src/components/ui/tabs.jsx` deleted (no importer since Phase 7 dropped Tabs): lint drops to a single tolerated `button.jsx` fast-refresh warning.
- **ARIA gap-fills** — `role="status"` on `FullPageMessage` (route guards) and Upload's import-success caption; `role="alert"` on DeckDetail's four inline error messages and CreateDeckDialog's form error (now announced at the point of failure, matching the established alert/status matrix).
- **Semantics/landmarks** — DeckDetail's card list `<div space-y-4>` → `<ul>/<li>`; MobileMenu's nav label `Primary` → `Main` (it duplicated Sidebar + bottom bar's `Primary` — only the bottom bar keeps `Primary`).
- **Consistency** — icon sizes normalized `h-4 w-4`/`h-5 w-5` → `size-4`/`size-5` across 10 files; deck `<select>` → `text-base md:text-sm` (iOS 16 px-zoom rule, matching Input/Textarea); destructive-tint error boxes `bg-destructive/10` → `bg-destructive/5` in Auth + Review (dark `text-destructive` on `/10` was 4.46:1; `/5` passes at 5.01:1 and matches Upload/Analytics).
- **Chart accessibility** — both Analytics chart wrappers carry `role="img"` with full data-readout `aria-label`s (7-day forecast, 14-day activity).
- **Audited and deliberately left alone** — `--border` hairline (structural), stock `AlertDialogAction` primary styling (the dialog text says "Delete … cannot be undone"; red confirm buttons would be a subjective redesign), stock shadcn internals, deck-card clickable body (Phase 3 decision), per-element `motion-reduce` gaps (the global 0.01 ms clamp is the guarantee).

### Verification (Final QA)
`npm run lint` → **1 warning only** (pre-existing `button.jsx` fast-refresh) → `npm run build` ✓ (main 1,148.26 kB / CSS 63.23 kB, known 500 kB chunk warning) → **49/49 SSR smoke** (every page loading/empty/error state, AuthView ×7, LoadingButton, Toaster, chart aria-labels, `<ul>`/roles, `ui/tabs.jsx` confirmed gone) → **84-pair contrast audit: 0 failures / 2 documented INFO** (`--border` 1.29:1 light / 1.42:1 dark) in light AND dark → 9 routes + 13 module transforms HTTP 200 on the dev server → built CSS contains every new utility (`size-3.5`, `md:text-sm`, `bg-destructive/5`, …) → temp scripts deleted. **Not interactively browser-tested** (no browser tool) — see AGENTS.md Known Risks for the manual pass list.

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
4. User edits, selects, and approves cards in the preview UI (Phase 5: checkbox selection, inline editor, Save All / Save Selected).
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