/**
 * Friendly error mapping for database / network failures.
 *
 * Raw Supabase (PostgREST/Postgres) messages must never reach users in
 * production — they can disclose constraint names, table names and RLS
 * details (SEC-03). Every render point that would show an error string runs
 * it through `friendlyDbError()` first; in development the raw text is still
 * logged to the console (and returned) so debugging stays possible.
 *
 * Convention: hooks keep storing the RAW message in their `error` state —
 * sanitise at the render point, not at the source.
 */

const GENERIC = 'Something went wrong. Please try again.'

/** Extract a plain message from an error object / PostgREST error / string. */
function rawMessage(error) {
  if (typeof error === 'string') return error
  if (error && typeof error.message === 'string') return error.message
  return ''
}

/**
 * Returns safe, user-facing copy for a database/network error.
 * @param {unknown} error - error object, PostgREST error, or message string
 * @param {string} [fallback] - copy to use when nothing matches
 * @returns {string}
 */
export function friendlyDbError(error, fallback = GENERIC) {
  // Errors the app constructed itself (e.g. "You must be signed in…") are
  // already safe copy — pass them through untouched.
  if (error && typeof error === 'object' && error.friendly === true) {
    return rawMessage(error) || fallback
  }

  const raw = rawMessage(error)
  const dev = import.meta.env.DEV

  if (dev && raw) console.warn('[db-error]', raw)
  if (!raw) return fallback

  const m = raw.toLowerCase()

  if (
    m.includes('row-level security') ||
    m.includes('permission denied') ||
    m.includes('not authorized') ||
    m.includes('does not belong') ||
    m.includes('violates row-level security')
  ) {
    return "You don't have permission to do that."
  }
  if (m.includes('jwt') || m.includes('token') || m.includes('session')) {
    return 'Your session has expired. Please sign in again.'
  }
  if (m.includes('duplicate key') || m.includes('unique constraint')) {
    return 'That already exists. Try a different name.'
  }
  if (
    m.includes('violates check constraint') ||
    m.includes('value too long') ||
    m.includes('invalid input syntax') ||
    m.includes('data too long')
  ) {
    return 'Some of that input is too long or not in the expected format.'
  }
  if (m.includes('foreign key') || m.includes('does not exist')) {
    return 'That item no longer exists.'
  }
  if (
    m.includes('failed to fetch') ||
    m.includes('fetch failed') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed')
  ) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (
    m.includes('rate limit') ||
    m.includes('too many request') ||
    m.includes('429') ||
    m.includes('quota')
  ) {
    return 'Too many requests. Wait a moment and try again.'
  }
  if (
    m.includes('row not found') ||
    m.includes('no rows returned') ||
    m.includes('not found')
  ) {
    return 'That item could not be found.'
  }

  // Unknown: never ship raw provider text — raw only in development builds.
  return dev ? raw : fallback
}
