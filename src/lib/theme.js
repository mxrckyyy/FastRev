// Dark mode is a single `.dark` class on <html>, plus a persisted preference.
// The initial class is applied by the inline bootstrap script in index.html so
// there is never a flash of the wrong theme before React mounts.

export const THEME_STORAGE_KEY = 'fastrev_theme'

const listeners = new Set()

function prefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** @returns {'light' | 'dark'} the stored preference, falling back to the OS setting. */
export function readTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (private mode) — fall through to the OS setting.
  }
  return prefersDark() ? 'dark' : 'light'
}

/** Writes the preference and toggles the `.dark` class on <html>. */
export function applyTheme(theme) {
  const next = theme === 'dark' ? 'dark' : 'light'
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // Ignore: the class below still applies for this session.
  }
  document.documentElement.classList.toggle('dark', next === 'dark')
  return next
}

/** Applies the current preference without changing it. */
export function syncTheme() {
  return applyTheme(readTheme())
}

/** @returns {'light' | 'dark'} the theme that was just applied. */
export function toggleTheme() {
  return applyTheme(readTheme() === 'dark' ? 'light' : 'dark')
}

/** Subscribe to toggles made in this tab and in other tabs. */
export function subscribeTheme(listener) {
  listeners.add(listener)
  if (listeners.size === 1) window.addEventListener('storage', handleStorage)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.removeEventListener('storage', handleStorage)
  }
}

function handleStorage(event) {
  if (event.key !== THEME_STORAGE_KEY) return
  const theme = applyTheme(readTheme())
  for (const listener of listeners) listener(theme)
}