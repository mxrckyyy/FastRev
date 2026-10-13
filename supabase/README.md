# Database Schema — How to Apply

The app needs three tables (`decks`, `cards`, `review_logs`). If you see the
error **"Could not find the table 'public.decks' in the schema cache"**, the
schema has not been run in your Supabase project yet.

## 1. Open the SQL Editor

1. Go to <https://supabase.com/dashboard> and select your project.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query** (or use the default scratch query).

## 2. Paste the schema

1. Open [`schema.sql`](./schema.sql) in this folder and copy **all** of its
   contents (or run `Get-Content supabase\schema.sql` / `cat supabase/schema.sql`
   to print it).
2. Paste it into the SQL Editor window, replacing anything that is there.
3. Click **Run** (bottom-right, or `Ctrl+Enter`).
4. You should see `Success. No rows returned` — that means the tables, indexes,
   and RLS policies were created.

The script is safe to re-run: it uses `if not exists` / `drop policy if exists`
throughout, so running it twice changes nothing.

### Existing projects (tables already created)

If the tables already exist, apply the **Phase 12 security hardening** on its
own — [`migrations/0002_authorization_hardening.sql`](./migrations/0002_authorization_hardening.sql)
(same content as the second half of `schema.sql`):

1. Paste it into a new SQL Editor query and **Run**.
2. It adds cross-table ownership triggers (a card may only reference your own
   deck; a review log only your own card) and length `CHECK` constraints.
3. Also safe to re-run.

### Edge Function track — AI usage ledger (Phase 1)

Apply [`migrations/0003_ai_generations.sql`](./migrations/0003_ai_generations.sql)
in the same way (new SQL Editor query → paste → **Run**). It creates the
`ai_generations` usage ledger (read-own-only RLS, no direct client writes)
plus the atomic `claim_ai_generation_slot()` quota function (executable by
the server role only). Safe to re-run. Verify with the commented queries at
the bottom of the file — and note the remote database is only updated once
YOU run it; committing the file does not apply it.

### Edge Function track — quota finalization (Phase 4, corrected by Fix Phase)

Apply [`migrations/0004_ai_generation_quota.sql`](./migrations/0004_ai_generation_quota.sql)
then [`migrations/0005_quota_slot_accounting.sql`](./migrations/0005_quota_slot_accounting.sql)
in the same way, AFTER 0003. Together they add the `status` ledger column
(`reserved`/`completed`/`failed`/`expired`), the success-counted UTC-day
quota + attempt ceiling + TTL expiry, and `finalize_ai_generation_slot()`
(both functions service-role-only). 0005 corrects 0004's success gate to
count held slots (`completed` + active `reserved`) so parallel bursts stop
at the limit — same function signature, no caller changes. Safe to re-run;
verification queries are commented at the bottom of each file.

## 3. Verify the tables were created

**Option A — in the SQL Editor**, run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('decks', 'cards', 'review_logs');
```

You should get three rows back.

## 4. Verify Row Level Security (important)

RLS is what keeps one student's decks private from every other student — the
anon key ships in the public JavaScript bundle on purpose, so this check
matters. In the SQL Editor run:

```sql
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('decks', 'cards', 'review_logs');
```

All three rows must show `relrowsecurity = t`. Then:

```sql
select policyname from pg_policies where schemaname = 'public';
```

should list the per-user policies (`Users can view own decks`, …).

If any table shows `f`, RLS is off and **everyone holding the anon key can
read all rows** — re-run `schema.sql` immediately.

**Option B — check the Table Editor:** click **Table Editor** in the left
sidebar; `decks`, `cards`, and `review_logs` should be listed under `public`.

**Option C — in the app:** refresh your app. The
"Could not find the table 'public.decks'" error disappears and the dashboard
loads (it will show empty decks until you create one).

## Also apply it to a separate dev project

If you use a **second Supabase project** for local development (different URL
than the one in `.env`), repeat steps 1–2 in *that* project's SQL Editor too.
Each Supabase project has its own database — running the schema in production
does not create it in dev.

## After running

- Local: restart `npm run dev` (Vite only reads `.env` at startup).
- Vercel: no redeploy needed for schema changes — the frontend reads tables at
  runtime. Only redeploy if you changed environment variables.

## Deploy the generate-cards Edge Function (Phase 7 runbook)

Prerequisites: Supabase CLI installed + logged in (`supabase login`), and
the three provider secrets ready (at least one — the chain skips missing
ones). **Nothing here is authorized to run itself**: every remote step below
is yours to execute, in order. Never print secret values or put them in
frontend (Vite) variables.

1. **Link the project** (first time only) and confirm the target before any
   remote operation:
   ```bash
   supabase link --project-ref YOUR-PROJECT-REF
   supabase projects list   # confirm the ref matches Dashboard → Project Settings
   ```
2. **Apply migrations** (SQL Editor, in order — or `supabase db push` if the
   project is linked; never `db reset` on a live project):
   `0001_initial_schema.sql` → `0002_authorization_hardening.sql` →
   `0003_ai_generations.sql` → `0004_ai_generation_quota.sql` →
   `0005_quota_slot_accounting.sql`.
   Run each file's commented verification block after applying.
3. **Set secrets** (server-only; `verify_jwt` stays `true` in
   `supabase/config.toml` — never disable it):
   ```bash
   supabase secrets set GROQ_API_KEY=... CEREBRAS_API_KEY=... GEMINI_API_KEY=...
   supabase secrets set ALLOWED_ORIGINS=https://your-app.vercel.app
   # Optional quota tuning (defaults 20 / 60 / 10):
   # supabase secrets set AI_DAILY_LIMIT=20 AI_ATTEMPT_LIMIT=60 AI_RESERVATION_TTL_MINUTES=10
   ```
4. **Deploy** (function only — overwrites nothing else):
   ```bash
   supabase functions deploy generate-cards
   ```
5. **Verify live** (replace `$TOKEN` with a signed-in session's access token):
   - No token → 401 `missing_auth`; bad token → 401 `invalid_token`.
   - `{"notes":"..."}` → 200 `{ cards, provider }` (first success).
   - 21st success same UTC day → 429 `quota_exceeded`.
   - Cross-user check: user B's `select * from ai_generations` shows only B's
     rows; direct `insert` as an authenticated user fails (no write policy).
   - Browser DevTools → Application: no `*_api_key` values in storage;
     Network: generation calls go only to
     `https://YOUR-PROJECT.supabase.co/functions/v1/generate-cards`.
6. **Ship the frontend**: `npm run build` (verified green in Phase 7) →
   deploy `dist/` to Vercel with `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` set at build time.
