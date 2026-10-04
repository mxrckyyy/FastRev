import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Rating } from '@/lib/fsrs'

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function dayKey(value) {
  const date = startOfDay(value)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function dayLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function isPositive(rating) {
  return rating === Rating.Good || rating === Rating.Easy
}

// Retention = % of reviews rated Good or Easy.
export function computeSummary(logs) {
  const total = logs.length
  const good = logs.filter((log) => isPositive(log.rating)).length
  return {
    total,
    good,
    weak: total - good,
    retention: total > 0 ? Math.round((good / total) * 100) : null,
  }
}

// Consecutive days with at least one review, counting back from today
// (yesterday counts if today has no reviews yet).
export function computeStreak(logs) {
  const days = new Set(logs.map((log) => dayKey(log.reviewed_at)))
  if (days.size === 0) return 0
  const cursor = startOfDay(new Date())
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// Cards due on each of the next `days` days (overdue cards count as today).
export function buildDueForecast(cards, days = 7) {
  const today = startOfDay(new Date())
  const buckets = []
  const byKey = new Map()
  for (let index = 0; index < days; index += 1) {
    const date = new Date(today)
    date.setDate(date.getDate() + index)
    const bucket = { key: dayKey(date), label: dayLabel(date), count: 0 }
    buckets.push(bucket)
    byKey.set(bucket.key, bucket)
  }
  for (const card of cards) {
    const due = new Date(card.due)
    let key = dayKey(due)
    if (byKey.has(key)) {
      byKey.get(key).count += 1
    } else if (due < today) {
      byKey.get(buckets[0].key).count += 1 // overdue → counts for today
    }
  }
  return buckets
}

// Reviews per day over the last `days` days.
export function buildActivity(logs, days = 14) {
  const today = startOfDay(new Date())
  const buckets = []
  const byKey = new Map()
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today)
    date.setDate(date.getDate() - index)
    const bucket = { key: dayKey(date), label: dayLabel(date), count: 0 }
    buckets.push(bucket)
    byKey.set(bucket.key, bucket)
  }
  for (const log of logs) {
    const bucket = byKey.get(dayKey(log.reviewed_at))
    if (bucket) bucket.count += 1
  }
  return buckets
}

// Decks ordered by lowest accuracy (accuracy = Good+Easy %, weak = Again+Hard %).
export function computeWeakDecks(logs) {
  const byDeck = new Map()
  for (const log of logs) {
    const deck = log.card?.deck
    if (!deck?.id) continue
    const entry = byDeck.get(deck.id) || {
      id: deck.id,
      name: deck.name || 'Untitled deck',
      total: 0,
      good: 0,
    }
    entry.total += 1
    if (isPositive(log.rating)) entry.good += 1
    byDeck.set(deck.id, entry)
  }
  return Array.from(byDeck.values())
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      total: entry.total,
      accuracy: Math.round((entry.good / entry.total) * 100),
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total)
}

export function useAnalytics() {
  const { user } = useAuth()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Promise style (not async/await) so lint sees setState only in async
  // callbacks — keeps effects free of synchronous cascading renders.
  const fetchAnalytics = useCallback(() => {
    if (!user) {
      return Promise.resolve().then(() => {
        setLoading(false)
        return null
      })
    }
    return Promise.resolve()
      .then(() => {
        setLoading(true)
        return Promise.all([
          supabase
            .from('review_logs')
            .select('rating, reviewed_at, card:cards(deck:decks(id, name))'),
          supabase.from('cards').select('due, state'),
        ])
      })
      .then(([logsResult, cardsResult]) => {
        const failure = logsResult.error || cardsResult.error
        if (failure) {
          setError(failure.message)
          setLoading(false)
          return null
        }
        const logs = logsResult.data || []
        const cards = cardsResult.data || []
        const next = {
          ...computeSummary(logs),
          streak: computeStreak(logs),
          cardsLearned: cards.filter((card) => card.state >= 2).length,
          forecast: buildDueForecast(cards),
          activity: buildActivity(logs),
          weakDecks: computeWeakDecks(logs),
        }
        setError(null)
        setStats(next)
        setLoading(false)
        return next
      })
  }, [user])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  return { stats, loading, error, fetchAnalytics }
}
