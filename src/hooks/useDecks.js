import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

function withCardCount(deck) {
  const { cards, ...rest } = deck
  return { ...rest, card_count: cards?.[0]?.count ?? 0 }
}

// One in-flight decks request shared by every useDecks() consumer that
// mounts while it is pending (see fetchDecks below). Keyed by user id so a
// logout/login in the same session can never join the previous user's
// request; released when the promise settles.
let inflightDecks = null

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
  //
  // Performance (Phase 11): AppShell and the mounted page both call
  // useDecks() on every full page load, which used to fire the same two
  // queries twice in parallel. Concurrent callers now JOIN one in-flight
  // request instead of starting a duplicate. Results are deliberately NOT
  // cached: each caller still gets its own state, later mounts still
  // refetch, and mutations behave exactly as before — only the duplicate
  // network race is gone.
  const fetchDecks = useCallback(() => {
    // Join the shared request only when it belongs to this user; otherwise
    // start one (or resolve the signed-out empty list). Every setState
    // stays inside .then() callbacks so effects never render synchronously.
    let request = user && inflightDecks?.userId === user.id ? inflightDecks.promise : null
    if (!request) {
      if (!user) {
        request = Promise.resolve({ error: null, list: [] })
      } else {
        const now = new Date().toISOString()
        const deckQuery = supabase
          .from('decks')
          .select('*, cards(count)')
          .order('created_at', { ascending: false })
        const dueQuery = supabase
          .from('cards')
          .select('deck_id')
          .eq('user_id', user.id)
          .lte('due', now)
        // The shared promise resolves to { error, list } and never rejects,
        // so every joiner can handle both outcomes in one .then().
        request = Promise.all([deckQuery, dueQuery]).then(
          ([deckResult, dueResult]) => {
            const failure = deckResult.error || dueResult.error
            if (failure) return { error: failure, list: null }
            const dueByDeck = countDueByDeck(dueResult.data || [])
            const list = (deckResult.data || []).map((deck) => ({
              ...withCardCount(deck),
              due_count: dueByDeck.get(deck.id) || 0,
            }))
            return { error: null, list }
          },
          (rejection) => ({
            error: { message: rejection?.message || String(rejection) },
            list: null,
          }),
        )
        const entry = { userId: user.id, promise: request }
        inflightDecks = entry
        // Drop the entry as soon as it settles so the NEXT mount refetches.
        const release = () => {
          if (inflightDecks === entry) inflightDecks = null
        }
        request.then(release, release)
      }
    }
    return request.then(({ error: failure, list }) => {
      if (failure) {
        setError(failure.message)
        setLoading(false)
        return null
      }
      setError(null)
      setDecks(list)
      setLoading(false)
      return list
    })
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
