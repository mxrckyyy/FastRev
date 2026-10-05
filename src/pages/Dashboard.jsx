import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useReviews } from '@/hooks/useReviews'
import DeckList from '@/pages/DeckList'

function dueCaption(count, hasError) {
  if (count === null) {
    return hasError ? 'Could not load due count' : "Checking what's due…"
  }
  if (count === 0) return 'Nothing due right now'
  return count === 1 ? 'card ready to review' : 'cards ready to review'
}

export default function Dashboard() {
  const { user } = useAuth()
  const { dueCount, error, fetchDueCount } = useReviews()

  useEffect(() => {
    fetchDueCount()
  }, [fetchDueCount])

  // Page chrome (title, nav, theme, account) comes from AppShell — this page
  // only owns its content.
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-xl font-semibold">
          Welcome{user?.email ? `, ${user.email}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          Your decks and cards, all in one place.
        </p>
      </div>

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
            <Play className="mr-2 h-4 w-4" aria-hidden="true" />
            Start Review
          </Link>
        </Button>
      </div>

      <DeckList />
    </div>
  )
}
