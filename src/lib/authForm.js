/**
 * Pure auth-form logic shared by the Auth page: field validation and
 * mapping of raw Supabase Auth errors to friendly, specific copy.
 * UI-only — no auth behavior lives here (that stays in useAuth.js).
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Returns an error message, or null when valid. Email is trimmed first. */
export function validateAuthEmail(value) {
  const email = String(value ?? '').trim()
  if (!email) return 'Enter your email address.'
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.'
  return null
}

/**
 * Returns an error message, or null when valid.
 * The 6-character minimum is enforced only for sign-up — Supabase decides
 * what is acceptable at sign-in, and a client-side block would lock users
 * out of older, shorter passwords.
 */
export function validateAuthPassword(value, mode = 'login') {
  if (!value) {
    return mode === 'signup' ? 'Choose a password.' : 'Enter your password.'
  }
  if (mode === 'signup' && value.length < 6) {
    return 'Password must be at least 6 characters.'
  }
  return null
}

/**
 * Friendly copy for the most common Supabase Auth errors. Anything
 * unrecognized gets a generic message instead of the raw provider text,
 * so internal details never surface on the sign-in screen.
 */
export function friendlyAuthError(error) {
  const message = String(error?.message ?? '').toLowerCase()
  if (!message) return 'Something went wrong. Please try again.'

  if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
    return 'Email or password is incorrect.'
  }
  if (message.includes('already registered') || message.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (message.includes('email not confirmed')) {
    return 'Confirm your email first — open the link we sent you, then sign in.'
  }
  if (message.includes('password') && (message.includes('least') || message.includes('valid') || message.includes('short'))) {
    return 'Password must be at least 6 characters.'
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('security purposes') ||
    message.includes('429')
  ) {
    return 'Too many attempts. Wait a moment and try again.'
  }
  if (
    message.includes('failed to fetch') ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('load failed')
  ) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  if (message.includes('unable to validate email') || message.includes('invalid email') || message.includes('invalid format')) {
    return 'Enter a valid email address.'
  }

  return 'Something went wrong. Please try again.'
}
