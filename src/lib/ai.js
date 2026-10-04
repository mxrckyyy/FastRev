const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const CEREBRAS_URL = 'https://api.cerebras.ai/v1/chat/completions'

const GROQ_MODEL = 'llama-3.3-70b-versatile'
const CEREBRAS_MODEL = 'llama-3.3-70b'

// Order matters: this is the fallback chain.
export const PROVIDERS = ['gemini', 'groq', 'cerebras']

export const STORAGE_KEYS = {
  gemini: 'gemini_api_key',
  groq: 'groq_api_key',
  cerebras: 'cerebras_api_key',
}

const PROVIDER_LABELS = {
  gemini: 'Google Gemini 2.5 Flash',
  groq: 'Groq (Llama 3.3 70B)',
  cerebras: 'Cerebras (Llama 3.3 70B)',
}

export class AiError extends Error {
  constructor(code, message, provider) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.provider = provider ?? null
  }
}

// --- API key storage (browser localStorage only — never sent anywhere
// except the provider endpoint the key belongs to) ---

export function loadApiKey(provider) {
  try {
    return localStorage.getItem(STORAGE_KEYS[provider]) || ''
  } catch {
    return ''
  }
}

export function loadApiKeys() {
  return {
    gemini: loadApiKey('gemini'),
    groq: loadApiKey('groq'),
    cerebras: loadApiKey('cerebras'),
  }
}

export function saveApiKey(provider, key) {
  const trimmed = (key || '').trim()
  try {
    if (trimmed) localStorage.setItem(STORAGE_KEYS[provider], trimmed)
    else localStorage.removeItem(STORAGE_KEYS[provider])
  } catch {
    // localStorage unavailable (private mode) — ignore, UI already shows state
  }
  return trimmed
}

export function hasAnyApiKey(keys) {
  return PROVIDERS.some((provider) => Boolean(keys?.[provider]))
}

// Helper: human-readable name for the provider that produced a result.
export function providerLabel(provider) {
  return PROVIDER_LABELS[provider] || provider || 'unknown provider'
}

// --- Prompt + response parsing ---

function buildPrompt(notes) {
  return [
    'You are an expert flashcard writer. Extract 10 to 15 atomic concepts from the study notes below.',
    'Each card must cover exactly one concept: a clear question and a concise answer.',
    '',
    'Return ONLY a JSON array (no markdown fences, no commentary) where each element is:',
    '{ "question": "...", "answer": "...", "source": "short reference to where it came from in the notes" }',
    '',
    'Rules:',
    '- Between 10 and 15 cards.',
    '- "source" must be a short excerpt, heading, or topic from the notes (use "notes" if none applies).',
    '- Answers must be self-contained and short enough to read at a glance.',
    '',
    'Study notes:',
    '"""',
    notes,
    '"""',
  ].join('\n')
}

function stripFences(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) return fenced[1].trim()
  return text.trim()
}

function normalizeCard(candidate) {
  if (!candidate || typeof candidate !== 'object') return null
  const question = typeof candidate.question === 'string' ? candidate.question.trim() : ''
  const answer = typeof candidate.answer === 'string' ? candidate.answer.trim() : ''
  if (!question || !answer) return null
  const source = typeof candidate.source === 'string' ? candidate.source.trim() : ''
  return { question, answer, source }
}

function parseCards(rawText, provider) {
  let parsed
  try {
    parsed = JSON.parse(stripFences(rawText))
  } catch {
    throw new AiError(
      'malformed',
      `${providerLabel(provider)} returned a response that was not valid JSON. Try generating again.`,
      provider,
    )
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.cards)
      ? parsed.cards
      : null
  if (!list) {
    throw new AiError(
      'malformed',
      `${providerLabel(provider)} returned JSON but not a list of cards. Try generating again.`,
      provider,
    )
  }
  const cards = list.map(normalizeCard).filter(Boolean)
  if (cards.length === 0) {
    throw new AiError(
      'malformed',
      `${providerLabel(provider)} did not return any usable cards. Try again or rephrase your notes.`,
      provider,
    )
  }
  return cards
}

// --- HTTP helpers ---

function timeoutSignal() {
  if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
    return AbortSignal.timeout(45000)
  }
  return undefined
}

async function readErrorDetail(response) {
  try {
    const text = await response.text()
    return text.slice(0, 500)
  } catch {
    return ''
  }
}

async function toAiError(response, provider) {
  const detail = await readErrorDetail(response)
  if (response.status === 429) {
    return new AiError(
      'rate_limit',
      `Free tier limit reached for ${providerLabel(provider)}. Try again in a minute or switch provider.`,
      provider,
    )
  }
  if (/api[_ ]key|unauthorized|permission|forbidden/i.test(detail)) {
    return new AiError(
      'invalid_key',
      `The ${providerLabel(provider)} API key was rejected. Update it in Settings.`,
      provider,
    )
  }
  if (response.status === 401 || response.status === 403) {
    return new AiError(
      'invalid_key',
      `The ${providerLabel(provider)} API key was rejected. Update it in Settings.`,
      provider,
    )
  }
  return new AiError(
    'provider_error',
    `${providerLabel(provider)} returned an error (HTTP ${response.status}). Try again later.`,
    provider,
  )
}

async function request(url, options, provider) {
  let response
  try {
    response = await fetch(url, { ...options, signal: timeoutSignal() })
  } catch {
    throw new AiError(
      'network',
      `Could not reach ${providerLabel(provider)}. Check your connection and try again.`,
      provider,
    )
  }
  if (!response.ok) throw await toAiError(response, provider)
  return response
}

// --- Providers ---

async function callGemini(notes, key) {
  const response = await request(
    `${GEMINI_URL}?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(notes) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
    'gemini',
  )
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new AiError('malformed', 'Gemini returned an unreadable response.', 'gemini')
  }
  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
  if (!text) {
    throw new AiError(
      'malformed',
      'Gemini returned no text content. Try generating again.',
      'gemini',
    )
  }
  return parseCards(text, 'gemini')
}

async function callOpenAiCompatible(url, model, provider, notes, key) {
  const response = await request(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: 'system',
            content:
              'You output ONLY a JSON array of flashcards. No markdown, no explanation.',
          },
          { role: 'user', content: buildPrompt(notes) },
        ],
      }),
    },
    provider,
  )
  let payload
  try {
    payload = await response.json()
  } catch {
    throw new AiError('malformed', `${providerLabel(provider)} returned an unreadable response.`, provider)
  }
  const text = payload?.choices?.[0]?.message?.content
  if (!text) {
    throw new AiError('malformed', `${providerLabel(provider)} returned no text content.`, provider)
  }
  return parseCards(text, provider)
}

function callGroq(notes, key) {
  return callOpenAiCompatible(GROQ_URL, GROQ_MODEL, 'groq', notes, key)
}

function callCerebras(notes, key) {
  return callOpenAiCompatible(CEREBRAS_URL, CEREBRAS_MODEL, 'cerebras', notes, key)
}

// --- Public API ---

function normalizeKeys(input) {
  if (typeof input === 'string') {
    return { ...loadApiKeys(), gemini: input.trim() }
  }
  if (input && typeof input === 'object') {
    return {
      gemini: input.gemini || '',
      groq: input.groq || '',
      cerebras: input.cerebras || '',
    }
  }
  return loadApiKeys()
}

function aggregateError(failures) {
  const codes = new Set(failures.map((failure) => failure.code))
  if (codes.size === 1 && codes.has('rate_limit')) {
    return new AiError(
      'rate_limit',
      'Free tier limit reached on every configured provider. Try again in a minute or add another provider key in Settings.',
      null,
    )
  }
  const first = failures[0]
  const error = new AiError(first.code, first.message, first.provider)
  error.failures = failures
  return error
}

/**
 * Generate flashcards from study notes.
 *
 * Tries Gemini first, then Groq, then Cerebras — skipping any provider
 * without a key and falling through when a provider fails.
 *
 * @param {string} notes - pasted study notes
 * @param {string|object} [apiKeys] - a single Gemini key, or
 *   `{ gemini, groq, cerebras }`. Defaults to keys from localStorage.
 * @returns {Promise<{cards: Array<{question: string, answer: string, source: string}>, provider: string, failures: Array}>}
 */
export async function generateCards(notes, apiKeys) {
  const keys = normalizeKeys(apiKeys)
  const chain = [
    { id: 'gemini', key: keys.gemini, call: callGemini },
    { id: 'groq', key: keys.groq, call: callGroq },
    { id: 'cerebras', key: keys.cerebras, call: callCerebras },
  ].filter((provider) => Boolean(provider.key))

  if (chain.length === 0) {
    throw new AiError(
      'missing_key',
      'No AI API key configured yet. Open Settings and add a Gemini (or Groq / Cerebras) key.',
      null,
    )
  }

  const failures = []
  for (const provider of chain) {
    try {
      const cards = await provider.call(notes, provider.key)
      return { cards, provider: provider.id, failures }
    } catch (error) {
      const aiError =
        error instanceof AiError
          ? error
          : new AiError(
              'provider_error',
              error?.message || `${providerLabel(provider.id)} failed unexpectedly.`,
              provider.id,
            )
      failures.push({
        provider: provider.id,
        code: aiError.code,
        message: aiError.message,
      })
    }
  }
  throw aggregateError(failures)
}
