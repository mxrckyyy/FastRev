import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/AppShell'
import { useAuth } from '@/hooks/useAuth'
import Analytics from '@/pages/Analytics'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import DeckDetail from '@/pages/DeckDetail'
import Decks from '@/pages/Decks'
import Review from '@/pages/Review'
import SettingsPage from '@/pages/SettingsPage'
import Upload from '@/pages/Upload'

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p role="status" className="text-sm text-muted-foreground">{children}</p>
    </div>
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
        {/* Review focus mode: bare layout, own minimal header only. */}
        <Route path="/review" element={<Review />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
