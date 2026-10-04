import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import Analytics from '@/pages/Analytics'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import DeckDetail from '@/pages/DeckDetail'
import Review from '@/pages/Review'
import Upload from '@/pages/Upload'

function FullPageMessage({ children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">{children}</p>
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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/decks/:id" element={<DeckDetail />} />
        <Route path="/review" element={<Review />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/analytics" element={<Analytics />} />
      </Route>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
