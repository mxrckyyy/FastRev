import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

function withCardCount(deck) {
  const { cards, ...rest } = deck
  return { ...rest, card_count: cards?.[0]?.count ?? 0 }
}

// Group the user's due cards by deck so every deck row gets a `due_count`
// (used by the dashboard's Due Today stat and the deck-card due badges).
function countDueByDeck(cards) {
  const counts = new Map()
  for (const card of cards) {
    counts.set(card.deck_id, (counts.get(card.deck_id) || 0) + 1)
  }
  return counts
}

export function useDecks() {
  const { user } = useAuth()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Promise style (not async/await) so lint sees setState only in async
  // callbacks — keeps effects free of synchronous cascading renders.
  // Two queries run together: deck rows (with total card counts) and the
  // deck_ids of currently-due cards, merged into `due_count` per deck.
  const fetchDecks = useCallback(() => {
    const now = new Date().toISOString()
    const deckQuery = user
      ? supabase
          .from('decks')
          .select('*, cards(count)')
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null })
    const dueQuery = user
      ? supabase
          .from('cards')
          .select('deck_id')
          .eq('user_id', user.id)
          .lte('due', now)
      : Promise.resolve({ data: [], error: null })
    return Promise.all([deckQuery, dueQuery]).then(
      ([deckResult, dueResult]) => {
        const failure = deckResult.error || dueResult.error
        if (failure) {
          setError(failure.message)
          setLoading(false)
          return null
        }
        setError(null)
        const dueByDeck = countDueByDeck(dueResult.data || [])
        const list = (deckResult.data || []).map((deck) => ({
          ...withCardCount(deck),
          due_count: dueByDeck.get(deck.id) || 0,
        }))
        setDecks(list)
        setLoading(false)
        return list
      },
    )
  }, [user])

  useEffect(() => {
    fetchDecks()
  }, [fetchDecks])

  async function createDeck(name, description) {
    if (!user) {
      const err = { message: 'You must be signed in to create a deck.' }
      setError(err.message)
      return { error: err }
    }
    setError(null)
    const { data, error } = await supabase
      .from('decks')
      .insert({ user_id: user.id, name, description: description || null })
      .select()
      .single()
    if (error) {
      setError(error.message)
      return { error }
    }
    const deck = { ...data, card_count: 0, due_count: 0 }
    setDecks((prev) => [deck, ...prev])
    return { data: deck }
  }

  async function updateDeck(id, data) {
    setError(null)
    const { data: updated, error } = await supabase
      .from('decks')
      .update({ name: data.name, description: data.description })
      .eq('id', id)
      .select()
      .single()
    if (error) {
      setError(error.message)
      return { error }
    }
    setDecks((prev) =>
      prev.map((deck) =>
        deck.id === id ? { ...deck, ...updated, card_count: deck.card_count } : deck,
      ),
    )
    return { data: updated }
  }

  async function deleteDeck(id) {
    setError(null)
    const { error } = await supabase.from('decks').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return { error }
    }
    setDecks((prev) => prev.filter((deck) => deck.id !== id))
    return { error: null }
  }

  return { decks, loading, error, fetchDecks, createDeck, updateDeck, deleteDeck }
}
