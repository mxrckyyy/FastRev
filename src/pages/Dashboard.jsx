import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, Play, Sparkles, ChartColumn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useReviews } from '@/hooks/useReviews'
import ThemeToggle from '@/components/ThemeToggle'
import DeckList from '@/pages/DeckList'
import SettingsDialog from '@/pages/Settings'

function dueCaption(count, hasError) {
  if (count === null) {
    return hasError ? 'Could not load due count' : "Checking what's due…"
  }
  if (count === 0) return 'Nothing due right now'
  return count === 1 ? 'card ready to review' : 'cards ready to review'
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { dueCount, error, fetchDueCount } = useReviews()
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    fetchDueCount()
  }, [fetchDueCount])

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold">
            Welcome{user?.email ? `, ${user.email}` : ''}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your decks and cards, all in one place.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/analytics">
              <ChartColumn className="mr-2 h-4 w-4" aria-hidden="true" />
              Analytics
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/upload">
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Generate Cards
            </Link>
          </Button>
          <ThemeToggle />
          <Button variant="outline" onClick={() => setSettingsOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
            Settings
          </Button>
          <Button variant="outline" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <Card className="min-w-48 flex-1">
            <CardHeader>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Due Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{dueCount ?? '—'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {dueCaption(dueCount, Boolean(error))}
              </p>
            </CardContent>
          </Card>
          <Button size="lg" asChild>
            <Link to="/review">
              <Play className="mr-2 h-4 w-4" />
              Start Review
            </Link>
          </Button>
        </div>

        <DeckList />
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}
