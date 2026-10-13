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

### Edge Function track — quota finalization (Phase 4)

Apply [`migrations/0004_ai_generation_quota.sql`](./migrations/0004_ai_generation_quota.sql)
the same way, AFTER 0003. It adds the `status` ledger column
(`reserved`/`completed`/`failed`/`expired`), upgrades the claim function to
success-counted UTC-day quota + attempt ceiling + TTL expiry, and adds
`finalize_ai_generation_slot()` (both functions service-role-only). Safe to
re-run; verification queries are commented at the bottom of the file.

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
