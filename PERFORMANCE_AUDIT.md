# PERFORMANCE_AUDIT.md — FastRev (Phase 11)

**Date:** 2026-10-06
**Role:** performance audit + targeted optimization (evidence-based, no blind tuning).
**Constraint:** no functionality/UI changes, no security changes, Tailwind v4 stays the only styling system.

---

## 1. Environment & method

- **Build:** `vite build` (Vite 8.3.2, rolldown-based), production output in `dist/`.
- **Lighthouse:** real runs via Lighthouse CLI (installed in a temp dir, not a project
  dependency) against `vite preview` on `http://localhost:4173/`, headless Chrome
  (system Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`),
  default **mobile emulation** (Moto G Power, simulated slow-4G throttling, 4× CPU).
  Categories: performance, accessibility, best-practices, seo.
- **Not available in this environment:** field data / CrUX (app is not at a public URL
  with traffic), so all numbers are **lab** numbers. No score below is fabricated —
  every value is read from a stored Lighthouse JSON result of an actual run.

---

## 2. Baseline (BEFORE optimization)

Measured on the pre-optimization production build (`index-C8-PD3GS.js`, 1,150.61 kB).

| Category | Score |
| --- | --- |
| **Performance** | **88** |
| **Accessibility** | **98** |
| **Best Practices** | **100** |
| **SEO** | **82** |

| Metric (lab, mobile emulated + throttled) | Value |
| --- | --- |
| First Contentful Paint | 2.9 s (score 0.54) |
| Largest Contentful Paint | 3.2 s (score 0.73) |
| Total Blocking Time | 40 ms (score 1.00) |
| Cumulative Layout Shift | **0** (score 1.00) |
| Speed Index | 2.9 s (score 0.95) |
| Time to Interactive | 3.3 s (score 0.94) |
| Total byte weight (initial) | 387 KiB |
| Main-thread work | 0.7 s · Script bootup 0.2 s |

**Build output (baseline):**

| Asset | Size | Gzip |
| --- | --- | --- |
| `index.js` (**everything in one chunk**) | **1,150.61 kB** | 334.95 kB |
| `pdf.js` (lazy, on PDF import only) | 488.17 kB | 148.19 kB |
| `lib.js` (mammoth, lazy, on .docx import only) | 308.09 kB | 95.09 kB |
| `pdf.worker.min.mjs` (lazy, on PDF import only) | 1,321.30 kB | — |
| `index.css` | 63.49 kB | 11.31 kB |
| Inter woff2 subsets (latin / latin-ext / cyrillic / greek / …) | 48–85 kB each, unicode-range gated | — |

**Failing audits at baseline:**

- Accessibility (weight 3): `Document does not have a main landmark` — the settled
  landing screen (`/auth`) renders a full-screen `<div>`, not `<main>`.
- SEO (weight 1 each): `Document does not have a meta description`, `robots.txt is not valid`
  (no `/robots.txt` file at all).
- Performance opportunity: `unused JavaScript — est. savings of 235 KiB` (single chunk
  ships recharts + every route to every visitor, including `/auth` visitors who never
  open Analytics).

---

## 3. Findings → actions

| ID | Sev | Finding (evidence) | Action | Status |
| --- | --- | --- | --- | --- |
| **P-01** | High | **No route-level code splitting.** `App.jsx` eagerly imports all 9 pages → one 1,150.61 kB chunk; Lighthouse: "unused JavaScript, est. savings 235 KiB"; FCP 2.9 s / LCP 3.2 s under mobile throttling. recharts ships to first paint even though only `/analytics` uses it. | `React.lazy` for every non-critical route (Analytics incl. recharts, Upload, SettingsPage, Decks, DeckDetail, Review); Auth + Dashboard + AppShell stay eager (first-paint critical); `Suspense` boundary **inside** AppShell's outlet so the chrome never unmounts (no CLS), plus a focus-mode boundary for `/review`. | Fixed |
| **P-02** | Medium | **SEO 82:** no `meta description`; no `/robots.txt`. | Truthful generic description added to `index.html`; minimal valid `public/robots.txt` (nothing private is server-rendered — crawlers only ever see the static shell; noindex judged unnecessary complexity per brief §22). | Fixed |
| **P-03** | Medium | **A11y 98:** no `main` landmark on the settled `/auth` screen (and none during the auth-loading flash). | `AuthView`'s two full-screen wrappers and `FullPageMessage` become `<main>` (same classes; shell routes already own AppShell's single `<main>` — the alternatives never coexist). | Fixed |
| **P-04** | Medium | **Duplicate requests:** `AppShell` and the mounted page each call `useDecks()` → the same 2 Supabase queries fire twice concurrently on every shell page load (4 requests where 2 suffice). | Shared **in-flight** promise inside `useDecks.fetchDecks`: concurrent callers join one request. Results are **not** cached — later mounts still refetch, so staleness/mutation semantics are unchanged. | Fixed |
| **P-05** | Info | Fonts: full Inter Variable via `@fontsource-variable/inter`; unicode-range subsets mean only `latin` (48 kB) downloads for this UI; `font-display: swap` (fontsource default); measured CLS = 0. | Verified healthy — **no change** (adding preload would need hashed-filename plumbing for ~0 gain). | Not Fixed (healthy) |
| **P-06** | Info | Heavy parsers (pdf.js 488 kB, worker 1.3 MB, mammoth 308 kB) already behind dynamic `import()` in `extract.js`. | Verified healthy — no change. | Not Fixed (healthy) |
| **P-07** | Info | Images: only `public/favicon.svg` (SVG, tiny); no raster assets anywhere. | Nothing to optimize. | Not Fixed (healthy) |
| **P-08** | Info | Charts: recharts default mount animation over ≤14 data points in fixed-height (`h-56`) containers; uses transform/opacity-ish SVG motion, runs once. | Left as-is — disabling would not move any lab metric (evidence: TBT 40 ms, bootup 0.2 s). Documented decision, not an oversight. | Not Fixed (by design) |
| **P-09** | Info | Dashboard renders 2 stats (streak + retention) from `useAnalytics`, which fetches all review rows — but streak/retention inherently need every row; only the deck-name embed is extra, and it is one small joined field. | No change (a lighter query would mean hook API duplication for negligible bytes). | Not Fixed |
| **P-10** | Info | Review rating = 3 sequential round trips (stale-guard read → FSRS update → log insert). Order is load-bearing (log only after a successful update; re-read guards stale schedules). | No change this phase — combining update+insert needs a Supabase RPC (schema change, out of scope). Documented as future work. | Needs Future Work |
| **P-11** | Info | Render-blocking: one bundled `index.css` (63 kB / 11 kB gzip) — inherent to a Vite SPA, and the tokens must be present before paint to avoid CLS. | No change. | Not Fixed (by design) |
| **P-12** | Info | Production source maps absent (Lighthouse surfaces "missing source maps for large first-party JS" as an unweighted diagnostic; Best Practices still scored 100). | No change — maps would add build output/serve cost for zero runtime gain. | Not Fixed |

---

## 4. Optimizations implemented (this pass)

1. **Route-level code splitting** — `src/App.jsx` lazy imports + `src/components/RouteFallback.jsx`
   (spinner, `role="status"`, sr-only label, reduced-motion aware); `AppShell` wraps its
   `<Outlet/>` in a `Suspense` boundary inside the keyed fade div (chrome stays mounted);
   `/review` gets its own boundary with the full-page loading message.
2. **Request dedupe** — `src/hooks/useDecks.js` shares one in-flight promise (keyed by
   user id) per concurrent fetch wave; per-instance state/refresh behavior unchanged.
3. **SEO basics** — `index.html` meta description; `public/robots.txt`.
4. **Landmark fix** — `AuthView` (both variants) + `FullPageMessage` use `<main>`.

---

## 5. Results (AFTER optimization)

Second real Lighthouse run, same method/emulation as the baseline, against the
optimized `dist/` via `vite preview`.

| Category | Before | After | Target |
| --- | --- | --- | --- |
| **Performance** | 88 | **94** | 90+ ✅ |
| **Accessibility** | 98 | **100** | 90+ ✅ |
| **Best Practices** | 100 | **100** | 90+ ✅ |
| **SEO** | 82 | **100** | 90+ ✅ |

| Metric (lab) | Before | After |
| --- | --- | --- |
| First Contentful Paint | 2.9 s | **2.3 s** |
| Largest Contentful Paint | 3.2 s | **2.6 s** |
| Total Blocking Time | 40 ms | **10 ms** |
| Cumulative Layout Shift | 0 | **0** |
| Speed Index | 2.9 s | **2.3 s** |
| Time to Interactive | 3.3 s | **2.6 s** |

No weighted audit fails in any category after the run (the "unused JavaScript"
opportunity that was worth 235 KiB no longer surfaces).

**Bundle comparison (production build):**

| Chunk | Before | After |
| --- | --- | --- |
| Initial `index.js` | **1,150.61 kB** (gzip 334.95) | **657.37 kB** (gzip 192.25) — **−43% raw / −43% gzip** |
| `Analytics.js` (recharts + analytics page) | in main | 387.04 kB (gzip 110.83), lazy |
| `Upload.js` / `Review.js` / `DeckDetail.js` / `Decks.js` / `SettingsPage.js` + `Settings.js` | in main | 0.48–26.06 kB each, lazy |
| `pdf.js` / `lib.js` (mammoth) / pdf worker | lazy | unchanged (already lazy) |
| `index.css` | 63.49 kB | 63.52 kB (+meta only) |

**Files changed:** `src/App.jsx`, `src/components/AppShell.jsx`,
`src/components/RouteFallback.jsx` (new), `src/hooks/useDecks.js`,
`src/pages/Auth.jsx`, `index.html`, `public/robots.txt` (new).

**Validation:** oxlint → 1 pre-existing warning only · `vite build` ✓ ·
**27/27 temp SSR smoke** (AuthView `<main>` ×2, auth-gate `<main>`, RouteFallback
roles, all 6 lazy page modules load, eager/lazy split assertions, useDecks dedupe
wiring, dist meta description + robots.txt) · dev server **10 routes + 5 modules
HTTP 200** · temp scripts/logs deleted. Lighthouse JSONs for both runs stored
outside the repo (temp dir) as the source of the scores above.

---

## 6. What was NOT changed (and why)

- **Fonts** (P-05): subset splitting + swap already correct; CLS 0 proves it.
- **Chart animations** (P-08): ≤14-point datasets, TBT was already 40 ms — disabling
  would be optimization theater, not a measurable win.
- **`submitReview` round trips** (P-10): ordering is load-bearing (stale-guard read →
  FSRS update → log insert). Combining them needs a Supabase RPC = schema change →
  out of scope, documented as future work.
- **Analytics payload** (P-09): streak/retention genuinely need every review row;
  a second lighter query path would duplicate hook logic for ~a few KB.
- **No source maps** (P-12), **one render-blocking CSS file** (P-11): deliberate,
  by design, zero runtime benefit to change.
- **No dependency was removed** — every package in `package.json` was verified in
  use (directly or via the shadcn/radix chain).

## 7. Remaining issues / future work

- **Logged-in lazy-route navigation has not been exercised in a real browser**
  (no credentials in this environment — `.env` falls back to placeholders). The
  Suspense/chunk pattern is standard React and every module verified via dev
  transform + SSR, but one manual pass (log in → click through Decks/Upload/
  Analytics/Settings/Review and confirm no blank flash) belongs with the existing
  manual-pass list.
- **Lab-only numbers:** no CrUX/field data. Scores will vary with real networks.
- **Future candidates (not justified today):** RPC to merge the review write
  path (P-10); lazy `Dashboard` if the initial chunk must shrink further;
  `modulepreload` hints for the two most-likely next routes if navigation jank
  is ever observed.

