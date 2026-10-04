# FastRev — Student Review System

A free-tier flashcard app: paste your notes, let AI turn them into atomic flashcards, and review daily with FSRS spaced repetition.

## Features

- **Auth** — email/password sign-in via Supabase Auth (RLS-protected data)
- **Decks** — create, rename, and delete decks; cards live inside decks
- **AI card generation** — paste notes → 10–15 flashcards, editable before saving. Provider chain: **Google Gemini 2.5 Flash → Groq (Llama 3.3 70B) → Cerebras**, so hitting one free-tier limit falls through to the next
- **Reviews** — one card at a time, rated Again / Hard / Good / Easy, scheduled by **FSRS** (`ts-fsrs`)
- **Analytics** — retention rate, total reviews, current streak, cards learned, a 7-day due forecast (bar chart), 14-day review activity (line chart), and weakest decks by accuracy
- **Polish** — loading skeletons, empty states everywhere, global error boundary, mobile-first responsive layout

## Tech stack

React 19 + Vite 8 · Tailwind CSS v4 · shadcn/ui (JavaScript mode) · Supabase (PostgreSQL + Auth + RLS) · ts-fsrs · Recharts · react-router-dom · Vercel hosting

## Local setup

1. **Prerequisites:** Node 20.19+ (Node 22 LTS or newer recommended) and npm.
2. Install dependencies:

   ```sh
   npm install
   ```

3. Create `.env` in the project root:

   ```env
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

   Both values come from **Supabase Dashboard → Project Settings → API**. The app boots with placeholder warnings if these are empty, but auth and data need real values.

4. Run the dev server:

   ```sh
   npm run dev
   ```

   Other scripts: `npm run build` (production build), `npm run preview` (serve the build), `npm run lint` (oxlint).

## Supabase setup

1. Create a free project at [supabase.com](https://supabase.com) (Free tier).
2. Open **SQL Editor → New query**, paste the entire contents of
   [`supabase/migrations/0001_initial_schema.sql`](supabase/migrations/0001_initial_schema.sql), and run it.
   - Creates `decks`, `cards`, `review_logs` + indexes.
   - Enables **RLS** on all three tables with `auth.uid() = user_id` policies (select/insert/update/delete) — each user sees only their own rows.
   - Safe to re-run (drops policies before recreating them).
3. **Email confirmation:** Dashboard → **Authentication → Email** → turn **Confirm email** *off* for smooth testing (leave it on for production if you prefer).
4. Put the project URL and anon key into `.env` (see above).

> The anon key is safe to expose in the client — RLS is what protects the data.

## AI provider setup (free tiers)

Open the app → **Settings** (Dashboard or Upload page) and paste one or more keys. Keys are stored **only in your browser's localStorage** and are sent only to that provider's own endpoint — never to Supabase or any other server.

| Provider | Key source | Used |
| --- | --- | --- |
| Gemini 2.5 Flash | [Google AI Studio](https://aistudio.google.com/apikey) | First choice |
| Groq Llama 3.3 70B | [console.groq.com/keys](https://console.groq.com/keys) | Fallback |
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
  pages/        Auth, Dashboard, DeckList, DeckDetail, Review, Upload, Settings, Analytics
  hooks/        useAuth, useDecks, useCards, useReviews, useAnalytics
  lib/          supabase client, fsrs wrapper, ai provider chain
  components/   ui/ (shadcn), ErrorBoundary
supabase/
  migrations/   0001_initial_schema.sql (run in SQL Editor)
```
