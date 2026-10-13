// generate-cards — secure AI flashcard generation (Phase 3: providers live).
//
// Browser → this Edge Function → Groq → Cerebras → Gemini.
// The browser NEVER calls a provider directly and NEVER holds a provider key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";
import { validateNotes } from "./validation.ts";
import {
  generateCardsWithChain,
  type ProviderKeys,
} from "./providers.ts";
import {
  claimSlot,
  finalizeSlot,
  quotaMessage,
  readQuotaConfig,
} from "./quota.ts";
import {
  corsHeaders,
  isOriginAllowed,
  jsonError,
  jsonOk,
  parseAllowlist,
} from "./response.ts";

// --- Provider interface (Phase 3: live chain Groq → Cerebras → Gemini) --------
// Model IDs + secrets live in providers.ts (verified 2026-10-13). Each entry
// reads its key lazily from Deno env so a missing secret is a deploy-time
// 501, never a hardcoded or leaked value.

export function hasAnyProvider(): boolean {
  return ["GROQ_API_KEY", "CEREBRAS_API_KEY", "GEMINI_API_KEY"].some((name) =>
    Boolean(Deno.env.get(name))
  );
}

function providerKeys(): ProviderKeys {
  return {
    groq: Deno.env.get("GROQ_API_KEY") ?? "",
    cerebras: Deno.env.get("CEREBRAS_API_KEY") ?? "",
    gemini: Deno.env.get("GEMINI_API_KEY") ?? "",
  };
}

// --- Quota enforcement lives in quota.ts (atomic claim + finalize) ----------
// Will call claim_ai_generation_slot() (migration 0004) with the verified
// user id and map AI_GENERATION_QUOTA_EXCEEDED → 429 quota_exceeded.

// --- Handler ----------------------------------------------------------------

async function handler(req: Request): Promise<Response> {
  const origin = req.headers.get("origin");
  const allowlist = parseAllowlist(Deno.env.get("ALLOWED_ORIGINS"));

  // Preflight first — no auth needed, but the origin must still allowlist.
  if (req.method === "OPTIONS") {
    if (!isOriginAllowed(origin, allowlist)) {
      return jsonError(null, 403, "origin_not_allowed", "Origin not allowed.");
    }
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonError(origin, 405, "invalid_method", "Use POST with a JSON body.");
  }

  if (!isOriginAllowed(origin, allowlist)) {
    return jsonError(null, 403, "origin_not_allowed", "Origin not allowed.");
  }

  // --- Authentication: verify the Supabase JWT, never trust the body -------
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonError(origin, 401, "missing_auth", "Missing bearer token. Sign in and try again.");
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return jsonError(origin, 401, "missing_auth", "Missing bearer token. Sign in and try again.");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) {
    // Server misconfiguration — generic copy, no internals leak.
    console.error("generate-cards: SUPABASE_URL/ANON_KEY not configured");
    return jsonError(origin, 500, "server_error", "Generation is temporarily unavailable.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser();
  // Log outcome only — never the token.
  if (error || !data.user) {
    console.warn("generate-cards: rejected invalid token");
    return jsonError(origin, 401, "invalid_token", "Session is invalid or expired. Sign in again.");
  }
  const userId = data.user.id;

  // --- Body: JSON with validated notes --------------------------------------
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("generate-cards: malformed JSON", { userId });
    return jsonError(origin, 400, "invalid_json", "Request body must be valid JSON.");
  }
  const notesInput =
    body !== null && typeof body === "object"
      ? (body as Record<string, unknown>)["notes"]
      : undefined;
  const validated = validateNotes(notesInput);
  if (!validated.ok) {
    // 400 either way; codes let the client pick copy without raw detail.
    console.warn("generate-cards: notes rejected", { userId, code: validated.code });
    return jsonError(origin, 400, validated.code, validated.message);
  }

  // --- Quota: atomic claim BEFORE any provider spend ------------------------
  // The slot reserves one success from the verified user's daily budget.
  // service_role is server-only (Edge Function env, auto-injected on
  // deploy) and is used ONLY for this ledger access — never returned,
  // never logged, never sent to the browser.
  const quotaCfg = readQuotaConfig((key) => Deno.env.get(key));
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceRoleKey) {
    console.error("generate-cards: SUPABASE_SERVICE_ROLE_KEY not configured");
    return jsonError(origin, 500, "server_error", "Generation is temporarily unavailable.");
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  let claim;
  try {
    claim = await claimSlot(admin, userId, quotaCfg);
  } catch {
    // Client-level DB failure (not a quota verdict) → generic 500.
    console.error("generate-cards: quota check failed", { userId });
    return jsonError(origin, 500, "server_error", "Generation is temporarily unavailable.");
  }
  if (!claim.allowed) {
    if (claim.reason === "server_error") {
      console.error("generate-cards: quota check failed", { userId });
      return jsonError(origin, 500, "server_error", "Generation is temporarily unavailable.");
    }
    console.warn("generate-cards: quota denied", { userId, reason: claim.reason });
    return jsonError(origin, 429, "quota_exceeded", quotaMessage(claim.reason, quotaCfg));
  }
  const slot = { slotId: claim.slotId, userId };

  // --- Provider chain: Groq → Cerebras → Gemini (server-side only) ---------
  if (!hasAnyProvider()) {
    // Generic message on purpose: never reveal which secrets exist.
    console.error("generate-cards: no provider secret configured");
    return jsonError(
      origin,
      501,
      "provider_not_configured",
      "Generation is not configured yet. Try again later.",
    );
  }

  const result = await generateCardsWithChain(validated.notes, providerKeys());
  if (!result.ok) {
    // Friendly + generic: kinds are logged server-side, never sent out.
    // No provider bodies, status codes, or key hints leave this function.
    console.error(
      "generate-cards: all providers failed",
      { userId, kinds: result.failures.map((f) => `${f.provider}:${f.kind}`) },
    );
    // Release the reservation: a provider failure must not consume the
    // user's success quota (it still counts toward the attempt ceiling).
    // Two attempts: one transport blip must not strand the slot until TTL.
    const released = await finalizeSlot(admin, slot, {
      status: "failed",
      tokens: null,
      provider: null,
      cards: 0,
    }, 2);
    if (!released) {
      console.error("generate-cards: failed to release reservation", { userId });
    }
    return jsonError(
      origin,
      502,
      "provider_failure",
      "Couldn't generate cards right now. Try again in a minute.",
    );
  }

  // Finalize the reservation with real usage (null tokens = provider did
  // not report any → row keeps 0 "unknown"). A ledger hiccup here must not
  // fail an already-generated response: retry once, then log and continue.
  // (Trade-off, documented: prolonged DB outage under-counts successes —
  // fail-open accounting, fail-safe UX. The reservation then expires via
  // TTL instead of counting. Alert on repeated finalize failures.)
  const finalized = await finalizeSlot(admin, slot, {
    status: "completed",
    tokens: result.usage?.total ?? null,
    provider: result.provider,
    cards: result.cards.length,
  }, 2);
  if (!finalized) {
    console.error("generate-cards: failed to finalize reservation", { userId });
  }

  console.log(
    "generate-cards: success",
    { userId, provider: result.provider, cards: result.cards.length },
  );
  return jsonOk(origin, { cards: result.cards, provider: result.provider });
}

// Structured request log carries user + outcome only — never notes, tokens,
// prompts, provider keys, or raw provider payloads.
Deno.serve((req: Request) => {
  const start = Date.now();
  return handler(req).then((res) => {
    console.log(
      JSON.stringify({
        fn: "generate-cards",
        method: req.method,
        status: res.status,
        ms: Date.now() - start,
      }),
    );
    return res;
  });
});
