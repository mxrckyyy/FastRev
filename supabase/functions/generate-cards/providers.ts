// Server-side AI provider chain for generate-cards: Groq → Cerebras → Gemini.
//
// Model IDs verified against live provider docs on 2026-10-13:
//   Groq     `openai/gpt-oss-120b` — Production model (Groq docs /docs/models).
//   Cerebras `gpt-oss-120b`        — Shared Inference catalog lists ONLY
//            gpt-oss-120b + qwen-3.8-27b; `llama-3.3-70b` is GONE, so the old
//            frontend pin must NOT be reused here (frontend still carries it
//            until the frontend refactor — see report).
//   Gemini   `gemini-3.8-flash`    — current stable Flash (Google models page).
// Re-check these IDs when the chain mysteriously skips a provider: a retired
// model surfaces as a plain HTTP 404, which correctly falls through below.
//
// Pure module: no remote imports, no Deno APIs. `fetchImpl` defaults to the
// global fetch and is injectable in tests. Generated content is only ever
// JSON-parsed (never eval'd / executed) and only whitelisted fields survive.

export const PROVIDER_ORDER = ["groq", "cerebras", "gemini"] as const;
export type ProviderId = (typeof PROVIDER_ORDER)[number];

export const PROVIDER_SECRETS: Record<ProviderId, string> = {
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
};

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";
const GEMINI_MODEL = "gemini-3.8-flash";
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Output bounds mirror the DB CHECKs (migration 0002) and the frontend caps
// (ai.js) so a runaway model response can never create oversized rows.
const MAX_CARDS = 40;
const MAX_QUESTION_LENGTH = 2000;
const MAX_ANSWER_LENGTH = 2000;
const MAX_SOURCE_LENGTH = 500;

/** Per-provider budget: one attempt each, no retry loops, no backoff chains. */
const REQUEST_TIMEOUT_MS = 30000;

/** Refuse absurd payloads before JSON.parse (normal output is ~10 KB). */
const MAX_BODY_CHARS = 1000000;

export interface Card {
  question: string;
  answer: string;
  source: string;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export type FailureKind =
  | "rate_limit"
  | "unavailable"
  | "invalid_key"
  | "network"
  | "timeout"
  | "malformed"
  | "provider_error";

export interface ProviderFailure {
  provider: ProviderId;
  kind: FailureKind;
  status?: number;
}

export interface ChainSuccess {
  ok: true;
  cards: Card[];
  provider: ProviderId;
  usage: TokenUsage | null;
  failures: ProviderFailure[];
}

export interface ChainFailure {
  ok: false;
  failures: ProviderFailure[];
}

export type ChainResult = ChainSuccess | ChainFailure;

export type FetchImpl = typeof fetch;

// --- Prompt + parsing (same proven shape as the frontend ai.js) --------------

function buildPrompt(notes: string): string {
  return [
    "You are an expert flashcard writer. Extract 10 to 15 atomic concepts from the study notes below.",
    "Each card must cover exactly one concept: a clear question and a concise answer.",
    "",
    "Return ONLY a JSON array (no markdown fences, no commentary) where each element is:",
    '{ "question": "...", "answer": "...", "source": "short reference to where it came from in the notes" }',
    "",
    "Rules:",
    "- Between 10 and 15 cards.",
    '- "source" must be a short excerpt, heading, or topic from the notes (use "notes" if none applies).',
    "- Answers must be self-contained and short enough to read at a glance.",
    "",
    "Study notes:",
    '"""',
    notes,
    '"""',
  ].join("\n");
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

/**
 * Whitelist fields: unexpected keys are DROPPED (never rejected — extra keys
 * can't break the app once stripped), oversized values truncated to the DB
 * limits, rows without a real question+answer discarded.
 */
function normalizeCard(candidate: unknown): Card | null {
  if (!candidate || typeof candidate !== "object") return null;
  const row = candidate as Record<string, unknown>;
  const question = typeof row["question"] === "string" ? row["question"].trim() : "";
  const answer = typeof row["answer"] === "string" ? row["answer"].trim() : "";
  if (!question || !answer) return null;
  const source = typeof row["source"] === "string" ? row["source"].trim() : "";
  return {
    question: question.slice(0, MAX_QUESTION_LENGTH),
    answer: answer.slice(0, MAX_ANSWER_LENGTH),
    source: source.slice(0, MAX_SOURCE_LENGTH),
  };
}

/** Returns validated cards, or null when the text holds nothing usable. */
function parseCards(rawText: string): Card[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(rawText));
  } catch {
    return null;
  }
  const list = Array.isArray(parsed)
    ? parsed
    : parsed !== null && typeof parsed === "object" &&
        Array.isArray((parsed as Record<string, unknown>)["cards"])
      ? (parsed as Record<string, unknown>)["cards"] as unknown[]
      : null;
  if (!list) return null;
  const cards = list.slice(0, MAX_CARDS).map(normalizeCard).filter(
    (card): card is Card => card !== null,
  );
  return cards.length > 0 ? cards : null;
}

// --- Transport ---------------------------------------------------------------

function timeoutSignal(): AbortSignal | undefined {
  if (typeof AbortSignal !== "undefined" && AbortSignal.timeout) {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  }
  return undefined;
}

function classifyStatus(status: number, body: string): FailureKind {
  if (status === 429) return "rate_limit";
  if (status === 503 || status === 529 || status === 504) return "unavailable";
  if (status === 401 || status === 403) return "invalid_key";
  if (/api[_ ]key|unauthorized|permission|forbidden/i.test(body)) return "invalid_key";
  return "provider_error";
}

function readUsageOpenAI(payload: Record<string, unknown>): TokenUsage | null {
  const usage = payload["usage"];
  if (!usage || typeof usage !== "object") return null;
  const u = usage as Record<string, unknown>;
  if (
    typeof u["prompt_tokens"] !== "number" ||
    typeof u["completion_tokens"] !== "number"
  ) return null;
  return {
    prompt: u["prompt_tokens"],
    completion: u["completion_tokens"],
    total: typeof u["total_tokens"] === "number"
      ? u["total_tokens"]
      : u["prompt_tokens"] + u["completion_tokens"],
  };
}

function readUsageGemini(payload: Record<string, unknown>): TokenUsage | null {
  const meta = payload["usageMetadata"];
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  if (
    typeof m["promptTokenCount"] !== "number" ||
    typeof m["candidatesTokenCount"] !== "number"
  ) return null;
  return {
    prompt: m["promptTokenCount"],
    completion: m["candidatesTokenCount"],
    total: typeof m["totalTokenCount"] === "number"
      ? m["totalTokenCount"]
      : m["promptTokenCount"] + m["candidatesTokenCount"],
  };
}

async function callOpenAiCompatible(
  url: string,
  model: string,
  provider: ProviderId,
  notes: string,
  key: string,
  fetchImpl: FetchImpl,
): Promise<{ cards: Card[]; usage: TokenUsage | null }> {
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: "You output ONLY a JSON array of flashcards. No markdown, no explanation.",
          },
          { role: "user", content: buildPrompt(notes) },
        ],
      }),
      signal: timeoutSignal(),
    });
  } catch (error) {
    // Network failure OR our own timeout abort — either way, next provider.
    const kind: FailureKind = error instanceof DOMException &&
        error.name === "AbortError"
      ? "timeout"
      : "network";
    throw { provider, kind } as ProviderFailure;
  }
  const bodyText = await response.text();
  if (!response.ok) {
    throw {
      provider,
      kind: classifyStatus(response.status, bodyText.slice(0, 500)),
      status: response.status,
    } as ProviderFailure;
  }
  if (bodyText.length > MAX_BODY_CHARS) throw { provider, kind: "malformed" } as ProviderFailure;
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw { provider, kind: "malformed" } as ProviderFailure;
  }
  const choices = (payload as { choices?: Array<{ message?: { content?: unknown } }> })["choices"];
  const content = choices?.[0]?.["message"]?.["content"];
  if (typeof content !== "string" || !content.trim()) {
    throw { provider, kind: "malformed" } as ProviderFailure;
  }
  const cards = parseCards(content);
  if (!cards) throw { provider, kind: "malformed" } as ProviderFailure;
  return {
    cards,
    usage: readUsageOpenAI(payload as Record<string, unknown>),
  };
}

async function callGemini(
  notes: string,
  key: string,
  fetchImpl: FetchImpl,
): Promise<{ cards: Card[]; usage: TokenUsage | null }> {
  let response: Response;
  try {
    response = await fetchImpl(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(notes) }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: timeoutSignal(),
    });
  } catch (error) {
    const kind: FailureKind = error instanceof DOMException &&
        error.name === "AbortError"
      ? "timeout"
      : "network";
    throw { provider: "gemini", kind } as ProviderFailure;
  }
  const bodyText = await response.text();
  if (!response.ok) {
    throw {
      provider: "gemini",
      kind: classifyStatus(response.status, bodyText.slice(0, 500)),
      status: response.status,
    } as ProviderFailure;
  }
  if (bodyText.length > MAX_BODY_CHARS) {
    throw { provider: "gemini", kind: "malformed" } as ProviderFailure;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw { provider: "gemini", kind: "malformed" } as ProviderFailure;
  }
  const parts = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> })
    ["candidates"]?.[0]?.["content"]?.["parts"] ?? [];
  const text = parts.map((part) => typeof part.text === "string" ? part.text : "").join("");
  if (!text.trim()) throw { provider: "gemini", kind: "malformed" } as ProviderFailure;
  const cards = parseCards(text);
  if (!cards) throw { provider: "gemini", kind: "malformed" } as ProviderFailure;
  return {
    cards,
    usage: readUsageGemini(payload as Record<string, unknown>),
  };
}

// --- Chain -------------------------------------------------------------------

export interface ProviderKeys {
  groq?: string;
  cerebras?: string;
  gemini?: string;
}

/** Providers with a configured key, in chain order. Empty key = skipped. */
export function chainForKeys(keys: ProviderKeys): ProviderId[] {
  return PROVIDER_ORDER.filter((id) => Boolean(keys[id]?.trim()));
}

/**
 * Run the chain: each configured provider tried AT MOST ONCE, in order.
 * EVERY provider-side failure falls through to the next provider (keys are
 * independent, so one provider's outage can never block another), and the
 * first usable card set wins. No retries, no backoff loops.
 */
export async function generateCardsWithChain(
  notes: string,
  keys: ProviderKeys,
  fetchImpl: FetchImpl = fetch,
): Promise<ChainResult> {
  const failures: ProviderFailure[] = [];
  for (const id of chainForKeys(keys)) {
    const key = (keys[id] ?? "").trim();
    try {
      if (id === "gemini") {
        const { cards, usage } = await callGemini(notes, key, fetchImpl);
        return { ok: true, cards, provider: id, usage, failures };
      }
      const url = id === "groq" ? GROQ_URL : CEREBRAS_URL;
      const model = id === "groq" ? GROQ_MODEL : CEREBRAS_MODEL;
      const { cards, usage } = await callOpenAiCompatible(url, model, id, notes, key, fetchImpl);
      return { ok: true, cards, provider: id, usage, failures };
    } catch (error) {
      failures.push(error as ProviderFailure);
    }
  }
  return { ok: false, failures };
}
