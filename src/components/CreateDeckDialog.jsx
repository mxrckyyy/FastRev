import { useState } from 'react'
import { toast } from 'sonner'
import LoadingButton from '@/components/LoadingButton'
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

/**
 * Create-deck dialog (name + optional description). The form logic is the
 * same one DeckList used before it was extracted — it is self-contained
 * (owns its open/submitting/error state) and calls the `createDeck` function
 * passed in from the caller's `useDecks()` instance, so the caller's deck
 * list updates automatically on success.
 *
 * `trigger` can be any element that accepts a ref (a Button, or the dashed
 * CreateDeckCard).
 */
export default function CreateDeckDialog({ createDeck, trigger }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleCreate(event) {
    event.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const { error } = await createDeck(name.trim(), description.trim())
      if (error) {
        setFormError(error.message)
        return
      }
      toast.success(`Deck “${name.trim()}” created`)
      setOpen(false)
      setName('')
      setDescription('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
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
            <label htmlFor="deck-description" className="text-sm font-medium">
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
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          )}
          <DialogFooter>
            <LoadingButton
              type="submit"
              loading={submitting}
              loadingLabel="Creating…"
            >
              Create deck
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
