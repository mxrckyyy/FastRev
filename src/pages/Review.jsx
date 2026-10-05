import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Rating } from '@/lib/fsrs'
import { useReviews } from '@/hooks/useReviews'
import ThemeToggle from '@/components/ThemeToggle'

// Ratings map to the semantic status tokens: Again = danger, Hard = warning,
// Good = success, Easy = primary. Every button also carries a text label, so
// the meaning never depends on color alone.
const RATINGS = [
  { value: Rating.Again, label: 'Again', variant: 'danger' },
  { value: Rating.Hard, label: 'Hard', variant: 'warning' },
  { value: Rating.Good, label: 'Good', variant: 'success' },
  { value: Rating.Easy, label: 'Easy', variant: 'default' },
]

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="mr-2 h-4 w-4" />
      Back to dashboard
    </Link>
  )
}

export default function Review() {
  const { cards, loading, error, fetchDueCards, submitReview } = useReviews()
  const [revealed, setRevealed] = useState(false)
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)

  useEffect(() => {
    fetchDueCards()
  }, [fetchDueCards])

  const total = cards.length
  const current = cards[index]
  const empty = !loading && total === 0 && !error
  const finished = !loading && total > 0 && index >= total

  async function handleRating(value) {
    if (!current || submitting) return
    setSubmitting(true)
    setReviewError(null)
    const { error: submitError } = await submitReview(current.id, value)
    setSubmitting(false)
    if (submitError) {
      setReviewError(submitError.message)
      return
    }
    setRevealed(false)
    setIndex((prev) => prev + 1)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <BackLink />
          <p className="text-sm text-muted-foreground">Loading review…</p>
        </header>
        <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:px-6">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="space-y-4 rounded-lg border p-6">
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
            <div className="h-10 animate-pulse rounded bg-muted" />
          </div>
        </main>
      </div>
    )
  }

  return (
<div className="min-h-screen bg-background">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
          <BackLink />
          <div className="flex items-center gap-2">
            {current && (
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {index + 1} / {total}
                </span>
                <span className="hidden sm:inline"> · {total - index} remaining</span>
              </p>
            )}
            <ThemeToggle />
          </div>
        </header>

      <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
        {error && total === 0 && (
          <div className="space-y-4 py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" onClick={() => fetchDueCards()}>
              Try again
            </Button>
          </div>
        )}

        {empty && (
          <div className="space-y-4 py-12 text-center">
            <h2 className="text-xl font-semibold">All caught up!</h2>
            <p className="text-sm text-muted-foreground">
              No cards are due right now. Come back later or add more cards to
              your decks.
            </p>
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        )}

        {finished && (
          <div className="space-y-4 py-12 text-center">
            <h2 className="text-xl font-semibold">Session complete!</h2>
            <p className="text-sm text-muted-foreground">
              You reviewed {total} {total === 1 ? 'card' : 'cards'} this
              session. Nice work.
            </p>
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        )}

        {current && (
          <div className="space-y-4">
            {reviewError && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {reviewError}
              </p>
            )}
            <Card>
              <CardHeader>
                <CardDescription>Question</CardDescription>
                <CardTitle>{current.question}</CardTitle>
              </CardHeader>
              {revealed && (
                <CardContent className="space-y-3">
                  <div className="rounded-md bg-muted p-4">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Answer
                    </p>
                    <p className="whitespace-pre-wrap text-sm">
                      {current.answer}
                    </p>
                  </div>
                  {current.source && (
                    <p className="text-xs text-muted-foreground">
                      Source: {current.source}
                    </p>
                  )}
                </CardContent>
              )}
              <div className="px-6 pb-6">
                {!revealed ? (
                  <Button
                    className="w-full"
                    onClick={() => setRevealed(true)}
                  >
                    Show Answer
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {RATINGS.map((rating) => (
                      <Button
                        key={rating.value}
                        variant={rating.variant}
                        disabled={submitting}
                        onClick={() => handleRating(rating.value)}
                      >
                        {rating.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
