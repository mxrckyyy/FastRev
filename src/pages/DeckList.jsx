import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDecks } from '@/hooks/useDecks'

export default function DeckList() {
  const navigate = useNavigate()
  const { decks, loading, error, createDeck, deleteDeck } = useDecks()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const { data, error } = await createDeck(name.trim(), description.trim())
      if (error) {
        setFormError(error.message)
        return
      }
      setDialogOpen(false)
      setName('')
      setDescription('')
      return data
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(deckId) {
    await deleteDeck(deckId)
  }

  function openDeck(deckId) {
    navigate(`/decks/${deckId}`)
  }

  function handleCardKeyDown(event, deckId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDeck(deckId)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your decks</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              New Deck
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a new deck</DialogTitle>
              <DialogDescription>
                A deck is one course or topic you want to review.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="deck-name" className="text-sm font-medium">
                  Name
                </label>
                <Input
                  id="deck-name"
                  required
                  placeholder="e.g. Biology 101"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="deck-description"
                  className="text-sm font-medium"
                >
                  Description
                </label>
                <Textarea
                  id="deck-description"
                  placeholder="Optional — what is this deck about?"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create deck'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading decks…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!loading && !error && decks.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No decks yet — create your first one above.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {decks.map((deck) => (
          <Card
            key={deck.id}
            role="button"
            tabIndex={0}
            aria-label={`Open deck ${deck.name}`}
            className="cursor-pointer transition-colors hover:border-primary/50"
            onClick={() => openDeck(deck.id)}
            onKeyDown={(event) => handleCardKeyDown(event, deck.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base">{deck.name}</CardTitle>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete deck ${deck.name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent
                    onClick={(event) => event.stopPropagation()}
                  >
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete “{deck.name}”?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently deletes the deck and all{' '}
                        {deck.card_count} of its cards. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(deck.id)}
                      >
                        Delete deck
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <CardDescription>
                {deck.description || 'No description'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
