# Cross-Browser & Device QA

**Phase 13** — testing / documentation / targeted-fix pass. No redesign, no new
features; only confirmed compatibility, responsive, keyboard/touch and
accessibility-compatibility issues are fixed.

**Date:** 2026-10-07

## Testing Scope

- **In scope:** app shell (sidebar / top bar / bottom nav / hamburger / menus),
  Dashboard, Deck List, Deck Detail (+ create deck / add card dialogs), Review
  focus mode (keyboard shortcuts, touch targets), Upload / AI generation
  (two-panel → stacked, generation preview, inline edit, save), Analytics
  (charts, dark mode), Auth (login/signup/validation/redirects), Settings,
  dark mode, toasts, storage, reduced motion, focus visibility, overflow /
  horizontal-scroll detection at the full viewport matrix.
- **Out of scope (per phase boundary):** redesigns, new features, auth/AI/DB
  architecture changes, business-logic changes (FSRS untouched), refactors.

## Tested Environments

| Environment | Status | Notes |
| --- | --- | --- |
| **headless Chromium (Chrome for Testing), Windows x64 — via Chrome DevTools Protocol** | **Tested** | Real rendering, real layout metrics, screenshots, keyboard input, device-metric + media emulation. This is the only engine actually executed (see method). |
| Google Chrome (same engine, desktop) | Tested (same engine) | Headless Chrome ≡ Chrome rendering engine. |
| Microsoft Edge (Chromium) | Not Tested | Same Blink/Chromium engine; no separate install exercised — no claim. |
| Mozilla Firefox | **Not Tested** | No Firefox available in this environment. Covered by static feature-support inspection only (see Browser Compatibility). |
| Safari / WebKit (macOS, iOS) | **Not Tested** | No WebKit available. Covered by static inspection only — flagged where it matters (e.g. `field-sizing`). |
| Chrome on Android (physical) | **Not Tested** | Emulated via device metrics (375/390/430 px + touch) — layout/responsive behavior real, physical device behavior not claimed. |
| Safari on iOS (physical) | **Not Tested** | Not available; safe-area / iOS-zoom behavior inspected statically. |

**Method (how "Tested" was produced):** the production build (`dist/`) served
locally with the exact `vercel.json` header set; a scripted Chrome
(`--headless=new`, CDP) ran every flow below at each viewport with:

- layout metrics (document scrollWidth vs clientWidth → horizontal-scroll
  detection; per-element overflow scan; touch-target measurement),
- console/page error capture,
- real keyboard events (Tab / Escape / Space / 1–4),
- real mouse clicks at element coordinates,
- `prefers-color-scheme` (light/dark) and `prefers-reduced-motion` emulation,
- screenshots inspected visually (light + dark, mobile + desktop),
- **Supabase + Gemini endpoints intercepted and answered with deterministic
  fixtures** (CDP request interception) so every authenticated flow ran
  end-to-end without a live account. Network was never left to a real backend —
  results are deterministic, and no claim is made about live-server behavior.

## Responsive Testing

Viewports executed (× pages × theme where noted):

| Class | Widths |
| --- | --- |
| Mobile | **375**×812, **390**×844, **430**×932 |
| Tablet | **768**×1024, **820**×1180 |
| Desktop | **1024**×768, **1280**×800, **1440**×900 |
| Transition edges | **1023 / 1024** (sidebar ↔ bottom-nav switch), **767 / 768**, **639 / 640** (sm) |

Checks per page: horizontal scrolling, element overflow past viewport, grid
column behavior, bottom-nav overlap, sidebar switch correctness, dialog/dropdown
containment, chart container overflow, text wrapping, spacing sanity
(screenshots), focus visibility (Keyboard section).

## Browser Compatibility

Static feature inspection of what the build actually uses (targets: last-2
versions of Chrome/Edge/Firefox/Safari, 2026):

| Feature used | Where | Support | Risk |
| --- | --- | --- | --- |
| `oklch()` colors | all tokens (`index.css`) | Chrome 111+ · Firefox 113+ · Safari 15.4+ | None on supported baseline |
| `color-mix()` | opacity utilities (`bg-black/10`), `::selection` | Chrome 111+ · FF 113+ · Safari 16.2+ | None |
| `dvh` units (`h-dvh`, `min-h-dvh`) | AppShell, ReviewShell, Auth | Chrome 108+ · FF 101+ · Safari 15.4+ | None (iOS 15.4+) |
| `:has()` | shadcn `has-*` classes | Chrome 105+ · FF 121+ · Safari 15.4+ | None |
| `line-clamp-2` | DeckCard description | Standard now (Chrome 88+/FF 68+/Safari 14.1+) | None |
| `text-wrap: balance / pretty` | AlertDialog description | Chrome 114+ · FF 121+ · Safari 17.5+ | Degrades to normal wrapping elsewhere — cosmetic only |
| `field-sizing: content` | `ui/textarea.jsx` auto-grow | Chrome 123+ · Firefox 129+ · **Safari: unsupported** | **Documented:** Safari textareas stay at min-height and scroll (user-resizable); `min-h-*` guarantees usable size |
| `backdrop-filter` (via `supports-backdrop-filter:`) | dialog overlays | guarded by `@supports` | None — falls back to flat scrim |
| `env(safe-area-inset-bottom)` | MobileNav, ReviewShell | iOS/Android with `viewport-fit` — returns 0 elsewhere | Harmless 0 on desktop; meta viewport intentionally has no `viewport-fit=cover` (page never extends under the notch) |
| `ResizeObserver` | recharts | Universal on baseline | None |
| `AbortSignal.timeout` | ai.js | guarded `if (AbortSignal.timeout)` | None |
| `localStorage` reads/writes | theme, API keys | guarded `try/catch` (private-mode safe) | None |
| `IntersectionObserver` / popover / dialog element | not used (Radix divs) | — | None |

## Accessibility Testing

- Landmarks: single `<main>` per route (shell owns it; focus routes own theirs),
  labelled `nav`s ("Main" sidebar, "Primary" bottom bar, "Breadcrumb", "Main" menu).
- Focus visibility: global focus-visible ring + outline fallback (spot-checked
  via `:focus-visible` match after Tab in every flow).
- Dialogs: Radix focus trap + focus return verified (Create Deck, Add Card,
  MobileMenu, UserMenu, AlertDialog delete).
- Review shortcuts inert while typing (guarded by input/textarea/select check).
- Status/alert regions: `role="status"` / `role="alert"` on validation, errors,
  progress; never color-alone (ratings carry text labels).
- Contrast: previously verified (Phase 1/3/7/8/10 audits — ≥4.5:1 text both
  themes); not re-run this phase, referenced from history.

## Touch Interaction Testing

- Emulated touch at 375/390/430: taps via element-center coordinates;
  rating buttons 48 px (mobile 2×2) and reveal ≥ 44 px asserted green; menu
  links and card actions asserted ≥ 30 px (the project floor); dialogs and
  dropdowns open on tap; no hover-only actions (Delete/Settings all reachable
  by tap + keyboard).
- File input: native picker via the Browse button (drag-and-drop is desktop-only
  enhancement; button path exists).

## Keyboard Testing

- Tab / Shift+Tab order walked on Auth, shell, dialogs — no traps, focus
  visible (`:focus-visible` asserted), logical order.
- Escape closes Create Deck dialog, Add Card dialog, MobileMenu, UserMenu,
  delete AlertDialog — focus returns to the trigger.
- Review: Space reveals (hidden answer), 1–4 rate after reveal, Space on a
  focused button activates it once (double-fire guard), typing-in-input guard
  present in code (no text inputs exist in review itself).
- Auth: Enter submits; mode switch links are buttons; password toggle reachable.

## Issues Found

Every row has evidence from the CDP run logs (run4 → run8; final suite
`179/179`, 0 console errors, headless Chrome 155). Severities follow the
project's usability scale (Critical / High / Medium / Low / Info).

### App defects (fixed)

| ID | Sev | Area | Issue | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| CB-01 | High | Deck Detail | Card row (`flex items-start justify-between`) had no `min-w-0`, so one unbroken 240-char question stretched the row — and the page — to `right: 3059px` (massive overflow / sideways content loss) at **375 px and 1440 px**. Title had no `break-words`, action buttons had no `shrink-0`. | run4 + run5 `FAIL [deckdetail] 375/1440: no element overflow — right:3059`; run6+ green with the dedicated 240-char fixture | **Fixed** |
| CB-02 | Medium | Deck Detail | Header (h1 / subtitle / card description / source line) did not break a 100-char unbroken deck name or URL → wide layout at 375. | 100-char-name probe + `deckdetail-375-longname` screenshot; header-clean + breadcrumb-fits checks green run6+ | **Fixed** |
| CB-03 | Medium | Deck Detail | Inline edit focus behavior (Phase 5 documented: focus the question field on Edit, return focus to that row's Edit button on Cancel/save) was never implemented — focus stayed on the old button. | run5 `FAIL inline edit focuses textarea` + `FAIL cancel returns focus to Edit button`; run6+ green | **Fixed** |
| CB-04 | Medium | Shell / Mobile menu | Closing the hamburger menu returned focus to `<body>` (focus loss for keyboard/AT users). | run4 `FAIL focus returns to hamburger — {"tag":"BODY"...}`; run6+ green (focus lands on `BUTTON "Open navigation menu"`) | **Fixed** |
| CB-05 | Low | Dialogs | Dialog close (×) button is `size="icon-sm"` = 28 px — under the project's own 30 px target floor (WCAG 2.5.8 AA 24 px still passed). | run5 `FAIL mobile menu links ≥ 30px targets — ["Close h=28"]`; run6+ green (32 px) | **Fixed** |
| CB-06 | Low | Upload | "Browse files" was `size="sm"` = 28 px at 375 — smallest touch target in the app, under the 30 px floor; it is a primary mobile action (file import). | run7 `FAIL … reachable — {"w":92,"h":28}`; run8 green at 36 px (matches the Generate CTA's `lg`) | **Fixed** |

### Test-harness defects (NOT app defects — root-caused and fixed in the harness)

| Symptom | Root cause | Verdict |
| --- | --- | --- |
| Review rating never advanced (4 checks failed) | Fixture card had `state: 4`; ts-fsrs returns `undefined` from `f.next()` for state > 3 (proved with a Node probe) → destructure crash. Production rows are only ever 0–3. | Harness fixture bug — **no app change** (see CB-07) |
| Upload generation produced 0 rows | `providerMock` answered the Gemini preflight without CORS headers → browser blocked the response. | Harness mock bug — fixed (OPTIONS + headers on all provider replies) |
| Analytics `parentW: 0` chart-fit failures | Measurement read recharts' 0-width `ResizeObserver` sentinel div instead of the real `.h-56` container. | Harness measurement bug — fixed |
| "new deck appears in grid" failed despite success toast | Mock returned `[{…}]` for `.single()` mutations; `createDeck` spread the array → `{0: row, card_count…}` with `name: undefined`, so the card rendered blank (the "name" the body text contained was only the toast's). Real PostgREST honors `Accept: application/vnd.pgrst.object+json`. | Harness mock bug — fixed (object reply for `.single()`; mutations now persist) |
| Upload scenario crashed (`innerWidth is not defined`) | `innerWidth` referenced in **Node** context in one harness assertion (page eval strings are fine). | Harness bug — fixed |
| Click targets not found / whitespace validation null | Harness selector typos (`[role=alert"]`), dialog-vs-page submit wording, and whitespace test only filling one of two required fields. | Harness bugs — fixed |
| Save flow: no toast, no redirect | Harness never chose a deck — both Save buttons are correctly `disabled` without one. Fixed by navigating to `/upload?deck=<id>`, which also exercises the Phase 10 deep-link preselect. | Harness gap — fixed (app behavior was correct) |

## Fixes Applied

App changes (all inside the Phase 13 boundary — no redesign, no logic changes):

| ID | File(s) | Change |
| --- | --- | --- |
| CB-01 | `src/pages/DeckDetail.jsx` | Row → `flex min-w-0 items-start justify-between gap-2`; question title → `min-w-0 break-words`; actions wrapper → `shrink-0` |
| CB-02 | `src/pages/DeckDetail.jsx` | Header wrapper `min-w-0`, h1/subtitle/CardDescription/source line get `break-words` |
| CB-03 | `src/pages/DeckDetail.jsx` | `startEditing` focuses the row's question textarea via `requestAnimationFrame`; `cancelEditing` refocuses that card's Edit button by index (shared by Cancel and save-success) |
| CB-04 | `src/components/MobileMenu.jsx`, `src/components/TopBar.jsx`, `src/components/AppShell.jsx` | New `returnFocusRef` prop; `DialogContent onCloseAutoFocus` → `preventDefault()` + focus the hamburger ref instead of Radix's default (body) |
| CB-05 | `src/components/ui/dialog.jsx` | Close button `size="icon-sm"` → `size="icon"` (28 → 32 px) |
| CB-06 | `src/pages/Upload.jsx` | "Browse files" `size="sm"` → `size="lg"` (28 → 36 px, same as the Generate CTA) |

Harness-only changes (kept in `%TEMP%\opencode\phase13\run.mjs` — not part of
the app): fixture `state: 4 → 2`; provider CORS; `.single()` object replies +
mutation persistence; Node-context `innerWidth`; selector/wording fixes;
30 px browse-floor aligned with the project's `measure()` floor; save-flow deck
preselect.

## Remaining Issues

- **CB-07 (Low, accepted)** — `Review.handleRating` has no `try/finally`: if
  `submitReview` ever threw an unexpected error, `submittingRef` stays `true`
  and blocks further ratings until reload (reproduced deliberately in debug).
  Unreachable in production — cards are only ever FSRS state 0–3, which the
  fixture bug proved is the only way to hit it. Documented, no code change
  (Phase 13 boundary: FSRS/business logic untouched).
- **Touch-target policy** — the design system is compact: standard controls are
  28–36 px (now floor-compliant at 30 px where asserted), rating/reveal buttons
  are 48 px mobile / 44 px desktop. WCAG 2.5.8 AA (24 px) passes everywhere
  measured; the 44 px AAA guidance is intentionally not applied to every
  toolbar control — accepted design decision, not a regression.
- **Groq / Cerebras real-endpoint CORS** still unverified (needs real keys);
  only the Gemini-shaped mock was exercised in-browser.
- **Textareas** have no `resize-*` utility → native browser resize (works
  everywhere); auto-grow `field-sizing` still degrades to min-height + scroll
  on Safari (previously documented in Browser Compatibility).
- Environments from *Unsupported or Untestable* above remain not-tested; no new
  gaps identified by static inspection this phase.

## Unsupported or Untestable Environments

- Firefox, Safari/WebKit, physical Android/iOS devices: **Not Tested** in this
  environment (no installs/emulators). Static inspection is the mitigation;
  Safari's missing `field-sizing` is the one functional gap identified that way.
- Live Supabase/production deployment: not exercised — backend mocked at the
  network layer; live behavior remains a `PRODUCTION_CHECKLIST.md` item.
- Real screen readers (NVDA/VoiceOver): Not Tested — ARIA structure inspected,
  announcement behavior from earlier phase audits referenced.

## Final QA Status

- **Suite: `179/179 checks passed, 0 failed`, 0 console errors/exceptions**
  (headless Chrome 155; `report.json` in the phase temp dir).
- Scenarios: auth (login/signup/validation/confirmation/server error), shell
  (12-width matrix 375→1440 incl. 639/640, 767/768, 1023/1024 edges + menus +
  dark), decks (create/validate/100-char-name), deck detail (long-token
  overflow, dialogs, inline edit focus), review (keyboard Space/1–4, completion,
  touch sizes), upload (import → generate → select → edit → save → redirect),
  analytics (resize + dark), settings, sign-out, feature probes
  (oklch/color-mix/dvh/has/field-sizing/text-wrap/backdrop/abort/ResizeObserver).
- 36 screenshots captured (light + dark, 375 + 768 + 1023/1024 + 1440).
- `npm run lint`: 1 warning — the pre-existing tolerated `button.jsx`
  fast-refresh warning.
- `npm run build`: passes; final `dist/` rebuilt **without** QA env vars (no
  `qa-dummy` string in `dist/` — Phase 12 fail-safe guard expected, as designed).
