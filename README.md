# FastRev — Student Review System

A free-tier flashcard app: paste or import your study material (PDF, images, documents, or plain text), let AI turn it into atomic flashcards, and review daily with FSRS spaced repetition.

## Overview

- **What it is:** a single-user spaced-repetition study app (decks → cards →
  daily reviews) with AI-assisted card creation and progress analytics.
- **Who it is for:** students studying their own material; every account's data
  is isolated by database Row Level Security.
- **Status:** feature-complete through Phases 0–13 (build, lint, usability,
  performance, security and cross-browser audits all passed — see the
  [documentation map](#documentation-map)). Outstanding items are live-deploy
  verification steps listed in `PRODUCTION_CHECKLIST.md`.

## Features

- **Auth** — email/password sign-in via Supabase Auth (RLS-protected data)
- **Decks** — create and delete decks; cards live inside decks. (Renaming a deck has **no UI yet** — the hook exists but the feature is deliberately unimplemented, tracked as U-08 in `USABILITY_AUDIT.md`.)
- **AI card generation** — paste notes → 10–15 flashcards, editable before saving. Provider chain: **Google Gemini (`gemini-3.8-flash`) → Groq (`openai/gpt-oss-120b`) → Cerebras**, so hitting one free-tier limit falls through to the next
- **Material import** — drop or pick a file on the Generate Cards page: **PDF** (text extracted locally in the browser with pdf.js), **images** (screenshots/photos of pages transcribed by your Gemini key), **`.docx`** (mammoth), or **`.txt`/`.md`** — imported text lands in the notes box for you to trim before generating
- **Reviews** — one card at a time, rated Again / Hard / Good / Easy, scheduled by **FSRS** (`ts-fsrs`)
- **Analytics** — retention rate, total reviews, current streak, cards learned, highlights (due today, streak, weakest deck), a week-over-week activity trend, a 7-day due forecast (bar chart), 14-day review activity (line chart), a rating breakdown, and weakest decks by accuracy with progress bars
- **Polish** — loading skeletons, empty states everywhere, global error boundary, mobile-first responsive layout

## Tech stack

React 19 + Vite 8 · Tailwind CSS v4 (CSS-first, no `tailwind.config.js`) · shadcn/ui (JavaScript mode) + lucide-react icons · sonner toasts · Supabase (PostgreSQL + Auth + RLS) · ts-fsrs · Recharts · react-router-dom · pdf.js + mammoth (material import) · oxlint · Vercel hosting

## Local setup

1. **Prerequisites:** Node 20.19+ (Node 22 LTS or newer recommended) and npm.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create `.env` in the project root by copying the template (`.env.example`):

   ```sh
   copy .env.example .env
   ```

   Then fill in the two values from **Supabase Dashboard → Project Settings → API**
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `.env` is gitignored — never
   commit real values or paste them into docs/code. The app boots with
   placeholder warnings in development if these are empty (production builds
   show a clear configuration message instead), but auth and data need real
   values.

4. Run the dev server:

   ```sh
   npm run dev
   ```

   Other scripts: `npm run build` (production build), `npm run preview` (serve the build), `npm run lint` (oxlint).

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com) (Free tier).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/schema.sql`](supabase/schema.sql), and run it.
   - Creates `decks`, `cards`, `review_logs` + indexes.
   - Enables **RLS** on all three tables with `auth.uid() = user_id` policies (select/insert/update/delete) — each user sees only their own rows.
   - Adds the Phase 12 hardening: cross-table ownership triggers + length `CHECK` constraints (existing projects can run [`supabase/migrations/0002_authorization_hardening.sql`](supabase/migrations/0002_authorization_hardening.sql) alone).
   - Safe to re-run (drops policies before recreating it; idempotent guards throughout).
   - **Verify RLS** afterwards — see [supabase/README.md](supabase/README.md) § 4.
3. **Email confirmation:** keep **Confirm email** *ON* in production (Dashboard → **Authentication → Email**) — it stops random sign-ups from activating an account. You may turn it off only for local testing convenience.
4. Put the project URL and anon key into `.env` (see above).

> The anon key is safe to expose in the client — RLS is what protects the data.

## AI provider setup (free tiers)

Open the app → **Settings** (Dashboard or Upload page) and paste one or more keys. Keys are stored **only in your browser's localStorage** and are sent only to that provider's own endpoint — never to Supabase or any other server.

| Provider | Key source | Used |
| --- | --- | --- |
| Gemini (`gemini-3.8-flash`) | [Google AI Studio](https://aistudio.google.com/apikey) | First choice |
| Groq GPT-OSS 120B (`openai/gpt-oss-120b`) | [console.groq.com/keys](https://console.groq.com/keys) | Fallback |
| Cerebras Llama 3.3 70B | [cloud.cerebras.ai](https://cloud.cerebras.ai) | Last fallback |

A single Gemini key is enough; adding the others keeps generation working when a free-tier rate limit kicks in.

## Keeping Supabase awake (free-tier pause)

Supabase **pauses projects after ~7 days of inactivity**. Prevent this with a free scheduled ping every 5 days:

### Option A — cron-job.org (no code, recommended)

1. Create a free account at [cron-job.org](https://cron-job.org) and **add a job**.
2. **URL** (GET is fine):

   ```
   https://YOUR-PROJECT.supabase.co/rest/v1/
   ```

   Optionally add header `apikey: YOUR-ANON-KEY` — the REST root responds without data access either way.
3. **Schedule:** every 5 days (cron-job.org lets you pick "days of month" — run on the 1st and 6th, or use their interval options).
4. Save and enable the job; check the execution log after the first run.

### Option B — Supabase Edge Function with scheduled trigger

1. Install the Supabase CLI and run `supabase functions new keep-alive`.
2. Implement a no-op handler (e.g. return `new Response('ok')`).
3. Deploy it (`supabase functions deploy keep-alive`) and schedule it with a pg_cron + HTTP call, or point cron-job.org at the function URL instead of the REST root.

Either way, any hit within the activity window keeps the project awake. Also sign into the Supabase dashboard at least once a week as a backup.

## Deploy to Vercel

1. Push the repo to GitHub:

   ```sh
   git remote add origin https://github.com/YOUR-USER/fastrev.git
   git push -u origin main
   ```

2. At [vercel.com/new](https://vercel.com/new): **Import** the GitHub repo (framework auto-detected: **Vite**).
3. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy.** Build command `npm run build`, output directory `dist` (defaults).
5. In **Supabase → Authentication → URL Configuration**, add your Vercel domain to *Site URL* and *Redirect URLs* (`https://your-app.vercel.app`).
6. Verify in production: sign up → create a deck → generate cards (Settings key) → run a review → open Analytics.

## Security

Full findings, severities and statuses live in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md);
deployment gates live in [`PRODUCTION_CHECKLIST.md`](PRODUCTION_CHECKLIST.md).
The short version:

- **Authorization is enforced in the database (RLS)**, not in the frontend.
  Route guards only hide UI; every read/write is scoped by
  `auth.uid() = user_id` policies plus the Phase 12 ownership triggers
  (a card can only reference your own deck, a review log only your own card).
  Always keep RLS enabled (verification SQL: [supabase/README.md](supabase/README.md) § 4).
- **Security headers** ship via [`vercel.json`](vercel.json): a Content-Security-Policy
  (`script-src 'self'` — that is why the theme bootstrap is an external
  `public/theme-init.js`), `frame-ancestors 'none'` / `X-Frame-Options: DENY`
  (clickjacking), `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP
  and HSTS. The `connect-src` allowlist covers Supabase + the three AI providers;
  **if you enable Vercel Analytics/Speed Insights or move Supabase to a custom
  domain, add those origins to the CSP or they will be blocked.**
- **Secrets:** only `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` exist, both
  client-safe by design (RLS is the boundary). AI keys live in the user's
  localStorage and are sent only to their provider. No service-role key exists
  in this repo — never add one to a `VITE_*` variable.
- **Input limits:** deck/card/notes fields are length-capped in the UI *and*
  by database `CHECK` constraints; imports are size-capped (10 MB images,
  25 MB documents); AI output is count/length-capped before saving.
- **Errors:** production builds show friendly copy only — raw database/API
  messages render in development builds for debugging.
- Supabase Free has **no automatic backups** — export your data periodically
  if it matters (Supabase CLI `db dump` or dashboard export).

## Free-tier limits & how to avoid them

| Service | Limit | Avoidance |
| --- | --- | --- |
| Supabase Free | 500 MB DB, pauses after ~7 days idle | Text-only cards (~1 KB each); cron ping above |
| Gemini / Groq / Cerebras | Per-minute/daily request caps | Built-in fallback chain + own-keys-in-localStorage rotation |
| Vercel Hobby | Non-commercial use, fair-use bandwidth | Static build, no server functions needed |
| cron-job.org | Free tier allows several jobs | One job every 5 days is plenty |

No paid services are used anywhere in this project.

## Project structure

```
src/
  pages/        Auth, Dashboard, Decks (+ DeckList content), DeckDetail,
                Review, Upload, Analytics, Settings (+ SettingsPage)
  hooks/        useAuth, useDecks, useCards, useReviews, useAnalytics
  lib/          supabase client, fsrs wrapper, ai provider chain, file
                extraction, nav/ratings/theme configs, error + auth-form mapping
  components/   AppShell + nav, review set, upload set, shared states,
                ui/ (shadcn primitives)
supabase/
  schema.sql              run in SQL Editor (tables + RLS + hardening)
  migrations/  0001_initial_schema.sql, 0002_authorization_hardening.sql
vercel.json     production security headers (CSP, clickjacking, …)
```

See `PROJECT_CONTEXT.md` for the full annotated tree and routes.

## Design system

- **Tailwind CSS v4, CSS-first** — every color/type/radius token lives in
  `src/index.css` (`@theme inline` + `:root` / `.dark`, oklch). There is
  **no `tailwind.config.js`** and none may be added; components use semantic
  utilities (`bg-primary`, `text-muted-foreground`, `bg-success`, …), never
  hardcoded colors.
- **Dark mode** via a `.dark` class on `<html>`, applied before first paint by
  the external `public/theme-init.js` (external on purpose — the CSP allows no
  inline scripts), persisted in localStorage with an OS-preference fallback.
- **Typography:** Inter Variable, fixed 12/14/16/18/24/32/48 px scale.
- **Motion:** `tw-animate-css` + CSS transitions only (no animation library);
  a global `prefers-reduced-motion` clamp neutralizes all animation for users
  who ask for it.
- **Notifications:** sonner toasts, bottom-center above the mobile nav,
  styled entirely with design tokens (success for CRUD/save, error for
  delete failures; validation errors stay inline next to their field).

## Accessibility

Practices in place (each verified in the phase audits, not a formal
certification): keyboard navigation with visible focus rings on every
control; semantic HTML landmarks (`nav`/`main`/lists/headings) with a single
`<h1>` per layout; ARIA labels on icon-only buttons, live regions for review
announcements, `role="progressbar"`/`aria-busy` where state is shown; form
labels + `aria-invalid`/`aria-describedby` inline errors; ≥4.5:1 text and
≥3:1 control-boundary contrast in **both** light and dark themes (contrast
audited pairwise every UI phase); reduced-motion support; no meaning
conveyed by color alone; touch targets at or above the project's 30 px floor
(dialog close and file-browse buttons were raised to it in Phase 13).

## Responsive support

Mobile-first: single `lg` (1024 px) breakpoint switches the bottom tab bar →
sidebar. Verified from 375 px to 1440 px (including the 639/640, 767/768 and
1023/1024 edges) in the Phase 13 harness — see `CROSS_BROWSER_QA.md` for the
exact matrix, tested browsers and what was **not** tested.

## Testing & verification

There is **no automated test runner** in this project (no `npm run test`) —
verification is lint + build + scripted smoke checks + audits:

| Check | Command / document |
| --- | --- |
| Lint | `npm run lint` (oxlint; 1 tolerated pre-existing warning) |
| Build | `npm run build` |
| Usability | `USABILITY_AUDIT.md` (18 issues, statuses) |
| Performance | `PERFORMANCE_AUDIT.md` (Lighthouse lab runs) |
| Security | `SECURITY_AUDIT.md` + `PRODUCTION_CHECKLIST.md` |
| Cross-browser / device | `CROSS_BROWSER_QA.md` (179/179 harness checks) |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Could not find the table 'public.decks' in the schema cache" | Run `supabase/schema.sql` in the SQL Editor; confirm `.env`/Vercel vars point at that project; reload the schema cache (Dashboard → Settings → API → Reload schema). |
| App says "isn't configured yet" | Production build was made without `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — set them in Vercel and redeploy. |
| AI generation says rate-limited | Normal on free tiers — add fallback keys (Groq/Cerebras) in Settings, or wait for the quota reset. Gemini-only image import has no fallback. |
| Supabase project paused | Free tier pauses after ~7 days idle — use the cron ping above. |
| `.env` changes not picked up | Restart `npm run dev` (Vite reads `.env` at startup). |
| CSP blocks a new third-party service | Add its origin to `connect-src`/`script-src` in `vercel.json` **before** enabling it. |
| Import does nothing / errors | Check the file type and size limits (10 MB images, 25 MB documents); scanned PDFs have no text layer — screenshot them and import as an image. |

## Documentation map

| File | Purpose |
| --- | --- |
| `README.md` (this file) | setup, deploy, troubleshooting |
| `DEVELOPER_HANDOFF.md` | fastest on-ramp for a new developer |
| `PROJECT_CONTEXT.md` | current state, conventions, recovery instructions |
| `PROJECT_ARCHITECTURE.md` | current architecture summary |
| `AGENTS.md` / `architecture.md` | canonical long-form: full phase history / full architecture |
| `USABILITY_AUDIT.md` · `PERFORMANCE_AUDIT.md` · `SECURITY_AUDIT.md` · `CROSS_BROWSER_QA.md` | evidence-backed audits (statuses per finding) |
| `PRODUCTION_CHECKLIST.md` | deploy gates — only verified items are checked |
