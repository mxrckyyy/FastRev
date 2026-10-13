// Pure HTTP helpers for the generate-cards Edge Function:
// consistent JSON error contract + strict allowlist CORS.
//
// No remote imports — runs under Deno AND under Node >= 22 type-stripping,
// so the contract below is unit-testable without the Supabase CLI.

// --- Error contract -------------------------------------------------------
// Every failure is `{ "error": { "code", "message" } }` with a status:
//   400 invalid_json | missing_notes | notes_too_long | invalid_method*
//   401 missing_auth | invalid_token
//   403 origin_not_allowed
//   429 quota_exceeded            (wired in the quota phase, defined here)
//   500 server_error              (server misconfiguration, generic copy)
//   501 provider_not_configured   (until provider wiring lands)
//   502 provider_failure          (provider wiring phase)
//   * invalid_method is returned as 405; the code stays in the same shape.

export type ErrorCode =
  | "invalid_method"
  | "invalid_json"
  | "missing_notes"
  | "notes_too_long"
  | "missing_auth"
  | "invalid_token"
  | "origin_not_allowed"
  | "quota_exceeded"
  | "server_error"
  | "provider_not_configured"
  | "provider_failure";

/** Local dev origins allowed when ALLOWED_ORIGINS is unset. */
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

/**
 * Parse the ALLOWED_ORIGINS env var (comma-separated, whitespace tolerated)
 * into an exact-match set. Empty entries are dropped; entries with a
 * trailing slash are normalized. Unset/empty → local-dev defaults.
 */
export function parseAllowlist(raw: string | undefined): Set<string> {
  if (!raw || raw.trim().length === 0) return new Set(DEFAULT_ORIGINS);
  const origins = raw
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return new Set(origins.length > 0 ? origins : DEFAULT_ORIGINS);
}

/**
 * Exact-match origin check. Deliberately NOT a substring/endsWith match:
 * `https://evil-example-vercel.app` must never match an allowlist entry
 * for `https://example-vercel.app`. Requests with no Origin header
 * (curl, server-to-server) are not cross-origin and pass through.
 */
export function isOriginAllowed(
  origin: string | null,
  allowlist: Set<string>,
): boolean {
  if (!origin) return true;
  return allowlist.has(origin.replace(/\/+$/, ""));
}

/** CORS headers for an allowed request. No ACAO header for disallowed ones. */
export function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

/** Build a contract-shaped JSON error response (CORS headers included). */
export function jsonError(
  origin: string | null,
  status: number,
  code: ErrorCode,
  message: string,
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

/** Build a contract-shaped JSON success response (CORS headers included). */
export function jsonOk(origin: string | null, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}
