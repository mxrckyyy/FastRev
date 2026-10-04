import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  Flame,
  Layers,
  RotateCw,
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
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalytics } from '@/hooks/useAnalytics'

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--popover-foreground)',
  fontSize: 12,
}

function StatCard({ label, value, caption, icon }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ children }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 text-center">
      <p className="text-sm text-muted-foreground">{children}</p>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}

export default function Analytics() {
  const { stats, loading, error, fetchAnalytics } = useAnalytics()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-6">
        <div>
          <h1 className="text-xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Retention, upcoming workload, and your weakest decks.
          </p>
        </div>

        {loading && <AnalyticsSkeleton />}

        {!loading && error && (
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive">
              Could not load analytics: {error}
            </p>
            <Button variant="outline" size="sm" onClick={fetchAnalytics}>
              <RotateCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && !stats && (
          <EmptyState>No analytics to show yet.</EmptyState>
        )}

        {!loading && !error && stats && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="Retention"
                value={stats.retention === null ? '—' : `${stats.retention}%`}
                caption={
                  stats.total === 0
                    ? 'Good + Easy reviews'
                    : `${stats.good} of ${stats.total} positive reviews`
                }
                icon={
                  <CalendarDays
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
              />
              <StatCard
                label="Total reviews"
                value={stats.total}
                caption="All time"
                icon={
                  <Layers
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
              />
              <StatCard
                label="Current streak"
                value={stats.streak}
                caption={
                  stats.streak === 1 ? 'day with reviews' : 'days with reviews'
                }
                icon={
                  <Flame
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
              />
              <StatCard
                label="Cards learned"
                value={stats.cardsLearned}
                caption="Reached review state"
                icon={
                  <Layers
                    className="h-4 w-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Cards due — next 7 days</CardTitle>
                <CardDescription>
                  How much work is coming up. Overdue cards count as today.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.forecast.every((day) => day.count === 0) ? (
                  <EmptyState>
                    Nothing due in the next 7 days. Nicely done.
                  </EmptyState>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={stats.forecast}
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

            <Card>
              <CardHeader>
                <CardTitle>Reviews — last 14 days</CardTitle>
                <CardDescription>
                  How much you have actually reviewed each day.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.activity.every((day) => day.count === 0) ? (
                  <EmptyState>
                    No reviews in the last 14 days yet.
                  </EmptyState>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={stats.activity}
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

            <Card>
              <CardHeader>
                <CardTitle>Weak topics</CardTitle>
                <CardDescription>
                  Decks ordered by lowest accuracy — lowest first. Weak = Again
                  + Hard ratings.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats.weakDecks.length === 0 ? (
                  <EmptyState>
                    No review history yet — finish a review session to see your
                    weak decks here.
                  </EmptyState>
                ) : (
                  <ul className="divide-y">
                    {stats.weakDecks.map((deck, index) => (
                      <li
                        key={deck.id}
                        className="flex items-center justify-between gap-4 py-3"
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
                        <div className="shrink-0 text-right">
                          <p
                            className={`text-sm font-semibold ${
                              deck.accuracy < 60 ? 'text-destructive' : ''
                            }`}
                          >
                            {deck.accuracy}%
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {100 - deck.accuracy}% weak
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}
