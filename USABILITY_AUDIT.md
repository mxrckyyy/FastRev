# FastRev — Usability Audit (UI/UX Phase 10)

**Date:** 2026-10-06
**Method:** Full source-code inspection of the shipped app (all routes, pages, shared components, hooks, navigation, README) against the six user flows below, using Nielsen's 10 heuristics as the evaluation lens. Findings were cross-checked with the app's own conventions (design tokens, a11y rules, loading/empty/error patterns).

**Honest limitations:** no live browser or user testing was available in this environment. Every issue below is grounded in actual code (file + behavior cited). Interactive feel (tap targets in motion, animation timing, real device layouts) was **not** empirically tested — structural review only, consistent with all prior UI/UX phases. Validation performed for this pass is recorded at the end of this file.

---

## Severity levels

| Level | Definition |
| --- | --- |
| **Critical** | Blocks a core task completely; no workaround. |
| **High** | Likely data loss, duplication, or task failure under normal use. |
| **Medium** | Significant friction, error-prevention, or clarity gap; workaround exists but is error-prone or undiscoverable. |
| **Low** | Cosmetic, consistency, or polish issue. |
| **Info / Not Fixed** | Documented limitation or deliberate design decision (rationale required). |

**Result: 18 issues — 0 Critical · 1 High · 7 Medium · 6 Low · 4 Info.**
**Statuses: 12 Fixed (U-01…U-07, U-09…U-13) · 6 Not Fixed** (U-08 deferred + U-14…U-18 documented).

---

## Flow evaluation (A–F)

| # | Flow | Verdict | Issues raised |
| --- | --- | --- | --- |
| A | First-time user (sign up → first useful screen) | **Pass** | None blocking: empty Dashboard offers Create Deck as the correct first step; Upload states exactly what's missing ("No API key yet — open Settings", "No decks yet — create one first"); email-confirmation path is explained. |
| B | Create deck | **Pass after fixes** | U-02 (empty deck name from whitespace), U-09 (two names for one action), U-08 (rename advertised but missing → Not Fixed). |
| C | Add cards (manual + AI) | **Pass after fixes** | U-04 (no contextual path from a deck to AI generation), U-03 (empty card from whitespace), U-05 (dialog closes after every card). |
| D | Review session | **Pass after fixes** | U-12 (empty queue dead-ends on one button), U-15 (no undo for a mis-rating → Not Fixed, architecture). Existing: keyboard shortcuts, live-region announcements, retry on failed rating. |
| E | Error & recovery | **Pass after fixes** | U-01 (double-save duplicates cards), U-06 (deck-load failure has no alert role/retry). Existing: generation/import/save failures all have friendly copy + actions, partial saves keep unsaved rows, deletes confirm + toast. |
| F | Understand progress | **Pass after fixes** | U-10 (deck page hides its due count). Existing: Dashboard hero/stats, Analytics, due badges, streak. |

---

## Issues (prioritized)

### HIGH

**U-01 · High · `src/pages/Upload.jsx` — double-click during save duplicates cards.**
- **Problem:** after a successful save, `saving` is reset to `false` while navigation is delayed by 1 s (`setTimeout → navigate`). Both Save buttons re-enable during that window; a second click re-runs the full `createCard` loop and inserts every card again. The `if (saving) return` re-entry guard is defeated because `saving` was already cleared.
- **User impact:** silent duplicate cards in the deck; the user must find and delete each one. Reachable by an impatient double-click — normal behavior.
- **Recommendation:** keep `saving` true through the redirect on the success path (buttons spin "Saving…" for the remaining second, guard stays armed); only clear it on the failure path.
- **Status: Fixed** — success path now leaves `saving` armed until the route unmounts the page.

### MEDIUM

**U-02 · Medium · `src/components/CreateDeckDialog.jsx` — whitespace-only deck name creates an unnamed deck.**
- **Problem:** the native `required` attribute accepts `"   "`; `handleCreate` trims to `""` and inserts a deck with an empty name.
- **User impact:** an untitled, unidentifiable deck appears in every deck grid; nothing tells the user why.
- **Recommendation:** client-side trim check before submit with an inline `role="alert"` message and focus back to the field (matches the app's inline-error convention).
- **Status: Fixed.**

**U-03 · Medium · `src/pages/DeckDetail.jsx` — whitespace-only question/answer creates an empty card.**
- **Problem:** same pattern as U-02 in both `handleAdd` and `handleSave`: `required` passes `"   "`, trim yields `""`, the FSRS row is inserted anyway.
- **User impact:** an unusable blank card enters the review queue and later surfaces during reviews as garbage.
- **Recommendation:** validate trimmed values before submitting; inline `role="alert"` + refocus the question field.
- **Status: Fixed.**

**U-04 · Medium · `src/pages/DeckDetail.jsx` + `src/pages/Upload.jsx` — no contextual path from a deck to AI generation.**
- **Problem:** a user working inside a deck who wants AI-generated cards must recall that the destination is called "Upload" in the nav, navigate there, then re-find the same deck in the dropdown. The deck's empty state ("No cards yet — add your first card above") never mentions generation, although generation is the app's flagship way to fill a deck.
- **User impact:** violated recognition-over-memory (Nielsen #5); extra navigation steps; the "No decks yet" helper on Upload even points at `/dashboard` instead of `/decks`.
- **Recommendation:** add a "Generate cards" action in the deck header linking to `/upload?deck=<id>`, preselect the deck from the `?deck=` query parameter, link the empty state too, and disable Save until the target deck actually resolves (also protects stale links).
- **Status: Fixed.**

**U-05 · Medium · `src/pages/DeckDetail.jsx` — Add Card dialog closes after every save.**
- **Problem:** adding several cards means reopening the dialog each time (open → type → save → reopen × N).
- **User impact:** direct friction in the manual card-entry flow; a very common task (building a small deck by hand) is needlessly repetitive.
- **Recommendation:** keep the dialog open after a successful add, clear the fields, refocus the question, keep the "Card added" toast as confirmation; user closes via Cancel/Escape/X.
- **Status: Fixed.**

**U-06 · Medium · `src/pages/Upload.jsx` — deck-load failure is a bare red line with no retry.**
- **Problem:** `decksError` renders as an un-rolled `<p className="text-destructive">` — no `role="alert"`, no retry action, unlike every other load failure in the app (`ErrorState` with Try again).
- **User impact:** a transient network error permanently strands the Generate page with no recovery path except a full reload; screen readers may not announce it.
- **Recommendation:** `role="alert"` + an inline "Try again" button calling `fetchDecks`.
- **Status: Fixed.**

**U-07 · Medium · `src/components/DeckCard.jsx` + `src/pages/DeckDetail.jsx` — destructive confirm button looks like a primary action.**
- **Problem:** the "Delete deck" / "Delete card" confirm button renders in the default primary style (filled brand color), identical to every constructive action, so the irreversible choice is not visually distinct (Nielsen #9 guidance and the phase brief's error-prevention requirement).
- **User impact:** the most dangerous button in the app reads as "the next step" — weak signal against accidental confirms.
- **Recommendation:** render `AlertDialogAction` with the app's existing destructive variant (soft red tint + `text-destructive`), which is already contrast-verified across both themes; Cancel stays outline.
- **Status: Fixed** — implemented with the solid **`danger`** (filled) variant instead of the soft tint recommended above: the soft `destructive` tint measured 4.36:1 on the dark dialog footer (below the ≥3:1 UI minimum), while the filled variant passes in both themes and is the stronger recognition signal. Text copy still carries "cannot be undone" (meaning is never color-only).

**U-08 · Medium · README + `src/hooks/useDecks.js` — deck rename is advertised but has no UI.**
- **Problem:** README features say "create, **rename**, and delete decks" and `useDecks.updateDeck` is fully implemented — but no component calls it. There is no rename/edit affordance anywhere (DeckDetail header has only Add Card; DeckCard has Open/Delete).
- **User impact:** a user who typo'd a deck name has no way to fix it despite the docs promising one; Flow B dead-ends after creation.
- **Recommendation:** build an "Edit deck" dialog on DeckDetail calling `updateDeck`.
- **Status: Not Fixed (this phase).** Reason: doing it correctly requires shared decks state — `AppShell` owns a *separate* `useDecks()` instance for the breadcrumb, so a rename from DeckDetail would leave the breadcrumb showing the old name until a full reload; wiring a decks context is a feature/refactor, outside this phase's "targeted fixes, no new features" scope. **Follow-up for the next phase:** either build rename with a shared decks context, or drop the claim from README (README left unchanged so the next phase owns the decision).

### LOW

**U-09 · Low · `src/pages/DeckList.jsx` — one action, two names.**
- **Problem:** the header trigger says **"New Deck"** while the empty state and dashed tile say **"Create Deck"** (and the brief's canonical action label is "Create Deck").
- **Recommendation:** unify to "Create Deck".
- **Status: Fixed.**

**U-10 · Low · `src/pages/DeckDetail.jsx` — deck page hides its due count.**
- **Problem:** the header shows "N cards · description" but not how many are due, even though `deck.due_count` is already fetched and shown as a badge on deck cards.
- **Recommendation:** append "· N due" when `due_count > 0`.
- **Status: Fixed.**

**U-11 · Low · `src/pages/DeckDetail.jsx` — not-found recovery points to the wrong shelf.**
- **Problem:** "Deck not found." offers "Back to dashboard" although the page lives under the Decks section (breadcrumb `Decks / …`).
- **Recommendation:** "Back to decks" → `/decks`.
- **Status: Fixed.**

**U-12 · Low · `src/pages/Review.jsx` — empty queue dead-ends on a single button.**
- **Problem:** "You're all caught up" says "add more cards to your decks" but offers only "Back to dashboard" — no path to the thing it just suggested.
- **Recommendation:** add an outline "Generate cards" action → `/upload` (mirrors the Dashboard's caught-up hero).
- **Status: Fixed.**

**U-13 · Low · `src/pages/Dashboard.jsx` — welcome heading can clip long emails.**
- **Problem:** `Welcome, <email>` renders at `text-xl` with no wrapping; the shell's `main` clips horizontal overflow, so a long address is cut off on 375 px.
- **Recommendation:** `break-words` on the heading.
- **Status: Fixed.**

### DOCUMENTED — NOT FIXED

**U-14 · Low · `src/lib/nav.js` — nav label "Upload" vs in-page "Generate Cards".**
- **Status: Not Fixed.** "Upload" accurately names the destination (material goes in), is consistent across `NAV_ITEMS`, the top-bar title, bottom nav and all docs, and the page's own heading/CTAs already use "Generate Cards". Renaming would touch nav copy in four documents for marginal gain — deliberate non-change, not an oversight.

**U-15 · Info · Review — no undo for an accidental rating.**
- **Status: Not Fixed.** A rating immediately commits an FSRS schedule update plus a `review_logs` row (`submitReview`); reverting safely would require scheduling/log-rollback semantics the schema doesn't support. The brief forbids fake undo — so nothing was faked. Mitigations already present: rating buttons are explicit labeled controls (not hover/click-anywhere), submission is guarded against double-fires, and the progress counter makes an accidental advance visible immediately.

**U-16 · Info · `src/pages/Upload.jsx` — notes and generated rows are lost on navigation.**
- **Status: Not Fixed.** There is no draft-persistence layer; adding one (localStorage drafts, dirty-route guards) is a new feature with its own failure modes. Current behavior: navigating away discards the session, recoverable by re-importing/regenerating.

**U-17 · Info · Auth — no password reset / OAuth / remember-me.**
- **Status: Not Fixed.** `useAuth` exposes only `signIn`/`signUp`/`signOut`; Phase 7 explicitly documented these absences rather than faking them. Adding Supabase reset-email flows is a feature for a future phase.

**U-18 · Info · Deck/card mutation errors show raw Supabase messages.**
- **Status: Not Fixed.** `formError = error.message` (create deck/card) surfaces provider text. Friendly-message mapping currently exists only for auth (`authForm.js`) and AI (`ai.js`); extending it app-wide is a copy pass, not a usability defect — errors are still announced (`role="alert"`) and actionable (dialog stays open).

---

## Nielsen heuristic coverage

| Heuristic | Where it showed up |
| --- | --- |
| 1 · Visibility of system status | U-06 (silent deck-load failure); saving spinner/progress already strong elsewhere |
| 2 · Match real world | U-09 (action naming), U-11 (recovery wording) |
| 3 · User control & freedom | U-05 (dialog flow), U-15 (undo — documented absence), toast+Cancel patterns |
| 4 · Consistency & standards | U-09, U-14, U-10 (badge vs header) |
| 5 · Error prevention | **U-01, U-02, U-03, U-07** |
| 6 · Recognition over memory | **U-04**, U-12 |
| 7 · Flexibility / efficiency | U-04 (`?deck=` deep link), U-05 (batch entry) |
| 8 · Aesthetic / minimalist | No issues — prior phases already enforce the type scale and restrained layout |
| 9 · Help users recover | U-06, U-11, U-12; destructive clarity U-07 |
| 10 · Help & documentation | README accurate except U-08; in-app hints (key setup, import formats) are present |

---

## What was checked and found healthy (no action needed)

- **Flow A:** new-user empty states, API-key onboarding hint, email-confirmation panel.
- **Auth:** inline field errors, focus management, duplicate-submit guard, friendly server errors, show/hide password (Phase 7 — unchanged, re-reviewed).
- **Review:** Space/1–4 shortcuts with typing guards, live-region announcements, focus advance, `role="progressbar"`, in-flight submit guard, failed-rating retry copy, completion tally (Phase 4 — unchanged, re-reviewed).
- **Analytics:** honest empty state with CTA, accessible chart readouts, retry on failure.
- **Loading states:** skeletons mirror real layouts on every async surface (Dashboard, Decks, DeckDetail, Upload, Analytics, Review).
- **Navigation single source:** one `NAV_ITEMS` array; active state carries weight + `aria-current`, never color alone.
- **Mobile structure:** in-flow bottom nav (can't cover content), safe-area padding, `lg` single breakpoint, wrap-friendly headers.
- **Delete flows:** confirmation dialogs everywhere, toasts for outcomes, failure toasts that name the object.

---

## Validation (this pass)

Recorded after implementation — full detail in the phase entry in `AGENTS.md`:

| Check | Result |
| --- | --- |
| `npm run lint` (oxlint) | **1 warning** — pre-existing `ui/button.jsx` fast-refresh only (no new warnings) |
| `npm run build` | **Pass** (main ≈1,150.6 kB / CSS ≈63.44 kB; known >500 kB chunk warning) |
| SSR smoke (temp `ssr-smoke.mjs`, deleted after run) | **49/49 checks** — `?deck` preselect probe + source assertions, `handleSave` save-guard source checks, both trim-validation strings, empty-queue "Generate cards", solid-`danger` delete confirms, plus every changed surface's loading/error/empty regression states |
| Contrast audit (temp `contrast-audit.mjs`, deleted after run) | **102 checks / 0 failures** (≥4.5:1 text · ≥3:1 UI, light AND dark) + 6 documented INFO entries (the `--border` structural hairline in both themes; tint fills/skeletons excluded as non-boundaries) — includes the new solid-`danger` `AlertDialogAction` on the dialog footer (U-07) |
| Dev-server HTTP 200 | **9 routes** (`/auth`, `/dashboard`, `/decks`, `/decks/abc`, `/upload`, `/analytics`, `/settings`, `/review`, `/`) + **8 module transforms** (Upload, DeckDetail, DeckList, Dashboard, Review, CreateDeckDialog, DeckCard, App) |
| Built CSS contains every touched utility | **Present** — `break-words`, `underline-offset-4`, `bg-danger`, `bg-destructive\/10`, `hover\:bg-danger\/85`, `text-danger`, `border-danger`, `ring-danger` (checked against `dist/assets/index-*.css`) |

**Not verified by machine:** interactive browser behavior (double-save guard under a slow request, live `?deck` deep link with real deck IDs, focus return after batch card entry, keyboard/AT announcements, visual weight of the `danger` confirms in both themes, live Supabase data) — see the Phase 10 manual-pass list in `AGENTS.md` → Known Risks. No checks were run that cannot be honestly reported; nothing in this document claims a fix was browser-tested.
