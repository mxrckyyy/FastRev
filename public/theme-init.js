// Applies the saved theme before first paint (see src/lib/theme.js).
// Kept as an external file (not inline) so the production Content-Security-
// Policy can use `script-src 'self'` with no 'unsafe-inline' — see
// vercel.json. Loaded render-blocking from <head>, so there is no flash of
// the wrong theme.
(function () {
  try {
    var stored = localStorage.getItem('fastrev_theme')
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    if (theme === 'dark') document.documentElement.classList.add('dark')
  } catch {
    /* localStorage blocked — stay on the light default */
  }
})()
