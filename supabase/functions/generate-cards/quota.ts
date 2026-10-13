// Quota client for generate-cards: server-side config, atomic claim before
// provider spend, finalize on both outcomes.
//
// Pure module: no remote imports, no Deno APIs. The database handle is a
// minimal structural interface (supabase-js satisfies it); the env reader
// defaults to Deno.env in index.ts and is a stub in tests.

export interface QuotaConfig {
  /** Successful generations per UTC calendar day. */
  dailyLimit: number;
  /** Total attempts (active reserved + completed + failed) per UTC day. */
  attemptLimit: number;
  /** Minutes after which a reservation is treated as abandoned. */
  reservationTtlMinutes: number;
}

export const DEFAULT_QUOTA: QuotaConfig = {
  dailyLimit: 20,
  attemptLimit: 60,
  reservationTtlMinutes: 10,
};

export type EnvReader = (key: string) => string | undefined;

function positiveInt(raw: string | undefined, fallback: number): number {
  // Strict: the whole value must be digits — "20/day" or "1.5x" fall back
  // instead of silently parsing a surprising prefix.
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

/**
 * Server-side quota tuning. These env names are NEVER read by the browser —
 * the values stay in the Edge Function environment, so the limit cannot be
 * raised (or even observed) client-side.
 */
export function readQuotaConfig(getEnv: EnvReader): QuotaConfig {
  return {
    dailyLimit: positiveInt(getEnv("AI_DAILY_LIMIT"), DEFAULT_QUOTA.dailyLimit),
    attemptLimit: positiveInt(getEnv("AI_ATTEMPT_LIMIT"), DEFAULT_QUOTA.attemptLimit),
    reservationTtlMinutes: positiveInt(
      getEnv("AI_RESERVATION_TTL_MINUTES"),
      DEFAULT_QUOTA.reservationTtlMinutes,
    ),
  };
}

export type ClaimOutcome =
  | { allowed: true; slotId: string }
  | { allowed: false; reason: "quota_exceeded" | "attempts_exceeded" }
  | { allowed: false; reason: "server_error" };

export interface RpcError {
  code?: string;
  message: string;
  details?: string;
}

/** Minimal surface used here — satisfied by the supabase-js client. */
export interface QuotaDb {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RpcError | null }>;
}

/**
 * Atomically claim a generation slot for the VERIFIED user id (from
 * supabase.auth.getUser — never a caller-supplied id). Must run BEFORE any
 * provider request so quota is enforced before money is spent.
 */
export async function claimSlot(
  db: QuotaDb,
  userId: string,
  cfg: QuotaConfig,
): Promise<ClaimOutcome> {
  const { data, error } = await db.rpc("claim_ai_generation_slot", {
    p_user_id: userId,
    p_limit: cfg.dailyLimit,
    p_attempt_limit: cfg.attemptLimit,
    p_reservation_ttl_minutes: cfg.reservationTtlMinutes,
  });
  if (!error && typeof data === "string") {
    return { allowed: true, slotId: data };
  }
  if (error && error.code === "P0001") {
    const haystack = `${error.details ?? ""} ${error.message}`;
    if (haystack.includes("AI_GENERATION_ATTEMPT_LIMIT")) {
      return { allowed: false, reason: "attempts_exceeded" };
    }
    return { allowed: false, reason: "quota_exceeded" };
  }
  return { allowed: false, reason: "server_error" };
}

export interface FinalizeOutcome {
  status: "completed" | "failed";
  /** Provider-reported total tokens, or null when unknown (never invented). */
  tokens: number | null;
  provider: string | null;
  cards: number;
}

/**
 * Complete or release a reservation. Returns false when the slot was not
 * in a finalizable state (already finalized, expired, or foreign) — the
 * SQL function enforces slot ownership, so a wrong id/user can never move
 * quota. Callers log-and-continue on false: a ledger hiccup must not fail
 * an already-generated user response.
 *
 * `maxAttempts` bounds retries of TRANSIENT failures (transport errors, not
 * already-finalized no-ops, which return false immediately per attempt but
 * cost nothing). Default 1 preserves single-attempt semantics; the handler
 * passes 2 so one blip does not silently under-count a success.
 */
export async function finalizeSlot(
  db: QuotaDb,
  slot: { slotId: string; userId: string },
  outcome: FinalizeOutcome,
  maxAttempts = 1,
): Promise<boolean> {
  const attempts = Math.max(1, Math.floor(maxAttempts));
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const { data, error } = await db.rpc("finalize_ai_generation_slot", {
        p_slot_id: slot.slotId,
        p_user_id: slot.userId,
        p_status: outcome.status,
        p_tokens: outcome.tokens,
        p_provider: outcome.provider,
        p_cards: outcome.cards,
      });
      if (!error && data === true) return true;
      // Definitive no-op (already finalized / foreign slot returns
      // data === false with no error): retrying cannot change it.
      if (!error) return false;
      // SQL error: possibly transient — fall through to retry.
    } catch {
      // Transport failure — retry while attempts remain.
    }
  }
  return false;
}

/** Friendly copy for 429s. The numeric limit is user-facing (not privileged). */
export function quotaMessage(
  reason: "quota_exceeded" | "attempts_exceeded",
  cfg: QuotaConfig,
): string {
  if (reason === "attempts_exceeded") {
    return "Too many generation attempts today. Try again tomorrow.";
  }
  return `You've used all ${cfg.dailyLimit} AI generations for today. Try again tomorrow.`;
}
