import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'
import { Toaster } from 'sonner'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from '@/components/ErrorBoundary'
import { AuthProvider } from '@/hooks/useAuth'

// One-time purge of obsolete client-side provider keys. Generation and job
// scheduling are server-side now, so keys the app stored in Phase 4 and
// earlier (`gemini_api_key`, `groq_api_key`, `cerebras_api_key`) are useless
// — leaving them in browsers would keep secrets at rest for no reason.
// Runs once per bundle load; theme storage (`fastrev_theme`) is unrelated
// and untouched.
try {
  localStorage.removeItem('gemini_api_key')
  localStorage.removeItem('groq_api_key')
  localStorage.removeItem('cerebras_api_key')
} catch {
  // localStorage unavailable (private mode) — nothing stored, nothing to purge.
}

// Global toast host. `unstyled` turns off sonner's hardcoded white/black
// surface so every visual comes from our tokens instead (bg-elevated,
// border-border, text-sm, rounded-xl — the same vocabulary as dialogs and
// popovers), and the icons are lucide like the rest of the app. The 5rem
// bottom offset keeps toasts above the mobile bottom nav at every width
// (the nav is rendered up to the `lg` breakpoint).
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster
            position="bottom-center"
            offset={{ bottom: '5rem' }}
            mobileOffset={{ bottom: '5rem' }}
            toastOptions={{
              unstyled: true,
              classNames: {
                toast:
                  'flex w-full items-center gap-2 rounded-xl border border-border bg-elevated px-4 py-3 text-sm font-medium text-foreground shadow-lg',
                content: 'flex min-w-0 flex-1 flex-col gap-0.5',
                icon: 'flex size-4 shrink-0 items-center justify-center',
              },
            }}
            icons={{
              success: (
                <CircleCheck className="size-4 text-success" aria-hidden="true" />
              ),
              error: (
                <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
              ),
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
