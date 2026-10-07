import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { scheduleCard } from '@/lib/fsrs'

const FSRS_FIELDS = [
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'reps',
  'lapses',
  'state',
  'last_review',
]

function pickFsrsFields(next) {
  const payload = {}
  for (const field of FSRS_FIELDS) payload[field] = next[field]
  return payload
}

export function useReviews() {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [dueCount, setDueCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDueCards = useCallback(
    (limit = 50) => {
      setLoading(true)
      if (!user) {
        setLoading(false)
        return Promise.resolve(null)
      }
      return supabase
        .from('cards')
        .select('*')
        .eq('user_id', user.id)
        .lte('due', new Date().toISOString())
        .order('due', { ascending: true })
        .limit(limit)
        .then(({ data, error }) => {
          if (error) {
            setError(error.message)
            setLoading(false)
            return null
          }
          setError(null)
          setCards(data)
          setLoading(false)
          return data
        })
    },
    [user],
  )

  const fetchDueCount = useCallback(() => {
    if (!user) return Promise.resolve(null)
    return supabase
      .from('cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .lte('due', new Date().toISOString())
      .then(({ count, error }) => {
        if (error) {
          setError(error.message)
          return null
        }
        setDueCount(count)
        return count
      })
  }, [user])

  async function submitReview(cardId, rating) {
    if (!user) {
      const err = { message: 'You must be signed in to review cards.', friendly: true }
      setError(err.message)
      return { error: err }
    }
    setError(null)

    const { data: card, error: readError } = await supabase
      .from('cards')
      .select('*')
      .eq('id', cardId)
      .single()

    if (readError) {
      setError(readError.message)
      return { error: readError }
    }

    const next = scheduleCard(card, rating)

    const { error: updateError } = await supabase
      .from('cards')
      .update(pickFsrsFields(next))
      .eq('id', cardId)

    if (updateError) {
      setError(updateError.message)
      return { error: updateError }
    }

    const { error: logError } = await supabase.from('review_logs').insert({
      card_id: cardId,
      user_id: user.id,
      rating,
    })

    if (logError) {
      setError(logError.message)
      return { error: logError }
    }

    return { data: next }
  }

  return {
    cards,
    dueCount,
    loading,
    error,
    fetchDueCards,
    fetchDueCount,
    submitReview,
  }
}
