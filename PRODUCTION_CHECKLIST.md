# PRODUCTION_CHECKLIST.md — FastRev (Phases 12–14)

Rule: **a box is checked only if it was actually verified**, and the method is
noted. Items that require the live Supabase/Vercel deployment (no credentials
in the dev environment) stay unchecked with the exact step to perform.

Legend: `[x]` verified here · `[ ]` manual/live step required.

---

## Environment

- [x] No secrets committed (git history + `dist/` bundle scanned — see
      `SECURITY_AUDIT.md` SEC-13 / Tests performed)
- [x] `.env.example` exists with variable names/placeholders only
- [x] `.env` / `.env.*` gitignored (`!.env.example` negation present;
      `.env.example` confirmed untracked-not-ignored)
- [x] No development secrets in source (only `VITE_SUPABASE_URL` /
      `VITE_SUPABASE_ANON_KEY` exist, both client-safe by design)
- [x] Production build fails safe when env vars are missing (shows a clear
      configuration message instead of a broken app — verified in headless
      Chrome)
- [ ] **Production environment variables configured in Vercel** — verify
      `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set **for
      Production** and were present at build time (Settings → Environment
      Variables → redeploy if added after the last build)
- [ ] **No service-role key anywhere in Vercel env vars** — audit the Vercel
      dashboard; a `VITE_`-prefixed secret of any kind would ship to users

## Authentication

- [ ] **Login verified against live Supabase** — sign in with a real account
- [ ] **Signup verified** — new email → confirmation panel → confirm link →
      sign in (email confirmation stays ON in production)
- [ ] **Logout verified** — UserMenu → Sign out returns to `/auth` and the
      session is cleared (revisit a protected URL while signed out →
      redirected)
- [x] Protected routes are gated client-side (`ProtectedLayout` /
      `GuestRoute` — code-verified; every route except `/auth` is inside the
      protected tree) — plus harness checks of the auth screens (login,
      signup, validation, confirmation, server-error states) in
      `CROSS_BROWSER_QA.md`
- [x] Auth errors never show raw provider text (`friendlyAuthError`, unknown →
      generic; duplicate sign-up copy no longer confirms account existence)
- [x] Password handling delegated to Supabase Auth (no local hashing/storage;
      `type="password"` + correct `autocomplete`)
- [ ] **Authorization verified end-to-end** — log in as user A, copy a deck
      URL, log in as user B, open it → must show "Deck not found"

## Database

- [ ] **RLS reviewed on the live project** (highest-priority outstanding
      item — SEC-05). In Supabase SQL Editor:

      ```sql
      select c.relname, c.relrowsecurity
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname in ('decks','cards','review_logs');
      ```

      All three must be `t`, and
      `select count(*) from pg_policies where schemaname='public';` → 11.
- [ ] **Phase 12 hardening executed** — run
      `supabase/migrations/0002_authorization_hardening.sql` (or re-run
      `supabase/schema.sql`) in the SQL Editor; expect `Success`
- [ ] **Ownership triggers verified** — as user A, insert a card row with a
      `deck_id` belonging to user B (SQL Editor acting as `authenticated`,
      or PostgREST) → must be rejected with "Deck does not belong to the
      current user"
- [ ] **Unauthorized access tested** — with only the anon key (no auth
      header): `GET /rest/v1/decks` must return **zero rows**, never an error
      about RLS being disabled
- [ ] **Invalid IDs tested** — open `/decks/not-a-uuid` → friendly message,
      no raw Postgres error (mapper covers `invalid input syntax`)

## API

- [x] No first-party API endpoints exist (static SPA → Supabase REST/Auth +
      direct provider calls; documented in SECURITY_AUDIT)
- [x] Supabase access requires an authenticated JWT for data (RLS `auth.uid()`
      policies) — code/schema verified; live verification above
- [x] Input validation at both boundaries (UI `maxLength` + trim checks; DB
      `CHECK` constraints after 0002 runs)
- [x] Error handling safe in production (raw messages dev-only — smoke-tested)
- [x] High-cost endpoints reviewed: AI calls use the user's own keys
      (abuser burns only their own quota); no anonymous costly endpoint
      (SEC-12 documents the future Edge-Function approach if abuse appears)

## AI / Uploads

- [x] File type validation (MIME **and** extension; unsupported → friendly
      error; nothing executed, no server storage exists)
- [x] File size validation (10 MB images / 25 MB documents — enforced before
      any read/parse)
- [x] Notes cap 60,000 chars before generation (typed, pasted and imported
      paths all covered)
- [x] AI output capped (max 40 cards + field truncation before save)
- [x] API keys stored client-side only (localStorage), sent only to their own
      provider, covered by the CSP `connect-src` allowlist
- [x] Upload → generate → select → edit → save flow exercised end-to-end
      against mocked providers (`CROSS_BROWSER_QA.md` scenario 7)
- [x] Ownership protection (code level) — files never stored or executed;
      only user-scoped derived data is written (RLS + triggers live
      verification is in the Database section)
- [ ] **Real AI generation tested with a live key** (rate-limit fallback
      chain: Gemini → Groq → Cerebras) — and **real-endpoint CORS** for
      Groq/Cerebras confirmed in a deployed browser
- [ ] **Storage permissions reviewed** — N/A unless a Supabase Storage bucket
      is ever added (none exists today; if added, do NOT make it public
      without a review)

## UI/UX

- [x] Responsive behavior verified 375→1440 px incl. breakpoint edges
      (639/640, 767/768, 1023/1024) — headless-Chrome harness, production
      build, overflow scans (`CROSS_BROWSER_QA.md`)
- [x] Dark mode verified (light + dark screenshots at 5 widths, theme
      persistence + toasts/dialogs legibility — same harness)
- [x] Keyboard navigation verified (Space/1–4 review shortcuts, Tab/focus
      movement, dialogs, menu focus return — harness keyboard tests)
- [x] Accessibility checks completed for this build (contrast audits every UI
      phase ≥4.5:1 text / ≥3:1 UI in both themes; roles/labels/landmarks
      asserted in SSR smoke + harness; charts have data-readout labels)
- [x] Reduced-motion emulation exercised (harness: animations clamped)
- [ ] **Accessibility tested by a human with assistive tech** (screen reader
      pass) — not performed
- [ ] **Physical-device pass** (real iOS/Android + Safari/Firefox) —
      Chromium-only automation so far
- [ ] Toasts, focus feel and animation timing judged by a human in a real
      browser

## Performance

- [x] Production build succeeds (`npm run build`)
- [x] Performance audit completed — `PERFORMANCE_AUDIT.md` (real Lighthouse
      lab runs: baseline 88/98/100/82 → **94/100/100/100**, initial chunk
      1,150.61 → 657.37 kB, CLS 0)
- [x] Code splitting in place (React.lazy routes; recharts only on
      `/analytics`; shell chrome never unmounts — no CLS)
- [x] Loading states everywhere (shape-mirroring skeletons, no fake progress)
- [ ] Re-measure Lighthouse **on the deployed URL** (lab numbers only today —
      no field/CrUX data)
- [ ] Logged-in lazy-route navigation checked manually in a real browser
      (chunk loads while authenticated never exercised here)

## Security

- [x] Security audit completed — `SECURITY_AUDIT.md` (SEC-01…SEC-26; no
      Criticals; accepted risks explicitly listed)
- [x] Dependency audit completed (`npm audit` full + `--omit=dev`; no
      criticals; 7 high dev-only, 3 moderate runtime accepted as SEC-14)
- [x] Security headers + CSP configured in `vercel.json` and verified
      **locally** against the built app (headers on the wire; CSP enforced —
      inline-script probe blocked; full Auth render with zero violations)
- [x] Error messages safe in production (dev-only raw detail)
- [ ] Re-run `npm audit` before each future release; upgrade `mammoth` within
      range once a patched `sprintf-js` exists, then re-run the build
- [ ] **Headers verified on the live URL** after deploy:
      `curl -I https://your-domain.vercel.app/` → confirm
      `content-security-policy`, `x-frame-options: DENY`,
      `x-content-type-options: nosniff`, `referrer-policy`,
      `permissions-policy`, `strict-transport-security`
- [ ] **CSP allowlist matches reality** — if you enable Vercel
      Analytics/Speed Insights, add their origins to `connect-src`/`script-src`
      (they would be blocked today); if Supabase moves to a custom domain,
      add it to `connect-src`

## QA

- [x] Lint passes (`npm run lint` — 1 tolerated pre-existing warning only)
- [x] Production build passes (`npm run build`)
- [x] Usability audit completed — `USABILITY_AUDIT.md` (18 issues, statuses;
      13 fixed incl. U-18 via Phase 12, U-08 + U-14…U-17 documented)
- [x] Cross-browser/responsive QA completed — `CROSS_BROWSER_QA.md`
      (**179/179 checks, 0 console errors**, production build + mocked
      backend, 36 screenshots)
- [x] Major flows exercised in the harness: auth screens, shell/nav at 12
      widths, deck create/validate/delete, deck detail (long-text, dialogs,
      inline edit), review keyboard + completion, upload import→generate→save,
      analytics, settings, sign-out
- [x] Dev-server smoke of all 10 routes + module transforms (HTTP 200)
- [ ] **Main user flows tested in production with real credentials:**
      signup → confirm → create deck → add/generate cards → review session →
      analytics → logout
- [ ] Mobile tested by hand (375 px: nav, review mode, upload panels)
- [ ] Desktop tested by hand (1440 px)
- [ ] `.env` restart note followed locally (dev needs a restart after
      changing `.env`)

## Deployment

- [x] Deployment configuration reviewed — `vercel.json` adds security headers
      only; build command/output unchanged (Vite defaults: `npm run build` →
      `dist`)
- [x] Deployment steps documented (`README.md` § Deploy to Vercel)
- [ ] **Supabase URL configuration** — Site URL + redirect URLs include the
      production domain (Dashboard → Authentication → URL Configuration)
- [ ] Production deploy completed and smoke-tested end-to-end
- [ ] Keep-alive cron configured (Supabase Free pauses after ~7 days —
      README § Keeping Supabase awake)

---

## Outstanding before calling this production-ready

1. **Run the Phase 12 SQL** (0002 hardening) and the RLS verification above
   — SEC-05, the only High-severity open item.
2. Verify Vercel env vars are present at build time (the app says so loudly
   if not, but it must be configured).
3. Live smoke of auth + review + AI generation (needs real credentials).
4. Confirm headers on the deployed URL.
5. One human pass on a real phone + one on Safari/Firefox (Chromium-only
   automation so far).
