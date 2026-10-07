import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { createEmptyCardFSRS } from '@/lib/fsrs'

export function useCards(deckId) {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(Boolean(deckId))
  const [error, setError] = useState(null)

  // Promise style (not async/await) so lint sees setState only in async
  // callbacks — keeps effects free of synchronous cascading renders.
  const fetchCards = useCallback(() => {
    if (!deckId) return Promise.resolve(null)
    return supabase
      .from('cards')
      .select('*')
      .eq('deck_id', deckId)
      .order('created_at', { ascending: true })
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
  }, [deckId])

  useEffect(() => {
    fetchCards()
  }, [fetchCards])

  async function createCard(targetDeckId, { question, answer, source }) {
    if (!user) {
      const err = { message: 'You must be signed in to add a card.', friendly: true }
      setError(err.message)
      return { error: err }
    }
    setError(null)
    const { data, error } = await supabase
      .from('cards')
      .insert({
        deck_id: targetDeckId,
        user_id: user.id,
        question,
        answer,
        source: source || null,
        ...createEmptyCardFSRS(),
      })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return { error }
    }
    setCards((prev) => [...prev, data])
    return { data }
  }

  async function updateCard(id, data) {
    setError(null)
    const payload = {}
    if (data.question !== undefined) payload.question = data.question
    if (data.answer !== undefined) payload.answer = data.answer
    if (data.source !== undefined) payload.source = data.source || null
    const { data: updated, error } = await supabase
      .from('cards')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setError(error.message)
      return { error }
    }
    setCards((prev) => prev.map((card) => (card.id === id ? updated : card)))
    return { data: updated }
  }

  async function deleteCard(id) {
    setError(null)
    const { error } = await supabase.from('cards').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return { error }
    }
    setCards((prev) => prev.filter((card) => card.id !== id))
    return { error: null }
  }

  return { cards, loading, error, fetchCards, createCard, updateCard, deleteCard }
}
