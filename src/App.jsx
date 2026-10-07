import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/hooks/useAuth'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import { supabaseConfigured } from '@/lib/supabase'

// Route-level code splitting (Phase 11 perf): only the first-paint-critical
// modules (shell, Auth, Dashboard) stay in the main chunk. Everything else —
// above all Analytics, which drags recharts in — loads on navigation. The
// Suspense boundary for shell routes lives inside AppShell so the chrome
// never unmounts while a chunk arrives (no layout shift).
const Analytics = lazy(() => import('@/pages/Analytics'))
const DeckDetail = lazy(() => import('@/pages/DeckDetail'))
const Decks = lazy(() => import('@/pages/Decks'))
const Review = lazy(() => import('@/pages/Review'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const Upload = lazy(() => import('@/pages/Upload'))

function FullPageMessage({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p role="status" className="text-sm text-muted-foreground">{children}</p>
    </main>
  )
}

function ProtectedLayout() {
  const { user, loading } = useAuth()
  if (loading) return <FullPageMessage>Loading…</FullPageMessage>
  if (!user) return <Navigate to="/auth" replace />
  return <Outlet />
}

function GuestRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullPageMessage>Loading…</FullPageMessage>
  if (user) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  // Production must never fall back to the placeholder Supabase client
  // (SEC-20): if the env vars were missing at build time the app would be
  // silently broken — say so plainly instead. Dev keeps placeholders.
  if (!import.meta.env.DEV && !supabaseConfigured) {
    return (
      <FullPageMessage>
        FastRev isn&apos;t configured yet — Supabase settings are missing from
        this deployment.
      </FullPageMessage>
    )
  }
  return (
    <Routes>
      <Route
        path="/auth"
        element={
          <GuestRoute>
            <Auth />
          </GuestRoute>
        }
      />
      <Route element={<ProtectedLayout />}>
        {/* Standard pages render inside the AppShell (sidebar + top bar +
            bottom nav). Focus-mode pages are siblings, not children — that
            is how a route opts out of the chrome. */}
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/decks" element={<Decks />} />
          <Route path="/decks/:id" element={<DeckDetail />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        {/* Review focus mode: bare layout, own minimal header only. Its
            boundary is per-route because it sits outside AppShell. */}
        <Route
          path="/review"
          element={
            <Suspense fallback={<FullPageMessage>Loading…</FullPageMessage>}>
              <Review />
            </Suspense>
          }
        />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
