# PRODUCTION_CHECKLIST.md — FastRev (Phase 12)

Rule: **a box is checked only if it was actually verified.** Items that
require the live Supabase/Vercel deployment (no credentials in this
environment) stay unchecked with the exact step to perform.

Legend: `[x]` verified here · `[ ]` manual step required.

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
- [ ] **Production environment variables configured in Vercel** — deploy
      settings are on Vercel; verify `VITE_SUPABASE_URL` and
      `VITE_SUPABASE_ANON_KEY` are set **for Production** and were present
      at build time (Settings → Environment Variables → redeploy if added
      after the last build)
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
      protected tree)
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
      `deck_id` belonging to user B (SQL Editor acting as `authenticated`, or
      PostgREST) → must be rejected with "Deck does not belong to the
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

## Uploads

- [x] File type validation (MIME **and** extension; unsupported → friendly
      error; nothing executed, no server storage exists)
- [x] File size validation (10 MB images / 25 MB documents — enforced before
      any read/parse)
- [x] Notes cap 60,000 chars before generation (typed, pasted and imported
      paths all covered)
- [x] Ownership protection — files never stored; only user-scoped derived
      data is written (RLS + ownership triggers)
- [ ] **Storage permissions reviewed** — N/A unless a Supabase Storage
      bucket is ever added (none exists today; if added, do NOT make it
      public without a review)

## Dependencies

- [x] `npm audit` completed (full + `--omit=dev`)
- [x] Critical vulnerabilities assessed — **no criticals**; the 7 highs are
      dev-only (shadcn CLI chain, never bundled); 3 moderates are runtime
      (`mammoth → sprintf-js`, client-side DoS on the user's own file, no
      fixed version available without a breaking downgrade → accepted,
      SEC-14)
- [ ] Re-run `npm audit` before each future release; upgrade `mammoth`
      within range once a patched `sprintf-js` exists, then re-run the build

## Deployment

- [x] Production build succeeds (`npm run build`)
- [x] Deployment configuration reviewed — `vercel.json` adds security headers
      only; build command/output unchanged (Vite defaults)
- [x] Security headers verified locally against the built app (CSP enforced —
      inline script probe blocked; full app rendered with zero violations)
- [x] Production errors show friendly copy only (ErrorState/ErrorBoundary
      DEV-gated; config-missing screen instead of a broken app)
- [ ] **Headers verified on the live URL** after deploy:
      `curl -I https://your-domain.vercel.app/` → confirm
      `content-security-policy`, `x-frame-options: DENY`,
      `x-content-type-options: nosniff`, `referrer-policy`,
      `permissions-policy`, `strict-transport-security`
- [ ] **CSP allowlist matches reality** — if you enable Vercel
      Analytics/Speed Insights, add their origins to `connect-src`/`script-src`
      (they would be blocked today); if Supabase moves to a custom domain,
      add it to `connect-src`
- [ ] **Supabase URL configuration** — Site URL + redirect URLs include the
      production domain

## Final QA

- [ ] Mobile tested (375 px: nav, review mode, upload panels)
- [ ] Desktop tested (1440 px)
- [ ] Accessibility tested (keyboard review flow, focus moves, live regions)
- [ ] Dark mode tested (theme persists, toasts/dialogs readable)
- [ ] Main user flows tested in production: signup → confirm → create deck →
      add/generate cards → review session → analytics
- [ ] Toasts, keyboard shortcuts (Space / 1–4) and reduced-motion spot-check
- [ ] `.env` restart note: local dev needs a restart after changing `.env`

---

## Outstanding before calling this production-ready

1. **Run the Phase 12 SQL** (0002 hardening) and the RLS verification above
   — SEC-05, the only High-severity open item.
2. Verify Vercel env vars are present at build time (the app now says so
   loudly if not, but it must be configured).
3. Live smoke of auth + review + AI generation (needs real credentials).
4. Confirm headers on the deployed URL.
