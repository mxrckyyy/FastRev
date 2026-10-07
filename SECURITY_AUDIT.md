# SECURITY_AUDIT.md — FastRev (Phase 12)

Security & production-readiness audit of the Student Review System (FastRev).

- **Date:** 2026-10-07
- **Method:** static inspection of the real code, schema files, build output, git
  history and dependency graph, plus practical local tests (lint, production
  build, secret scan of `dist/`, security-header/CSP test against the built app
  in headless Chrome, `npm audit`). No destructive testing against external
  systems; no credentials were available in this environment (see SEC-05).
- **Architecture under review:** static React SPA (Vite) on Vercel — **no
  application server, no route handlers, no server actions, no middleware**.
  All data access goes through Supabase PostgREST/Auth from the browser with
  the public anon key, and AI calls go direct from the browser to
  Gemini/Groq/Cerebras with API keys the user supplies. Therefore the real
  security boundaries are: **(1) Supabase RLS**, **(2) client-side route
  guards**, **(3) input validation in the client + constraints in the
  database**, **(4) browser-side secret hygiene (localStorage keys, CSP)**.
- **Honesty rule:** statuses in this document reflect what was actually
  verified here. Items that could not be executed in this environment are
  marked *Needs Future Work* with exact verification steps.

Severity scale: Critical / High / Medium / Low / Informational.

---

## Summary

| ID | Finding | Severity | Status |
|----|---------|----------|--------|
| SEC-01 | No DB-level ownership check across tables (cross-owner `deck_id` / `card_id` possible) | Medium | Fixed (SQL written; must be executed) |
| SEC-02 | No server-boundary input validation (text length / shape) | Medium | Fixed (SQL written; must be executed) |
| SEC-03 | Raw database/API error strings rendered in production UI | Medium | Fixed |
| SEC-04 | No security headers at all (no `vercel.json`) | Medium | Fixed (must be verified after deploy) |
| SEC-05 | Live Supabase RLS state cannot be verified from this environment | High (unverified) | Needs Future Work (manual) |
| SEC-06 | No file-size limit on material imports | Low | Fixed |
| SEC-07 | AI-generated output not capped (count/length) before saving | Low | Fixed |
| SEC-08 | Notes input unbounded before being sent to AI providers | Low | Fixed |
| SEC-09 | Sign-up flow confirms whether an email is already registered | Low | Partially Fixed |
| SEC-10 | Gemini API key sent as URL query parameter | Low | Needs Future Work |
| SEC-11 | AI provider keys stored in `localStorage` | Informational | Accepted Risk |
| SEC-12 | No application-level rate limiting | Low | Accepted Risk (documented) |
| SEC-13 | Environment/secret hygiene (repo, git history, bundle) | Informational | Verified + `.env.example` added |
| SEC-14 | Dependency advisories (7 high dev-only, 3 moderate runtime) | Low | Accepted Risk (documented) |
| SEC-15 | CSRF exposure | Informational | Not applicable (documented) |
| SEC-16 | Supabase session stored in `localStorage` | Informational | Accepted Risk |
| SEC-17 | `ErrorBoundary` renders raw error message in production | Low | Fixed |
| SEC-18 | README weakens email-confirmation guidance | Informational | Fixed |
| SEC-19 | No backup/recovery strategy for user data | Informational | Documented |
| SEC-20 | Placeholder Supabase config silently used in production builds | Low | Fixed |
| SEC-21 | Open-redirect surface (`returnTo`/callback URLs) | Informational | Pass (no user-controlled redirects) |
| SEC-22 | XSS surface (raw HTML rendering) | Informational | Pass + CSP added |
| SEC-23 | Clickjacking / framing | Low | Fixed (headers) |
| SEC-24 | Logging hygiene | Informational | Pass |
| SEC-25 | Authentication implementation | Informational | Pass (notes + 1 copy fix in SEC-09) |
| SEC-26 | Authorization via route guards vs server-side | Informational | Pass (RLS is the boundary; see SEC-01) |

**No Critical findings. No secret material found in the repository, git
history or built bundle.**

---

## Findings (detail)

### SEC-01 — Cross-owner references not blocked at the database — Medium

- **Location:** `supabase/schema.sql`, `supabase/migrations/0001_initial_schema.sql`
  (policies on `cards`, `review_logs`); consumed by `src/hooks/useCards.js`
  `createCard()` and `useReviews.submitReview()`.
- **Issue:** RLS policies only check `auth.uid() = user_id` on the row being
  written. They do not verify that the *referenced* parent row belongs to the
  same user. A client posting directly to PostgREST could insert a `cards`
  row with a `deck_id` owned by another user, or a `review_logs` row with a
  `card_id` owned by another user (with their own `user_id`, which passes the
  `WITH CHECK`).
- **Risk:** referential-ownership invariant is unenforced; cascade deletes can
  then act across owners (victim deletes a deck → attacker's planted rows are
  removed, or vice versa); any future query that filters only by `deck_id`
  without `user_id` would cross tenants. No read leak was found (RLS `SELECT`
  still scopes rows), so this is an integrity/defence-in-depth gap, not a data
  disclosure.
- **Recommended fix:** `SECURITY DEFINER` trigger functions
  (`assert_deck_owner`, `assert_card_owner`) that reject writes whose parent
  row is missing or owned by a different user, plus triggers on `cards`
  (`INSERT/UPDATE OF deck_id, user_id`) and `review_logs` (`INSERT/UPDATE OF
  card_id, user_id`).
- **Status:** **Fixed in code** — implemented in
  `supabase/migrations/0002_authorization_hardening.sql` and merged into
  `supabase/schema.sql`. **Not yet executed** against the live project (SQL
  must be run in the Supabase SQL Editor — see SEC-05 / checklist).

### SEC-02 — No server-boundary input validation — Medium

- **Location:** deck/card forms (`src/components/CreateDeckDialog.jsx`,
  `src/pages/DeckDetail.jsx`), Upload save path, database schema.
- **Issue:** nothing stopped multi-megabyte strings from being written to
  `decks.name`/`description`, `cards.question`/`answer`/`source` — neither in
  the UI (no `maxLength`, no length validation) nor in the database (no `CHECK`
  constraints). Postgres `text` accepts up to ~1 GB per value.
- **Risk:** database bloat, broken rendering, degraded UX, cheap storage abuse.
- **Recommended fix:** validation at both boundaries — UI `maxLength` +
  trim/length checks, and DB `CHECK` constraints.
- **Status:** **Fixed in code** — UI limits added (see "Input validation"
  below) and length `CHECK` constraints (added `NOT VALID`, so they only apply
  to new/updated rows and cannot fail on pre-existing data) added by
  `0002_authorization_hardening.sql`. **SQL must still be executed.**

### SEC-03 — Raw database/API error strings rendered in production UI — Medium

- **Location:**
  - `src/components/ErrorState.jsx` rendered `detail` (raw Supabase/PostgREST
    message) on Dashboard, DeckList and Review.
  - `src/pages/DeckDetail.jsx` rendered the raw `error` string twice
    (deck-not-found branch and card-list error branch).
  - `src/components/CreateDeckDialog.jsx` and `DeckDetail` form errors used
    `error.message` verbatim.
  - `src/pages/Upload.jsx` `friendlyMessage()` default branch fell back to the
    raw message.
- **Risk:** Postgres/PostgREST messages can disclose constraint names, table
  names, RLS involvement and input syntax details — internal information that
  should never reach end users in production.
- **Recommended fix:** one shared mapper (`src/lib/errors.js`
  `friendlyDbError()`) applied at every render point; raw messages shown only
  in development builds.
- **Status:** **Fixed** — all five render points now map through
  `friendlyDbError()`; `ErrorState` shows `detail` only when
  `import.meta.env.DEV`; raw text is additionally `console.warn`ed in dev only.

### SEC-04 — No production security headers — Medium

- **Location:** deployment configuration — there was no `vercel.json`.
- **Issue:** the production site served no `Content-Security-Policy`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` or frame
  protection.
- **Risk:** no clickjacking protection; no CSP means any future XSS could read
  the AI keys and Supabase session stored in `localStorage`; missing `nosniff`
  allows content-type sniffing.
- **Recommended fix:** `vercel.json` header set sized to this app's real
  dependencies (Supabase, 3 AI providers, self-hosted fonts, pdf.js worker) —
  not a copied template.
- **Status:** **Fixed in code** — `vercel.json` adds CSP
  (`default-src 'self'`; `script-src 'self'` with the theme bootstrap moved to
  an external file so no `unsafe-inline` is needed; `connect-src` allowlist;
  `style-src 'self' 'unsafe-inline'` — required by Radix/Recharts inline
  styles and sonner's runtime `<style>` injection; `frame-ancestors 'none'`),
  plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, COOP/CORP and HSTS. Verified locally
  against the built app (see "Tests performed"). **Must be re-verified on the
  live URL after deploy.**

### SEC-05 — Live RLS state unverifiable from this environment — High (unverified)

- **Location:** Supabase project backing the deployed app.
- **Issue:** this machine has **no `.env` file** (none exists anywhere in the
  workspace, and none was ever committed), so no Supabase URL/anon key is
  available to query the live project. The schema files enable RLS and define
  correct per-user policies, and Phase 6 verified the three tables exist via
  REST — but **whether RLS and those policies are actually enabled on the live
  project cannot be confirmed here.**
- **Risk:** if RLS was never enabled (e.g. tables created by hand without
  running the SQL), anyone holding the anon key — which ships in the public
  JavaScript bundle by design — could read and write every user's decks, cards
  and review history.
- **Recommended fix (manual, ~2 minutes):** run in the Supabase SQL Editor:

  ```sql
  select c.relname, c.relrowsecurity
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('decks','cards','review_logs');
  ```

  all three must return `relrowsecurity = true`; then
  `select * from pg_policies where schemaname='public';` must show the 11
  policies. Finally, unauthenticated REST smoke test: a `GET` on
  `/rest/v1/decks` with only the anon key must return **zero rows**.
- **Status:** **Needs Future Work — manual verification required before
  considering production-ready.** Documented in `PRODUCTION_CHECKLIST.md`.

### SEC-06 — No file-size limit on imports — Low

- **Location:** `src/pages/Upload.jsx` `runImport()`, `src/lib/extract.js`.
- **Issue:** any file the input accepts was fully read into memory and parsed
  (pdf.js/mammoth) or base64-encoded and sent to Gemini, with no size cap.
- **Risk:** tab-level denial of service (multi-GB file), oversized Gemini
  payloads (cost = user's own quota, but a confusing failure), memory spikes.
- **Recommended fix:** reject oversized files before parsing with a clear
  message (images 10 MB — base64 + Gemini inline limit; documents 25 MB).
- **Status:** **Fixed** — limits enforced in `runImport()` before extraction.

### SEC-07 — AI output not capped before saving — Low

- **Location:** `src/lib/ai.js` `parseCards()` / `normalizeCard()`.
- **Issue:** structure was validated (object shape, non-empty strings) but
  neither the number of cards nor their length was bounded, and there was no
  length limit at the DB boundary.
- **Risk:** a misbehaving/hijacked model response could produce hundreds of
  oversized rows in one save loop.
- **Recommended fix:** cap the card count, bound each field, and keep DB `CHECK`
  limits (SEC-02) as the backstop.
- **Status:** **Fixed** — max 40 cards kept; question/answer/source length
  bounded at parse time.

### SEC-08 — Notes input unbounded before AI call — Low

- **Location:** `src/pages/Upload.jsx` `handleGenerate()`.
- **Issue:** the entire notes string was put into a prompt with no cap.
- **Risk:** oversized provider requests (slow, quota-wasting, guaranteed
  failure) with no actionable message.
- **Status:** **Fixed** — 60,000-character cap with an inline validation error
  before any network call.

### SEC-09 — Sign-up reveals that an email is already registered — Low

- **Location:** `src/lib/authForm.js` `friendlyAuthError()`.
- **Issue:** Supabase Auth returns an error for a duplicate sign-up, and the
  UI mapped it to "An account with this email already exists" — confirming
  account existence to anyone.
- **Risk:** account enumeration (limited value for a student app, but real).
- **Status:** **Partially Fixed** — the UI copy is now non-committal ("That
  sign-up couldn't be completed. If you already have an account, try signing
  in instead."). **Limitation:** anyone calling the Supabase Auth API directly
  still gets the provider's differentiated response — client copy cannot fix
  that without a server-side proxy (out of scope for this architecture).
  Login errors already use non-enumerating copy ("Email or password is
  incorrect.").

### SEC-10 — Gemini API key in the URL query string — Low

- **Location:** `src/lib/ai.js` `callGemini()`, `transcribeImage()`
  (`?key=…`).
- **Issue:** the key travels as a URL parameter rather than the
  `x-goog-api-key` header. URLs are more likely to be recorded (browser
  history/devtools, intermediary logs) than header values.
- **Risk:** key disclosure to anyone who can observe the request URL. Traffic
  is direct browser → Google over TLS, so exposure is limited to endpoints
  that log full URLs.
- **Recommended fix:** switch to the `x-goog-api-key` request header, then
  verify live with a real key.
- **Status:** **Needs Future Work** — deliberately not changed in this phase
  because it could not be live-tested here (no provider key in this
  environment); breaking generation would be worse than the low residual risk.
  Test procedure documented in the checklist.

### SEC-11 — AI provider keys in `localStorage` — Informational

- **Location:** `src/lib/ai.js` key helpers; `src/pages/Settings.jsx`.
- **Issue:** any script running on the origin can read the keys.
- **Risk:** XSS would disclose user-supplied Gemini/Groq/Cerebras keys.
- **Mitigations in place:** no raw-HTML rendering anywhere (React escaping
  only), CSP `script-src 'self'` (no inline scripts), no third-party
  scripts/trackers on the origin, keys typed into `type="password"` inputs.
- **Status:** **Accepted Risk** — inherent to a serverless architecture where
  the browser must call providers directly; documented in Settings UI copy.
  Never add third-party scripts to this origin.

### SEC-12 — No application-level rate limiting — Low

- **Location:** AI generation, card/deck writes, auth attempts.
- **Issue:** there is no server component, so no app-level rate limiter exists.
- **Analysis:** AI requests are billed to the *user's own* provider keys — an
  abuser only burns their own quota; there is no anonymous expensive endpoint.
  Supabase Auth applies provider-side rate limits to sign-in/sign-up attempts.
  PostgREST writes are limited only by plan quotas.
- **Recommended production approach (if abuse ever appears):** move AI
  generation behind a Supabase Edge Function with a per-user daily counter
  (Deno, free tier) — not a client-side fake limiter, which would provide no
  real protection.
- **Status:** **Accepted Risk (documented)** — no fake control added.

### SEC-13 — Environment & secret hygiene — Informational

- **Inspection:**
  - Only two env vars exist: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
    (both `VITE_*` = intentionally client-exposed; the anon key is a public
    credential whose danger is neutralised by RLS — see SEC-05).
  - No service-role key, database password, JWT secret or provider key exists
    anywhere in source, docs or config.
  - `.gitignore` covers `.env`, `.env.*` (`!.env.example`), `*.local`.
  - `git log --diff-filter=A` shows **no env file was ever committed**;
    `git grep` for key-shaped patterns (JWT/`AIza`/`gsk_`/service-role) found
    no secrets.
  - No `.env` / `.env.local` currently exists on this machine (nothing to
    leak locally; production values live only in Vercel's env settings).
  - Built `dist/` was scanned for secret patterns after the production build —
    clean (see "Tests performed").
  - The only log statement in `src/` is a `console.warn` in
    `src/lib/supabase.js` that prints **no values** when env vars are missing.
- **Status:** **Verified.** Gap fixed: `.env.example` (variable names +
  placeholders only) now exists so setup is reproducible without sharing
  values.

### SEC-14 — Dependency advisories — Low

- **Command:** `npm audit` (full) → **10 vulnerabilities: 7 high, 3 moderate.**
  `npm audit --omit=dev` (what ships) → **3 moderate.**
- **Runtime (ships to users):** `mammoth → argparse → sprintf-js`
  (GHSA-hp3w-g68c-fv3c, DoS via unbounded precision specifiers). Only fix
  offered is `npm audit fix --force` → `mammoth@0.3.29`, a breaking downgrade
  that would break `.docx` import. The vulnerable call path only runs when a
  user imports *their own* `.docx` file in *their own* browser — worst case is
  their own tab hanging; no server is involved.
- **Dev-only (never in the bundle):** 7 high-severity findings in the
  `shadcn` CLI chain (`@shadcn/registry` → `fast-glob`/`ts-morph` →
  `braces`/micromatch-family). This matches the previously documented
  Known Risk; the CLI runs only during local component generation.
- **Status:** **Accepted Risk (documented)** — no blind upgrades performed.
  Re-check `npm audit` each phase; when mammoth ships a fixed `sprintf-js`,
  upgrade mammoth within its semver range and re-run the build + import smoke.

### SEC-15 — CSRF — Informational (not applicable)

- All state-changing calls use Supabase PostgREST with an `Authorization:
  Bearer <JWT>` header read from storage. Credentials are never attached
  automatically by the browser (no cookie auth), so a cross-site form/fetch
  cannot forge an authenticated request. Supabase Auth mutations are likewise
  bearer-based. **No CSRF middleware added** — adding one would be security
  theatre for this architecture.
- **Status:** Documented (no change needed).

### SEC-16 — Session stored in `localStorage` — Informational

- `@supabase/supabase-js` default persistence. An XSS could hijack the session.
  Same threat model as SEC-11; mitigated by CSP + no raw HTML sinks. Cookie
  persistence would require Supabase configuration and is not needed for a
  single-user-origin free-tier app.
- **Status:** **Accepted Risk.**

### SEC-17 — ErrorBoundary shows raw error text in production — Low

- **Location:** `src/components/ErrorBoundary.jsx`.
- **Risk:** uncaught JS error messages can include internal details.
- **Status:** **Fixed** — raw message rendered only when
  `import.meta.env.DEV`; production shows generic copy (the error is still
  logged to the developer console by React).

### SEC-18 — README email-confirmation guidance — Informational

- **Location:** `README.md` told operators to turn Supabase email
  confirmation **off** for testing without a strong production recommendation.
- **Status:** **Fixed** — README now states confirmation must stay **ON in
  production** and that turning it off is a local-testing-only option.

### SEC-19 — Backup / recovery — Informational

- Supabase Free has **no** point-in-time recovery and no automatic backups
  beyond physical redundancy; nothing in this project configures exports.
- **Status:** **Documented** (no backup system invented — out of scope).
  Recommended: schedule a weekly `supabase db dump` (Supabase CLI) or export
  via the dashboard, and treat user data as non-recoverable otherwise.

### SEC-20 — Placeholder config silently used in production — Low

- **Location:** `src/lib/supabase.js` falls back to
  `https://placeholder.supabase.co` when env vars are missing, and only warns
  in the console. In a production build with missing Vercel env vars the app
  would boot into a confusingly broken state (every request fails).
- **Status:** **Fixed** — the client now exports `supabaseConfigured`, and
  `App.jsx` renders an explicit configuration-error screen in **production
  builds only** when the env vars are absent (dev keeps the placeholder
  behaviour needed for UI work).

### SEC-21 — Open redirects — Informational (pass)

- No `returnTo`/`redirect`/callback parameter exists. All navigations are to
  hardcoded internal paths (`/auth`, `/dashboard`, `/decks/:id`, …); the only
  query parameter consumed is `?deck=<id>`, used solely as a `<select>`
  value — never as a navigation target.
- **Status:** Pass.

### SEC-22 — XSS — Informational (pass) + CSP

- `grep` of `src/` finds **no** `dangerouslySetInnerHTML`, `innerHTML`, `eval`
  or `new Function`. All user/AI content renders as React text nodes (escaped).
  Rich HTML is never accepted. Added CSP (SEC-04) limits the blast radius of
  any future XSS and forbids inline script injection.
- **Status:** Pass; CSP added as defence in depth.

### SEC-23 — Clickjacking — Low → Fixed

- `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY`.
  The app has no legitimate embedding use case.
- **Status:** **Fixed** (verify on the deployed URL).

### SEC-24 — Logging hygiene — Informational (pass)

- One `console.warn` in `src/` (missing env, no values printed). No
  `console.log/debug/info` anywhere in `src/`. No passwords, tokens or keys
  are logged (auth errors are mapped before display, provider responses are
  not logged).
- **Status:** Pass.

### SEC-25 — Authentication — Informational (pass with notes)

- **Inspection results:**
  - Passwords are handled entirely by Supabase Auth (`signInWithPassword` /
    `signUp`); the app never sees, stores or hashes them; no plaintext
    password is persisted anywhere. Password fields use `type="password"`,
    `autocomplete` current-password/new-password, and a show/hide toggle.
  - Session handling: `onAuthStateChange` + `getSession` in
    `src/hooks/useAuth.js`; sign-out calls `supabase.auth.signOut()`.
  - Auth errors are mapped through `friendlyAuthError()` — raw provider text
    never reaches the sign-in screen (generic fallback for unknown messages).
  - Duplicate submit guarded; loading state disables inputs.
  - Client-side field validation exists for UX (email format, 6-char minimum
    at sign-up) — real enforcement is server-side (Supabase).
  - Password reset / OAuth are **not implemented** (documented non-features —
    no fake UI pretends otherwise).
- **Known limitation:** email confirmation toggle is an operator decision
  (README now guides correctly); Supabase's default rate limits apply.
- **Status:** Pass. Enumeration copy handled in SEC-09.

### SEC-26 — Authorization / route protection — Informational (pass with 1 gap)

- `ProtectedLayout` / `GuestRoute` in `src/App.jsx` gate every route
  client-side; every page under the shell and `/review` is protected.
- Real authorization is **database-side**: RLS `auth.uid() = user_id` on all
  three tables. Deck-by-id lookups (`/decks/:id`) resolve against the
  RLS-scoped deck list, so a foreign id shows "Deck not found" — no IDOR read.
  Client filters (`.eq('user_id', user.id)`) are belt-and-braces on top of RLS.
- **Gap:** parent/child ownership across tables not enforced (SEC-01) — fixed
  in SQL.
- **Status:** Pass once `0002_authorization_hardening.sql` is executed.

---

## Area-by-area results

### Environment variables
- Required: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (client-safe by
  design — public anon key, protected by RLS).
- Server-only: **none exist** (no server components; no service-role key
  anywhere — verified by grep).
- Optional: none. AI provider keys are **user-supplied, browser-local**
  (localStorage), never in env, never in the bundle.
- `.env.example` created (names/placeholders only); `.env*` gitignored; no env
  file ever committed; `dist/` secret scan clean.

### Public vs private variables
- No `NEXT_PUBLIC_*` (not a Next.js app). All `VITE_*` values are public by
  construction; the only two are safe-to-expose-by-design. No secret is baked
  into the client bundle.

### Git security
- `.gitignore` correct; history scan found no committed secrets. **Git history
  was NOT rewritten** (nothing to rewrite — no secret was ever committed).

### Supabase / RLS
- All three tables have `user_id`, RLS enabled in schema and per-user
  select/insert/update/delete policies (`auth.uid() = user_id`), insert
  `WITH CHECK` included; `review_logs.rating` has a `1–4` CHECK. No
  `authenticated`-wide or `anon`-wide policy exists; no policy grants access
  to other users' rows; RLS was not disabled anywhere.
- Live-state verification still required (SEC-05).
- Hardening added: cross-table ownership triggers + length CHECKs (SEC-01/02).

### API security
- There are **no first-party API endpoints**. The app calls:
  1. Supabase REST/Auth (anon key + user JWT, RLS-enforced) — input validated
     client-side and now also by DB constraints;
  2. Provider APIs with the user's own keys (never our server).
- Nothing anonymous can reach a costly first-party resource because none
  exists.

### File upload security
- Files are **never stored** on any server — parsed in-browser (pdf.js,
  mammoth, `File.text()`); only images leave the browser, to Google Gemini
  vision, base64, under the user's own key.
- Type acceptance uses `file.type` **and** extension (not extension alone);
  `.docx` is treated as a zip container and fails safely if malformed —
  nothing is executed, no filename is ever used as a path.
- Size limits added (SEC-06). No storage permissions/ownership issues exist
  because no storage bucket exists.

### AI generation security
- Runs only inside the authenticated app shell; output is structurally
  validated (`normalizeCard`) and now length/count-capped (SEC-07) before any
  DB write; preview rows remain user-editable/deletable before saving.
- Keys: localStorage only, sent only to the owning provider (SEC-11), Gemini
  via query string (SEC-10, open).
- Abuse cost is bounded to the key owner (SEC-12).

### Error handling
- Production users now see only friendly copy (SEC-03, SEC-17); raw messages
  render in dev builds only; auth errors already mapped (Phase 7); AI errors
  mapped to actionable copy with Settings/Retry actions.

### Production configuration
- New `vercel.json` (headers only — no build settings changed; Vite detection,
  `npm run build` / `dist` defaults untouched). Env vars are configured
  per-deployment in Vercel (user-side, see checklist). Placeholder fallback is
  no longer silent in production (SEC-20).

### Development-vs-production behaviour
- No mock data, test credentials, debug flags or fake auth exist in `src/`
  (searched). Dev-only behaviours that remain: placeholder Supabase client in
  `npm run dev`, and raw error text in dev builds — both explicitly gated on
  `import.meta.env.DEV` and inert in production.

### Data privacy
- Only email + flashcard/review data are stored; decks/cards/review_logs are
  RLS-scoped per user; no third-party analytics/trackers exist; API keys never
  reach Supabase; the anon key is the only credential in the bundle.

---

## Tests performed (this phase)

1. `npm run lint` (oxlint) — **1 warning** (the tolerated pre-existing
   `ui/button.jsx` fast-refresh warning; `public/theme-init.js` was adjusted
   to keep it warning-free).
2. `npm run build` — production build succeeds (main chunk 611 kB / CSS
   63.5 kB; known chunk-size warning unchanged, see PERFORMANCE_AUDIT.md).
3. **Secret scan of `dist/`** — pattern search across every built file for
   JWT-shaped strings, `AIza…`, `gsk_…`, `csk-…`, `sbp_…`, `service_role`,
   `SUPABASE_SERVICE`, PEM headers: **no matches**; the only Supabase host in
   the bundle is the expected placeholder (build had no `.env`). A second
   build with dummy env values was used for the browser boot test, then a
   clean rebuild confirmed no test values remained (**0 hits**).
4. **Git history scan** — `git log --all --diff-filter=A` for env files
   (none ever committed), `git grep` for key-shaped literals (none).
   `.env.example` confirmed untracked-and-not-ignored via `git status`.
5. **Header/CSP test (real browser):** a temporary local server served
   `dist/` with the exact `vercel.json` header set; headless Chrome
   (new headless, temp profile) then:
   - `GET /auth`, `/`, `/dashboard` → all headers present on the wire
     (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy,
     COOP, CORP, HSTS, X-Permitted-Cross-Domain-Policies) with SPA fallback
     working;
   - the production bundle executed and rendered the **full Auth screen**
     (email/password form, heading, theme toggle) with **zero CSP
     violations** in the console — `script-src 'self'` allows the module
     bundle and the external theme bootstrap, sonner's runtime `<style>`
     injection is allowed by `style-src`;
   - a deliberate probe page with an inline `<script>` was **blocked** with
     a logged CSP violation (proves enforcement, not just header presence);
   - without env vars, the new production guard rendered
     "FastRev isn't configured yet…" (SEC-20 verified in a real browser).
6. `npm audit` (full: 7 high + 3 moderate, all dev-chain except mammoth's
   3 moderate) and `npm audit --omit=dev` (3 moderate).
7. **56-check security smoke** (`vite` `ssrLoadModule` + `renderToString`,
   temp script deleted after): 8 `friendlyDbError` mapping cases, 7 auth
   copy/validation cases, 4 render checks (ErrorState DEV detail, Auth form,
   Upload limits, Dashboard), 35 source/config assertions (maxLength rules
   everywhere, AI caps, DEV-gating, CSP/headers content, SQL trigger +
   constraint presence in both schema files, `.env.example` hygiene).
   Result: **56 passed, 0 failed**.
8. Grep-based source assertions: no `dangerouslySetInnerHTML`/`innerHTML`/
   `eval`/`new Function`, no `console.log/debug/info`, no
   `window.open`/user-controlled `location` assignments, no external
   resource URLs outside the CSP allowlist.
9. Validation of the new DB SQL: syntax-reviewed and written to be
   idempotent; **not executed** (no database credentials in this
   environment) — honest limitation, see SEC-05.

## Remaining accepted risks (explicit)

- SEC-05 live RLS verification (manual step — highest-priority outstanding item).
- SEC-10 Gemini key in URL (defer until it can be live-tested).
- SEC-11 AI keys + SEC-16 session in `localStorage` (architectural).
- SEC-12 no app-level rate limiting (no server; documented future approach).
- SEC-14 dependency advisories (runtime moderate: mammoth chain; dev-only
  highs: shadcn CLI chain).
- SEC-19 no automated backups on Supabase Free.

**This application is not claimed to be "secure".** The checks above were
actually performed; items outside this environment's reach are listed as
manual follow-ups rather than passed.
