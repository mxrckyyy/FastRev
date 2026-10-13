import { supabase } from './supabase'

// Card generation runs server-side (Supabase Edge Function `generate-cards`)
// — the browser never calls an AI provider and never holds a provider key.
// No API key storage, no provider endpoints, and no provider SDKs exist in
// this module (or anywhere else in the frontend).

// Output bounds for AI-generated content (SEC-07). These mirror the DB
// CHECK constraints in supabase/schema.sql so saved cards can never trip
// a server-side limit the client didn't already enforce.
const MAX_CARDS = 40
const MAX_QUESTION_LENGTH = 2000
const MAX_ANSWER_LENGTH = 2000
const MAX_SOURCE_LENGTH = 500

const PROVIDER_LABELS = {
  gemini: 'Google Gemini',
  groq: 'Groq (GPT-OSS 120B)',
  cerebras: 'Cerebras (GPT-OSS 120B)',
}

export class AiError extends Error {
  constructor(code, message, provider) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.provider = provider ?? null
  }
}

// Helper: human-readable name for the provider that produced a result.
export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || 'unknown provider'
}

// --- Server-response validation ---
// The Edge Function already normalizes cards; the client re-validates shape
// defensively (whitelisted fields, DB length caps) before preview/save.

function normalizeServerCard(candidate) {
  if (!candidate || typeof candidate !== 'object') return null
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : ''
  const answer = typeof candidate.answer === 'string' ? candidate.answer.trim() : ''
  if (!question || !answer) return null
  const source = typeof candidate.source === 'string' ? candidate.source.trim() : ''
  return {
    question: question.slice(0, MAX_QUESTION_LENGTH),
    answer: answer.slice(0, MAX_ANSWER_LENGTH),
    source: source.slice(0, MAX_SOURCE_LENGTH),
  }
}

function normalizeServerCards(data) {
  const list = data && typeof data === 'object' && Array.isArray(data.cards)
    ? data.cards
    : null
  if (!list) return null
  const cards = list.slice(0, MAX_CARDS).map(normalizeServerCard).filter(Boolean)
  return cards.length > 0 ? cards : null
}

// --- Public API: card generation via the Edge Function ---

const EDGE_FUNCTION = 'generate-cards'
// The server chain can span up to three providers (30 s each); give it room
// without hanging the UI forever.
const EDGE_TIMEOUT_MS = 95000

// Server error codes (supabase/functions/generate-cards/response.ts). Unknown
// codes fall back to status-based mapping below — never rendered raw.
const SERVER_CODES = new Set([
  'invalid_method',
  'invalid_json',
  'missing_notes',
  'notes_too_long',
  'missing_auth',
  'invalid_token',
  'origin_not_allowed',
  'quota_exceeded',
  'server_error',
  'provider_not_configured',
  'provider_failure',
])

/**
 * Pull { status, serverCode, serverMessage } out of a functions.invoke
 * failure. The SDK wraps HTTP errors differently across versions —
 * FunctionsHttpError (.status + .context), thrown Responses, or plain fetch
 * failures — so every shape is probed instead of assuming one layout.
 */
function functionErrorInfo(error) {
  let status
  let serverCode = null
  let serverMessage = null
  if (error && typeof error === 'object') {
    if (typeof error.status === 'number') status = error.status
    const context = error.context
    const takeInner = (inner) => {
      if (inner && typeof inner === 'object') {
        if (typeof inner.code === 'string') serverCode = inner.code
        if (typeof inner.message === 'string') serverMessage = inner.message
      }
    }
    if (context && typeof context === 'object') {
      if (status === undefined && typeof context.status === 'number') {
        status = context.status
      }
      takeInner(
        context.error && typeof context.error === 'object'
          ? context.error
          : typeof context.code === 'string'
            ? context
            : null,
      )
    } else if (typeof context === 'string' && context) {
      try {
        const parsed = JSON.parse(context)
        takeInner(parsed && typeof parsed.error === 'object' ? parsed.error : null)
      } catch {
        // Not JSON — ignore, status mapping below still applies.
      }
    }
  }
  return { status, serverCode, serverMessage }
}

function defaultMessageFor(code) {
  switch (code) {
    case 'missing_notes':
      return 'Add some study notes first, then generate.'
    case 'notes_too_long':
      return 'That’s too much text at once. Trim the notes and try again.'
    case 'missing_auth':
    case 'invalid_token':
      return 'Your session expired. Sign in again.'
    case 'origin_not_allowed':
      return 'This app is not authorized to generate cards. Sign in again.'
    case 'quota_exceeded':
      return "You've used all 20 AI generations for today. Try again tomorrow."
    case 'server_error':
      return 'Generation is temporarily unavailable. Try again later.'
    case 'provider_not_configured':
      return 'Generation is not configured yet. Try again later.'
    case 'provider_failure':
      return "Couldn't generate cards right now. Try again in a minute."
    default:
      return 'Something went wrong while generating cards.'
  }
}

function mapFunctionError(error) {
  const { status, serverCode, serverMessage } = functionErrorInfo(error)
  const say = (fallback) => serverMessage || fallback
  // No HTTP status: the request never completed (offline, DNS, CORS).
  if (status === undefined) {
    return new AiError(
      'network',
      'Could not reach the server. Check your connection and try again.',
    )
  }
  if (serverCode && SERVER_CODES.has(serverCode)) {
    return new AiError(serverCode, say(defaultMessageFor(serverCode)))
  }
  // Status-only fallback: the SDK wrapped the error without the JSON body.
  switch (status) {
    case 400:
      return new AiError('malformed', say(defaultMessageFor()))
    case 401:
      return new AiError('invalid_token', say(defaultMessageFor('invalid_token')))
    case 403:
      return new AiError('origin_not_allowed', say(defaultMessageFor('origin_not_allowed')))
    case 429:
      return new AiError('quota_exceeded', say(defaultMessageFor('quota_exceeded')))
    case 500:
      return new AiError('server_error', say(defaultMessageFor('server_error')))
    case 501:
      return new AiError('provider_not_configured', say(defaultMessageFor('provider_not_configured')))
    case 502:
    case 503:
    case 504:
      return new AiError('provider_failure', say(defaultMessageFor('provider_failure')))
    default:
      return new AiError('provider_error', say(defaultMessageFor()))
  }
}

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('edge-function-timeout')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Generate flashcards from study notes via the server-side Edge Function.
 *
 * @param {string} notes - pasted study notes
 * @param {*} [_apiKeys] - ignored (kept for call-site compatibility):
 *   provider keys live server-side now and are never sent from the browser.
 * @returns {Promise<{cards: Array<{question: string, answer: string, source: string}>, provider: string, failures: Array}>}
 */
export async function generateCards(notes, _apiKeys) {
  const text = typeof notes === 'string' ? notes.trim() : ''
  let invoked
  try {
    invoked = await withTimeout(
      supabase.functions.invoke(EDGE_FUNCTION, { body: { notes: text } }),
      EDGE_TIMEOUT_MS,
    )
  } catch (thrown) {
    // Some SDK versions THROW HTTP errors instead of returning them —
    // recover the status before assuming a network failure.
    const info = functionErrorInfo(thrown)
    if (info.status !== undefined || info.serverCode) throw mapFunctionError(thrown)
    throw new AiError(
      'network',
      'Could not reach the server. Check your connection and try again.',
    )
  }
  const { data, error } = invoked ?? {}
  if (!error) {
    const cards = normalizeServerCards(data)
    if (!cards) {
      throw new AiError(
        'malformed',
        'The server returned an unexpected response. Try generating again.',
      )
    }
    const provider = data && typeof data.provider === 'string' ? data.provider : 'server'
    return { cards, provider, failures: [] }
  }
  throw mapFunctionError(error)
}
