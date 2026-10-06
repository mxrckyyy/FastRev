import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  Flame,
  Layers,
  Play,
  Plus,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CreateDeckDialog from '@/components/CreateDeckDialog'
import DeckCard, { DeckCardSkeleton } from '@/components/DeckCard'
import EmptyState from '@/components/EmptyState'
import ErrorState from '@/components/ErrorState'
import { StatCard, StatCardSkeleton } from '@/components/StatCard'
import { useAnalytics } from '@/hooks/useAnalytics'
import { useAuth } from '@/hooks/useAuth'
import { useDecks } from '@/hooks/useDecks'

// Priority order for the dashboard's deck previews: decks with the most due
// cards first (they need attention), newest decks next. No scoring beyond
// that — it has to stay explainable to the user.
function prioritizeDecks(decks) {
  return [...decks]
    .sort((a, b) => {
      if (b.due_count !== a.due_count) return b.due_count - a.due_count
      return new Date(b.created_at) - new Date(a.created_at)
    })
    .slice(0, 3)
}

function dueCaption(count) {
  if (count === 0) return 'Nothing waiting right now'
  return count === 1 ? 'card waiting for review' : 'cards waiting for review'
}

/**
 * Primary call-to-action panel. Adapts to what the data says:
 * - cards due        → "Ready to review?" + Start Review
 * - nothing due      → "All caught up!" + Generate Cards (the useful next step)
 */
function ReviewHero({ dueCount, streak }) {
  if (dueCount === 0) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-success/30 bg-success/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success"
            aria-hidden="true"
          >
            <CircleCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">All caught up!</h2>
            <p className="text-sm text-muted-foreground">
              Nothing is due right now — generate more cards or come back
              later.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          variant="outline"
          asChild
          className="h-11 w-full sm:h-9 sm:w-auto"
        >
          <Link to="/upload">
            <Sparkles aria-hidden="true" />
            Generate Cards
          </Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <Play className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Ready to review?</h2>
          <p className="text-sm text-muted-foreground">
            {dueCount === 1
              ? '1 card is waiting for you.'
              : `${dueCount} cards are waiting for you.`}
            {streak > 0 ? ` Keep your ${streak}-day streak going.` : ''}
          </p>
        </div>
      </div>
      <Button
        size="lg"
        asChild
        className="h-11 w-full sm:h-9 sm:w-auto"
      >
        <Link to="/review">
          <Play aria-hidden="true" />
          Start Review
        </Link>
      </Button>
    </section>
  )
}

/**
 * Four primary statistics. Streak + retention come from `useAnalytics`
 * (they load separately from the deck data, so those two cards show their
 * own skeletons / fallbacks while or if that request fails).
 */
function StatsSection({
  dueCount,
  totalCards,
  deckCount,
  stats,
  statsLoading,
  statsError,
  onRetryStats,
}) {
  const streakCaption = stats
    ? stats.streak === 1
      ? 'day with reviews'
      : 'days with reviews'
    : ''
  const retentionCaption = stats
    ? stats.total === 0
      ? 'No reviews yet'
      : `${stats.good} of ${stats.total} positive reviews`
    : ''

  return (
    <section className="space-y-4" aria-label="Statistics">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarCheck}
          tone="primary"
          label="Due Today"
          value={dueCount}
          caption={dueCaption(dueCount)}
        />
        <StatCard
          icon={Flame}
          tone="warning"
          label="Streak"
          loading={statsLoading}
          value={statsError ? '—' : stats?.streak ?? 0}
          caption={statsError ? 'Couldn’t load' : streakCaption}
        />
        <StatCard
          icon={Layers}
          tone="muted"
          label="Total Cards"
          value={totalCards}
          caption={`across ${deckCount} ${deckCount === 1 ? 'deck' : 'decks'}`}
        />
        <StatCard
          icon={Target}
          tone="success"
          label="Retention"
          loading={statsLoading}
          value={
            statsError || !stats || stats.retention === null
              ? '—'
              : `${stats.retention}%`
          }
          caption={statsError ? 'Couldn’t load' : retentionCaption}
        />
      </div>

      {statsError && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3">
          <span
            aria-hidden="true"
            className="shrink-0 text-warning-foreground dark:text-warning"
          >
            <TriangleAlert className="size-4" />
          </span>
          <p className="min-w-40 flex-1 text-sm">
            Some statistics couldn’t load.
          </p>
          <Button variant="outline" size="sm" onClick={onRetryStats}>
            Try again
          </Button>
        </div>
      )}
    </section>
  )
}

function PriorityDecks({ decks, totalCount, onDelete }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Your decks</h2>
          <p className="text-sm text-muted-foreground">
            Decks with cards due come first.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/decks">
            View all
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((deck) => (
          <DeckCard key={deck.id} deck={deck} onDelete={onDelete} />
        ))}
      </div>
      {totalCount > decks.length && (
        <p className="text-xs text-muted-foreground">
          Showing {decks.length} of {totalCount} decks — view all to see the
          rest.
        </p>
      )}
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading your dashboard…
      </span>
      <div aria-hidden="true" className="space-y-6 sm:space-y-8">
        <Card className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-3.5 w-56" />
              </div>
            </div>
            <Skeleton className="h-11 w-full rounded-lg sm:h-9 sm:w-36" />
          </div>
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DeckCardSkeleton />
            <DeckCardSkeleton />
            <DeckCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Dashboard — the user's learning overview. Answers, in order:
 * what to review next (hero), how it's going (stats), what it owns
 * (deck totals), and which decks need attention (priority list).
 */
export default function Dashboard() {
  const { user } = useAuth()
  const { decks, loading, error, fetchDecks, createDeck, deleteDeck } =
    useDecks()
  const {
    stats,
    loading: statsLoading,
    error: statsError,
    fetchAnalytics,
  } = useAnalytics()

  const totalDue = decks.reduce(
    (sum, deck) => sum + (deck.due_count || 0),
    0,
  )
  const totalCards = decks.reduce(
    (sum, deck) => sum + (deck.card_count || 0),
    0,
  )
  const priority = prioritizeDecks(decks)

  // Page chrome (title, nav, theme, account) comes from AppShell — this page
  // only owns its content.
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6">
      <header>
        <h2 className="text-xl font-semibold">
          Welcome{user?.email ? `, ${user.email}` : ''}
        </h2>
        <p className="text-sm text-muted-foreground">
          Keep your knowledge fresh and stay on top of your reviews.
        </p>
      </header>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn’t load your dashboard"
          message="We couldn’t fetch your decks. Check your connection and try again."
          detail={error}
          onRetry={fetchDecks}
        />
      ) : decks.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No decks yet"
          description="Create your first deck to start building your review library."
        >
          <CreateDeckDialog
            createDeck={createDeck}
            trigger={
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                Create Deck
              </Button>
            }
          />
        </EmptyState>
      ) : (
        <>
          <ReviewHero dueCount={totalDue} streak={stats?.streak ?? 0} />
          <StatsSection
            dueCount={totalDue}
            totalCards={totalCards}
            deckCount={decks.length}
            stats={stats}
            statsLoading={statsLoading}
            statsError={statsError}
            onRetryStats={fetchAnalytics}
          />
          <PriorityDecks
            decks={priority}
            totalCount={decks.length}
            onDelete={deleteDeck}
          />
        </>
      )}
    </div>
  )
}
