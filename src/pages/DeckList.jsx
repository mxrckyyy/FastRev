import { Layers, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import CreateDeckDialog from '@/components/CreateDeckDialog'
import DeckCard, {
  CreateDeckCard,
  DeckCardSkeleton,
} from '@/components/DeckCard'
import EmptyState from '@/components/EmptyState'
import ErrorState from '@/components/ErrorState'
import { useDecks } from '@/hooks/useDecks'

const DECK_SKELETONS = [0, 1, 2, 3, 4, 5]

/**
 * Deck list + create deck (used by the `/decks` route). The create dialog was
 * extracted into `CreateDeckDialog` so the Dashboard's empty state can reuse
 * it; this page keeps its own `useDecks()` instance, so every mutation here
 * updates exactly this grid.
 *
 * States: loading → skeletons · error → retry panel · empty → EmptyState with
 * a Create Deck CTA · otherwise → responsive grid (1 / 2 / 3 columns) of deck
 * cards ending with a dashed Create Deck tile.
 */
export default function DeckList() {
  const { decks, loading, error, fetchDecks, createDeck, deleteDeck } =
    useDecks()

  const hasDecks = decks.length > 0
  const totalCards = decks.reduce(
    (sum, deck) => sum + (deck.card_count || 0),
    0,
  )

  if (!loading && !error && !hasDecks) {
    return (
      <section className="space-y-4">
        <EmptyState
          icon={Layers}
          title="No decks yet"
          description="Create your first deck to start building your review library. Each deck is one course or topic you want to remember."
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
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Your decks</h2>
          {!loading && !error && hasDecks && (
            <p className="text-sm text-muted-foreground">
              {decks.length} {decks.length === 1 ? 'deck' : 'decks'} ·{' '}
              {totalCards} {totalCards === 1 ? 'card' : 'cards'}
            </p>
          )}
        </div>
        <CreateDeckDialog
          createDeck={createDeck}
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Deck
            </Button>
          }
        />
      </div>

      {loading ? (
        <div aria-busy="true">
          <span className="sr-only" role="status">
            Loading decks…
          </span>
          <div
            aria-hidden="true"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {DECK_SKELETONS.map((index) => (
              <DeckCardSkeleton key={index} />
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn’t load your decks"
          message="We couldn’t fetch your deck list. Check your connection and try again."
          detail={error}
          onRetry={fetchDecks}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard key={deck.id} deck={deck} onDelete={deleteDeck} />
          ))}
          <CreateDeckDialog
            createDeck={createDeck}
            trigger={<CreateDeckCard />}
          />
        </div>
      )}
    </section>
  )
}
