import { createEmptyCard, fsrs, Rating, generatorParameters } from 'ts-fsrs'

const f = fsrs(generatorParameters({ enable_fuzz: true }))

export { Rating }

function toDate(value) {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

// Takes a DB card row (timestamptz values arrive as strings, may be null)
// plus a Rating and returns the updated FSRS fields for the cards table.
export function scheduleCard(card, rating) {
  const now = new Date()
  const current = {
    due: toDate(card.due) ?? now,
    stability: card.stability ?? 0,
    difficulty: card.difficulty ?? 0,
    elapsed_days: card.elapsed_days ?? 0,
    scheduled_days: card.scheduled_days ?? 0,
    reps: card.reps ?? 0,
    lapses: card.lapses ?? 0,
    state: card.state ?? 0,
  }
  const lastReview = toDate(card.last_review)
  if (lastReview) current.last_review = lastReview

  const { card: next } = f.next(current, now, rating)

  return {
    due: next.due.toISOString(),
    stability: next.stability,
    difficulty: next.difficulty,
    elapsed_days: next.elapsed_days,
    scheduled_days: next.scheduled_days,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: toDate(next.last_review)?.toISOString() ?? null,
  }
}

// Default FSRS fields for a brand-new card (matches the cards table columns).
export function createEmptyCardFSRS() {
  const card = createEmptyCard(new Date())
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: null,
  }
}
