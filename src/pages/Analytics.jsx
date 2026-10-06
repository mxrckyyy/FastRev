import { Link } from 'react-router-dom'
import {
  Brain,
  CalendarDays,
  ChartColumn,
  Flame,
  Minus,
  Play,
  Repeat,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import EmptyState from '@/components/EmptyState'
import ErrorState from '@/components/ErrorState'
import { StatCard, StatCardSkeleton } from '@/components/StatCard'
import { useAnalytics } from '@/hooks/useAnalytics'
import { cn } from 'cn'

// Recharts takes inline styles, so it reads the same design tokens directly
// (bg-elevated = dialogs/popovers layer) instead of hardcoded colors.
const tooltipStyle = {
  backgroundColor: 'var(--elevated)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--foreground)',
  fontSize: 12,
}

// Icon-chip tones for the highlight chips (same verified pairs StatCard uses;
// warning keeps its light-theme foreground pairing so text always passes).
const INSIGHT_TONES = {
  muted: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  danger: 'bg-destructive/10 text-destructive',
}

function sumCounts(buckets) {
  return buckets.reduce((sum, day) => sum + day.count, 0)
}

// Reviews in the last 7 activity days vs the 7 before them. Returns null when
// the previous window is empty — a percentage against zero would be noise.
function computeTrendPct(activity) {
  const previous = sumCounts(activity.slice(-14, -7))
  if (previous === 0) return null
  const current = sumCounts(activity.slice(-7))
  return Math.round(((current - previous) / previous) * 100)
}

/**
 * Short, real-data sentences for the Highlights chips. Every item is derived
 * from stats that actually exist — nothing is predicted or invented. At least
 * one item always exists (the streak nudge covers the "nothing flagged" case).
 */
function buildInsights(stats) {
  const items = []
  const dueToday = stats.forecast[0]?.count ?? 0

  if (dueToday > 0) {
    items.push({
      key: 'due',
      icon: CalendarDays,
      tone: 'muted',
      text:
        dueToday === 1
          ? '1 card is due today.'
          : `${dueToday} cards are due today.`,
    })
  }

  if (stats.streak > 0) {
    items.push({
      key: 'streak',
      icon: Flame,
      tone: 'success',
      text:
        stats.streak === 1
          ? '1-day streak — review today to keep it going.'
          : `${stats.streak}-day review streak going.`,
    })
  } else {
    items.push({
      key: 'streak',
      icon: Flame,
      tone: 'muted',
      text: 'No active streak — review today to start one.',
    })
  }

  const worst = stats.weakDecks[0]
  if (worst && worst.accuracy < 60) {
    items.push({
      key: 'weak',
      icon: TriangleAlert,
      tone: 'danger',
      text: `“${worst.name}” needs attention — ${worst.accuracy}% accuracy.`,
    })
  }

  return items
}

/** Week-over-week comparison chip shown in the activity card header. */
function TrendBadge({ pct }) {
  if (pct === null) return null
  const Icon = pct > 0 ? TrendingUp : pct < 0 ? TrendingDown : Minus
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        pct > 0
          ? 'bg-success/10 text-success'
          : pct < 0
            ? 'bg-warning/10 text-warning-foreground dark:text-warning'
            : 'bg-muted text-muted-foreground',
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {`${pct > 0 ? '+' : ''}${pct}% vs previous 7 days`}
    </span>
  )
}

/** Compact note used inside charts when a dataset is entirely zero. */
function InlineEmpty({ children }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function ForecastCard({ forecast }) {
  const empty = forecast.every((day) => day.count === 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cards due — next 7 days</CardTitle>
        <CardDescription>
          How much work is coming up. Overdue cards count as today.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? (
          <InlineEmpty>Nothing due in the next 7 days. Nicely done.</InlineEmpty>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={forecast}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: 'var(--muted)' }}
                  contentStyle={tooltipStyle}
                />
                <Bar
                  dataKey="count"
                  name="Cards due"
                  fill="var(--chart-3)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityCard({ activity, trendPct }) {
  const empty = activity.every((day) => day.count === 0)
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Review activity — last 14 days</CardTitle>
        <CardDescription>
          How much you actually reviewed each day.
        </CardDescription>
        <CardAction>
          <TrendBadge pct={trendPct} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {empty ? (
          <InlineEmpty>No reviews in the last 14 days yet.</InlineEmpty>
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={activity}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval={1}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--border)' }}
                  contentStyle={tooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Reviews"
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  dot={{ r: 2.5, fill: 'var(--foreground)' }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Retention headline plus the two-bucket split every review falls into
 * (positive = Good/Easy, weak = Again/Hard). One success-colored fill over
 * the muted track (standard meter treatment); the split is labeled with exact
 * counts so color is never the only signal.
 */
function RatingBreakdownCard({ stats }) {
  const goodShare = (stats.good / stats.total) * 100
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rating breakdown</CardTitle>
        <CardDescription>
          Good + Easy versus Again + Hard, across every review.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-3xl font-semibold tabular-nums">
          {stats.retention}%
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            retention
          </span>
        </p>
        <div
          role="img"
          aria-label={`${stats.good} of ${stats.total} reviews were Good or Easy (${stats.retention}%); ${stats.weak} were Again or Hard.`}
          className="h-3 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-success"
            style={{ width: `${goodShare}%` }}
          />
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full bg-success"
              aria-hidden="true"
            />
            Good + Easy
            <span className="tabular-nums text-muted-foreground">
              {stats.good} {stats.good === 1 ? 'review' : 'reviews'}
            </span>
          </li>
          <li className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full bg-muted-foreground"
              aria-hidden="true"
            />
            Again + Hard
            <span className="tabular-nums text-muted-foreground">
              {stats.weak} {stats.weak === 1 ? 'review' : 'reviews'}
            </span>
          </li>
        </ul>
        <p className="text-xs text-muted-foreground">
          Retention = share of reviews rated Good or Easy.
        </p>
      </CardContent>
    </Card>
  )
}

function HighlightsCard({ items }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Highlights</CardTitle>
        <CardDescription>A quick read on where things stand.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-wrap gap-2.5">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <li
                key={item.key}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md',
                    INSIGHT_TONES[item.tone],
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-3.5" />
                </span>
                <span>{item.text}</span>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}

/**
 * Deck-level performance (the weak-topics section): every deck with review
 * history, weakest accuracy first, each with an accessible progress bar.
 * Below 60% accuracy the bar and value switch to destructive — the existing
 * "weak" convention — but the percentage is always spelled out in text.
 */
function WeakTopicsCard({ decks }) {
  const best = decks.length > 1 ? decks[decks.length - 1] : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weak topics</CardTitle>
        <CardDescription>
          Decks ordered by lowest accuracy — weakest first. Accuracy = the
          Good + Easy share of reviews.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {decks.length === 0 ? (
          <InlineEmpty>
            No deck-level history yet — finish a review session to see how each
            deck performs.
          </InlineEmpty>
        ) : (
          <>
            <ul className="divide-y">
              {decks.map((deck, index) => (
                <li
                  key={deck.id}
                  className="grid gap-2.5 py-3.5 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-center sm:gap-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="w-5 shrink-0 text-xs text-muted-foreground">
                      {index + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {deck.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {deck.total}{' '}
                        {deck.total === 1 ? 'review' : 'reviews'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div
                      role="progressbar"
                      aria-valuenow={deck.accuracy}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${deck.name} accuracy`}
                      className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                    >
                      <div
                        className={cn(
                          'h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none',
                          deck.accuracy < 60
                            ? 'bg-destructive'
                            : 'bg-primary',
                        )}
                        style={{ width: `${deck.accuracy}%` }}
                      />
                    </div>
                    <span
                      className={cn(
                        'w-12 shrink-0 text-right text-sm font-semibold tabular-nums',
                        deck.accuracy < 60 && 'text-destructive',
                      )}
                    >
                      {deck.accuracy}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {best && (
              <p className="mt-1 border-t border-border pt-3 text-xs text-muted-foreground">
                Strongest: “{best.name}” — {best.accuracy}% accuracy.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/** Mirrors the loaded layout while data is in flight. */
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 sm:space-y-8" aria-busy="true">
      <span className="sr-only" role="status">
        Loading analytics…
      </span>
      <div aria-hidden="true" className="space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2.5">
              <Skeleton className="h-9 w-56 rounded-lg" />
              <Skeleton className="h-9 w-64 rounded-lg" />
              <Skeleton className="h-9 w-48 rounded-lg" />
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-56 w-full" />
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-3 w-full" />
            <div className="flex gap-6">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-40" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-80" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-4">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/**
 * Loaded analytics content. Kept separate from the page component so every
 * state (empty vs full) can be rendered in isolation for smoke tests.
 */
export function AnalyticsView({ stats }) {
  // No review history yet: explain what will appear (with the useful next
  // step) instead of showing zero-filled charts. The due forecast still
  // renders — it reflects real card data, not review history.
  if (stats.total === 0) {
    const hasDue = stats.forecast.some((day) => day.count > 0)
    return (
      <div className="space-y-6 sm:space-y-8">
        <EmptyState
          icon={ChartColumn}
          title="Your analytics will appear here"
          description="Complete a few reviews to start seeing your learning patterns."
        >
          <Button size="lg" asChild>
            <Link to="/review">
              <Play aria-hidden="true" />
              Start Review
            </Link>
          </Button>
        </EmptyState>
        {hasDue && <ForecastCard forecast={stats.forecast} />}
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section
        aria-label="Key statistics"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <StatCard
          icon={Target}
          tone="success"
          label="Retention"
          value={`${stats.retention}%`}
          caption={`${stats.good} of ${stats.total} positive reviews`}
        />
        <StatCard
          icon={Repeat}
          tone="muted"
          label="Total reviews"
          value={stats.total}
          caption="All time"
        />
        <StatCard
          icon={Flame}
          tone="warning"
          label="Streak"
          value={stats.streak}
          caption={
            stats.streak === 1 ? 'day with reviews' : 'days with reviews'
          }
        />
        <StatCard
          icon={Brain}
          tone="primary"
          label="Cards learned"
          value={stats.cardsLearned}
          caption="Reached review state"
        />
      </section>

      <HighlightsCard items={buildInsights(stats)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <ActivityCard
          activity={stats.activity}
          trendPct={computeTrendPct(stats.activity)}
        />
        <ForecastCard forecast={stats.forecast} />
      </div>

      <RatingBreakdownCard stats={stats} />
      <WeakTopicsCard decks={stats.weakDecks} />
    </div>
  )
}

export default function Analytics() {
  const { stats, loading, error, fetchAnalytics } = useAnalytics()

  // Page title lives in the shell top bar; this block keeps only the intro.
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:space-y-8 sm:px-6">
      <header>
        <h2 className="text-xl font-semibold">Your learning at a glance</h2>
        <p className="text-sm text-muted-foreground">
          Track your review activity and understand your learning progress.
        </p>
      </header>

      {loading ? (
        <AnalyticsSkeleton />
      ) : error ? (
        <ErrorState
          title="Couldn’t load your analytics"
          message="We couldn’t fetch your review data. Check your connection and try again."
          onRetry={fetchAnalytics}
        />
      ) : stats ? (
        <AnalyticsView stats={stats} />
      ) : (
        <InlineEmpty>No analytics to show yet.</InlineEmpty>
      )}
    </div>
  )
}
