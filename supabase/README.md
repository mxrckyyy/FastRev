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

## 3. Verify the tables were created

**Option A — in the SQL Editor**, run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('decks', 'cards', 'review_logs');
```

You should get three rows back.

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
