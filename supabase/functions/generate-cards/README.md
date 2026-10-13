# generate-cards Edge Function (Phase 3: provider chain live)

Browser → this function → Groq → Cerebras → Gemini.
All provider requests and keys stay on the server.

## Secrets (never in code, never in `.env`, never in the frontend)

Set on the **server only**:

```bash
supabase secrets set GROQ_API_KEY=... CEREBRAS_API_KEY=... GEMINI_API_KEY=...
supabase secrets set ALLOWED_ORIGINS=https://your-app.vercel.app
```

- `GROQ_API_KEY` / `CEREBRAS_API_KEY` / `GEMINI_API_KEY` — read via
  `Deno.env.get` at request time. At least one must exist or every
  request is a 501 (generic message — never reveals which secrets exist).
- `ALLOWED_ORIGINS` — comma-separated exact origins allowed through CORS.
  Unset → local-dev defaults only (`localhost`/`127.0.0.1` on `:5173`,
  `:3000`). **Set this to the Vercel domain before going live**, or
  browsers will get `403 origin_not_allowed` on every call.
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` are auto-injected by the Functions
  runtime (used only to validate the caller's JWT). `SUPABASE_SERVICE_ROLE_KEY`
  is likewise auto-injected on deploy — for local serve, put a test value in
  `.env.local`. It is used ONLY for the quota ledger (`claim` / `finalize`
  RPCs); it never leaves the function. No `service_role` usage anywhere else.
- Quota tuning (server-only, never visible to the browser):
  `AI_DAILY_LIMIT` (default 20 successful generations per UTC day),
  `AI_ATTEMPT_LIMIT` (default 60 attempts/day — bounds retry-abuse),
  `AI_RESERVATION_TTL_MINUTES` (default 10 — abandoned reservations stop
  counting after this). Invalid values fall back to defaults.

Do NOT put provider keys in the Vite `.env` — anything there ships in the
browser bundle. Do NOT set `verify_jwt = false` in `supabase/config.toml`.

## Quota design (Phase 4)

Reservation-and-finalization against `ai_generations` (migration 0004):
claim a `reserved` slot BEFORE any provider request (atomic check + insert
under a per-user advisory lock — concurrent requests serialize, the limit
cannot overshoot) → provider success finalizes to `completed` with real
token usage (null when the provider reports none → stays "unknown", never
invented) → provider failure finalizes to `failed` (releases success quota
but still counts toward the attempt ceiling). Crashed requests leave
`reserved` rows that expire after the TTL and are lazily marked `expired`
by the next claim — no cron needed. Limit counts successes per UTC calendar
day; over-quota answers `429 quota_exceeded` with a friendly message.

## Serve locally

Requires the Supabase CLI (not installed in this environment):

```bash
supabase start
supabase functions serve generate-cards --env-file supabase/functions/generate-cards/.env.local
```

`.env.local` (gitignored, create it yourself — never commit) holds the same
names as above plus a test `ALLOWED_ORIGINS=http://localhost:5173`.

## Contract

- Success: `200 { "cards": [{ "question", "answer", "source" }], "provider" }`
  (`provider` is `groq` / `cerebras` / `gemini` — the chain member that
  served the request).
- Failure: `{ "error": { "code", "message" } }` — codes in `response.ts`
  (`invalid_method 405`, `invalid_json` / `missing_notes` / `notes_too_long`
  400, `missing_auth` / `invalid_token` 401, `origin_not_allowed` 403,
  `quota_exceeded` 429, `server_error` 500, `provider_not_configured` 501
  (no secrets set), `provider_failure` 502 (all providers failed —
  generic copy, no provider internals leak)).
  Limits: `notes` non-empty string, ≤ 5,000 words, ≤ 60,000 chars.

## Provider chain (Phase 3 — model IDs verified 2026-10-13)

| Order | Provider | Model | Endpoint |
|---|---|---|---|
| 1 (primary) | Groq | `openai/gpt-oss-120b` | `api.groq.com/openai/v1/chat/completions` |
| 2 (fallback) | Cerebras | `gpt-oss-120b` | `api.cerebras.ai/v1/chat/completions` |
| 3 (fallback) | Gemini | `gemini-3.8-flash` | `generativelanguage.../models/gemini-3.8-flash:generateContent` |

All in `providers.ts` (pure module, fetch-injectable, tested with mocks —
see the Phase 3 report). Rules: one attempt per provider, no retries; every
provider-side failure (network, timeout at 30 s, 429, 503/529/504,
invalid key, malformed/unusable output) falls through to the next provider;
output validated server-side (whitelisted `question`/`answer`/`source`
fields only, ≤ 40 cards, DB length caps) before returning. If a provider
starts 404ing, its model ID likely retired — re-check the provider docs.

## Manual checks (curl; JWT steps need a signed-in session token)

```bash
BASE=http://127.0.0.1:54321/functions/v1/generate-cards

# Preflight (allowed origin)
curl -i -X OPTIONS $BASE -H "Origin: http://localhost:5173"

# No token → 401 missing_auth
curl -i -X POST $BASE -H "Content-Type: application/json" -d '{"notes":"x"}'

# Bad token → 401 invalid_token
curl -i -X POST $BASE -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid" -d '{"notes":"Photosynthesis..."}'

# Malformed JSON → 400 invalid_json (with a real token)
# Missing notes → 400 missing_notes; empty string likewise
# > 5,000 words or > 60,000 chars → 400 notes_too_long

# Valid curl (with a real token) → 501 provider_not_configured
curl -i -X POST $BASE -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" -d '{"notes":"Photosynthesis..."}'

# With ≥1 provider secret set → 200 { cards: [...], provider }
# With all providers down → 502 provider_failure (generic copy)
```

Get `$TOKEN` from a signed-in browser session
(`supabase.auth.getSession()` → `session.access_token` in devtools).
