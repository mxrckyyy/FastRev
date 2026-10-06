import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from 'cn'

/**
 * Due-count pill for a deck. "0 due" is deliberately calm (neutral) and any
 * due count > 0 uses a soft primary tint — the number itself always carries
 * the meaning, so this never reads as an error or relies on color alone.
 */
export function DueBadge({ count }) {
  return (
    <Badge variant={count > 0 ? 'soft' : 'secondary'} className="tabular-nums">
      {count > 0 ? `${count} due` : '0 due'}
    </Badge>
  )
}

// The card is clickable for mouse users; keyboard/screen-reader users use the
// title link and the Open button inside it. Inner links stop propagation so a
// single click never pushes two history entries.
function stopPropagation(event) {
  event.stopPropagation()
}

/**
 * Deck preview card. Hierarchy: name → due badge → description → card count →
 * primary action (Open) → secondary action (Delete, optional).
 *
 * The card body is NOT itself an interactive element (no role/tabindex), which
 * keeps Delete/Open from being nested inside another interactive control.
 */
export default function DeckCard({ deck, onDelete }) {
  const navigate = useNavigate()

  function openDeck() {
    navigate(`/decks/${deck.id}`)
  }

  // Deleting is confirmed by the AlertDialog; the result is confirmed by a
  // toast (the card itself just disappears from the grid). A failure also
  // surfaces through the page's ErrorState — the toast anchors it to the
  // action the user just took.
  function handleDelete() {
    onDelete(deck.id).then(({ error }) => {
      if (error) {
        toast.error(`Couldn’t delete “${deck.name}” — try again.`)
      } else {
        toast.success(`Deck “${deck.name}” deleted`)
      }
    })
  }

  return (
    <Card
      className="h-full cursor-pointer p-4 transition hover:-translate-y-0.5 hover:shadow-sm hover:ring-primary/40 focus-within:ring-primary/40"
      onClick={openDeck}
    >
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 break-words text-base font-medium leading-snug">
            <Link
              to={`/decks/${deck.id}`}
              className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={stopPropagation}
            >
              {deck.name}
            </Link>
          </h3>
          <DueBadge count={deck.due_count} />
        </div>

        <p className="line-clamp-2 text-sm text-muted-foreground">
          {deck.description || 'No description'}
        </p>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <p className="text-xs text-muted-foreground">
            {deck.card_count} {deck.card_count === 1 ? 'card' : 'cards'}
          </p>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" asChild onClick={stopPropagation}>
              <Link to={`/decks/${deck.id}`}>
                Open
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete deck ${deck.name}`}
                    onClick={stopPropagation}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{deck.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the deck and all{' '}
                      {deck.card_count} of its cards. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>
                      Delete deck
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}

/** Placeholder matching DeckCard's shape while decks are loading. */
export function DeckCardSkeleton() {
  return (
    <Card className="h-full p-4">
      <div className="flex h-full flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-4/5" />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border/60 pt-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
    </Card>
  )
}

/**
 * Dashed "invitation" tile that opens the create-deck dialog. Used as the
 * DialogTrigger inside CreateDeckDialog, so pass it straight as `trigger`.
 */
export function CreateDeckCard({ className }) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-full min-h-36 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-6 text-center text-muted-foreground transition-colors',
        'hover:border-primary/50 hover:bg-primary/5 hover:text-primary',
        className,
      )}
    >
      <span
        className="flex size-9 items-center justify-center rounded-full bg-muted"
        aria-hidden="true"
      >
        <Plus className="size-4.5" />
      </span>
      <span className="text-sm font-medium">Create Deck</span>
      <span className="text-xs text-muted-foreground">
        Add a new course or topic
      </span>
    </button>
  )
}
