import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import ReviewShell from '@/components/ReviewShell'
import ReviewProgress from '@/components/ReviewProgress'
import Flashcard from '@/components/Flashcard'
import RatingButtons from '@/components/RatingButtons'
import ShortcutHint from '@/components/ShortcutHint'
import EmptyState from '@/components/EmptyState'
import ErrorState from '@/components/ErrorState'
import { RATINGS } from '@/lib/ratings'
import { useReviews } from '@/hooks/useReviews'

function ProgressSkeleton() {
  return (
    <div className="space-y-2" aria-hidden="true">
      <Skeleton className="mx-auto h-4 w-28" />
      <Skeleton className="h-1.5 w-full rounded-full" />
    </div>
  )
}

function CardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your review session…
      </span>
      <div aria-hidden="true" className="space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg sm:h-11" />
      </div>
    </div>
  )
}

/**
 * Review — focus-mode session screen (route lives outside <AppShell>, so no
 * sidebar/bottom nav). Business logic is untouched: the queue still comes
 * from useReviews.fetchDueCards and ratings still go through submitReview →
 * fsrs scheduleCard → review_logs. This file owns only presentation,
 * keyboard shortcuts and focus management.
 *
 * Keyboard: Space reveals (only while hidden), 1–4 rate (only after reveal),
 * never while typing in a field, and a synchronous ref guard makes duplicate
 * submissions impossible even between keypresses.
 */
export default function Review() {
  const { cards, loading, error, fetchDueCards, submitReview } = useReviews()
  const [revealed, setRevealed] = useState(false)
  const [index, setIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [reviewError, setReviewError] = useState(null)
  // Per-session rating tally — real counts of what the user just submitted,
  // shown on the completion screen. No invented statistics.
  const [tally, setTally] = useState({})
  const submittingRef = useRef(false)
  const questionRef = useRef(null)
  const advanceFocusRef = useRef(false)
  const completionRef = useRef(null)

  useEffect(() => {
    fetchDueCards()
  }, [fetchDueCards])

  const total = cards.length
  const current = cards[index]
  const empty = !loading && total === 0 && !error
  const finished = !loading && total > 0 && index >= total
  const position = Math.min(index + 1, total)
  // Real per-session counts (what was actually submitted) for the
  // completion screen — ratings with zero picks are left out.
  const summary = RATINGS.map((r) => ({ ...r, count: tally[r.value] ?? 0 })).filter(
    (r) => r.count > 0,
  )

  async function handleRating(value) {
    if (!current || submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setReviewError(null)
    const { error: submitError } = await submitReview(current.id, value)
    submittingRef.current = false
    setSubmitting(false)
    if (submitError) {
      setReviewError(submitError.message)
      return
    }
    setTally((prev) => ({ ...prev, [value]: (prev[value] ?? 0) + 1 }))
    advanceFocusRef.current = true
    setRevealed(false)
    setIndex((prev) => prev + 1)
  }

  // Latest-ref mirror: the global key handler is bound once per card/reveal
  // state but must always call the freshest handleRating (no stale closures).
  const handleRatingRef = useRef(handleRating)
  useEffect(() => {
    handleRatingRef.current = handleRating
  })

  // After a successful rating, move focus to the next card's question so
  // keyboard/screen-reader users land on the new content (the heading's
  // sr-only "Card x of y." prefix makes the announcement complete).
  useEffect(() => {
    if (!advanceFocusRef.current) return
    advanceFocusRef.current = false
    questionRef.current?.focus()
  }, [index])

  // Session finished: put focus on the completion heading.
  useEffect(() => {
    if (finished) completionRef.current?.focus()
  }, [finished])

  // Keyboard shortcuts — bound per card/reveal state; guards read the fresh
  // render values, submission goes through the latest-ref mirror.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target
      const tag = target?.tagName
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        target?.isContentEditable
      ) {
        return
      }

      if (e.code === 'Space' || e.key === ' ') {
        // A focused button/link activates itself on keyup — don't double-fire.
        if (tag === 'BUTTON' || tag === 'A') return
        if (!current || revealed || submittingRef.current) return
        e.preventDefault() // no page scroll behind the reveal
        setRevealed(true)
        return
      }

      if (!current || !revealed || submittingRef.current) return
      const slot = Number(e.key)
      if (!Number.isInteger(slot) || slot < 1 || slot > RATINGS.length) return
      handleRatingRef.current(RATINGS[slot - 1].value)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [current, revealed])

  if (loading) {
    return (
      <ReviewShell progress={<ProgressSkeleton />}>
        <CardSkeleton />
      </ReviewShell>
    )
  }

  const progress =
    total > 0 ? (
      <ReviewProgress position={position} total={total} />
    ) : null
  const footer = current ? <ShortcutHint revealed={revealed} /> : null

  return (
    <ReviewShell progress={progress} footer={footer}>
      {error && total === 0 && (
        <div className="animate-in space-y-4 fade-in-0 duration-200">
          <ErrorState
            title="Couldn’t load your review"
            message="We couldn’t fetch the cards that are due. Check your connection and try again."
            detail={error}
            onRetry={fetchDueCards}
          />
          <div className="text-center">
            <Button variant="ghost" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      )}

      {empty && (
        <div className="animate-in fade-in-0 duration-200">
          <EmptyState
            icon={CircleCheck}
            title="You’re all caught up"
            description="No cards are due right now. Come back later, or add more cards to your decks."
          >
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </EmptyState>
        </div>
      )}

      {finished && (
        <div className="animate-in space-y-6 fade-in-0 duration-200 text-center">
          <div>
            <span
              className="mx-auto flex size-12 items-center justify-center rounded-xl bg-success/10 text-success"
              aria-hidden="true"
            >
              <CircleCheck className="size-6" />
            </span>
            <h2
              ref={completionRef}
              tabIndex={-1}
              className="mt-4 text-xl font-semibold"
            >
              Review complete!
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You reviewed {total} {total === 1 ? 'card' : 'cards'} this
              session. Nice work.
            </p>
          </div>

          {summary.length > 0 && (
            <ul
              className="flex flex-wrap justify-center gap-2"
              aria-label="Session summary"
            >
              {summary.map((r) => (
                <li
                  key={r.value}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-foreground"
                >
                  {r.count} {r.label}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/decks">Browse decks</Link>
            </Button>
          </div>
        </div>
      )}

      {current && (
        <div className="space-y-4">
          {reviewError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-center"
            >
              <p className="text-sm font-medium text-destructive">
                Couldn’t save your rating
              </p>
              <p className="mt-0.5 text-xs text-destructive">
                {reviewError} — pick a rating to try again.
              </p>
            </div>
          )}

          {/* Persistent live region: text toggles on reveal so screen
              readers hear it (a region inserted mid-flight often isn't). */}
          <p role="status" className="sr-only">
            {revealed ? 'Answer shown.' : ''}
          </p>

          <div
            key={current.id}
            className="animate-in space-y-4 fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none"
          >
            <Flashcard
              card={current}
              index={index}
              total={total}
              revealed={revealed}
              questionRef={questionRef}
            />
            {!revealed ? (
              <Button
                className="h-12 w-full text-base sm:h-11 sm:text-sm"
                aria-keyshortcuts="Space"
                onClick={() => setRevealed(true)}
              >
                Reveal Answer
              </Button>
            ) : (
              <RatingButtons onSelect={handleRating} disabled={submitting} />
            )}
          </div>
        </div>
      )}
    </ReviewShell>
  )
}
