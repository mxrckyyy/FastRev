import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import LoadingButton from '@/components/LoadingButton'
import { useCards } from '@/hooks/useCards'
import { useDecks } from '@/hooks/useDecks'

function CardFormFields({ form, setForm, idPrefix }) {
  return (
    <>
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-question`} className="text-sm font-medium">
          Question
        </label>
        <Textarea
          id={`${idPrefix}-question`}
          required
          placeholder="e.g. What is the powerhouse of the cell?"
          value={form.question}
          onChange={(event) =>
            setForm({ ...form, question: event.target.value })
          }
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-answer`} className="text-sm font-medium">
          Answer
        </label>
        <Textarea
          id={`${idPrefix}-answer`}
          required
          placeholder="e.g. The mitochondria"
          value={form.answer}
          onChange={(event) => setForm({ ...form, answer: event.target.value })}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-source`} className="text-sm font-medium">
          Source
        </label>
        <Input
          id={`${idPrefix}-source`}
          placeholder="Optional — e.g. page 42, lecture 3"
          value={form.source}
          onChange={(event) => setForm({ ...form, source: event.target.value })}
        />
      </div>
    </>
  )
}

const emptyForm = { question: '', answer: '', source: '' }

/** Mirrors the deck header + card list shape so nothing jumps on load. */
function DeckDetailSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6"
      aria-busy="true"
    >
      <span className="sr-only" role="status">
        Loading deck…
      </span>
      <div aria-hidden="true" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3.5 w-32" />
          </div>
          <Skeleton className="h-8 w-28 rounded-lg" />
        </div>
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="space-y-2.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DeckDetail() {
  const { id } = useParams()
  const { decks, loading: decksLoading, error: decksError } = useDecks()
  const {
    cards,
    loading: cardsLoading,
    error: cardsError,
    createCard,
    updateCard,
    deleteCard,
  } = useCards(id)

  const deck = decks.find((candidate) => candidate.id === id)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState(emptyForm)
  const [addFormError, setAddFormError] = useState(null)
  const [adding, setAdding] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editFormError, setEditFormError] = useState(null)
  const [saving, setSaving] = useState(false)

  const loading = decksLoading || cardsLoading
  const error = decksError || cardsError

  async function handleAdd(event) {
    event.preventDefault()
    setAddFormError(null)
    setAdding(true)
    try {
      const { error } = await createCard(id, {
        question: addForm.question.trim(),
        answer: addForm.answer.trim(),
        source: addForm.source.trim(),
      })
      if (error) {
        setAddFormError(error.message)
        return
      }
      toast.success('Card added')
      setAddOpen(false)
      setAddForm(emptyForm)
    } finally {
      setAdding(false)
    }
  }

  function startEditing(card) {
    setEditingId(card.id)
    setEditForm({
      question: card.question,
      answer: card.answer,
      source: card.source || '',
    })
    setEditFormError(null)
  }

  function cancelEditing() {
    setEditingId(null)
    setEditForm(emptyForm)
    setEditFormError(null)
  }

  async function handleSave(event) {
    event.preventDefault()
    setEditFormError(null)
    setSaving(true)
    try {
      const { error } = await updateCard(editingId, {
        question: editForm.question.trim(),
        answer: editForm.answer.trim(),
        source: editForm.source.trim(),
      })
      if (error) {
        setEditFormError(error.message)
        return
      }
      toast.success('Card updated')
      cancelEditing()
    } finally {
      setSaving(false)
    }
  }

  // Deletion has no form to show a result in, so the outcome is a toast
  // (the row itself just disappears; failures also reach the page error line).
  function handleDeleteCard(card) {
    deleteCard(card.id).then(({ error }) => {
      if (error) {
        toast.error('Couldn’t delete that card — try again.')
      } else {
        toast.success('Card deleted')
      }
    })
  }

  if (loading) {
    return <DeckDetailSkeleton />
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {!deck ? (
          <div className="space-y-4">
            <p role="alert" className="text-sm text-destructive">
              {error ? error : 'Deck not found.'}
            </p>
            <Button variant="outline" asChild>
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-semibold">{deck.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                  {deck.description ? ` · ${deck.description}` : ''}
                </p>
              </div>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 size-4" aria-hidden="true" />
                    Add Card
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add a card</DialogTitle>
                    <DialogDescription>
                      Write a question and its answer. Source is optional.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAdd} className="space-y-4">
                    <CardFormFields
                      form={addForm}
                      setForm={setAddForm}
                      idPrefix="add"
                    />
                    {addFormError && (
                      <p role="alert" className="text-sm text-destructive">
                        {addFormError}
                      </p>
                    )}
                    <DialogFooter>
                      <LoadingButton
                        type="submit"
                        loading={adding}
                        loadingLabel="Adding…"
                      >
                        Add card
                      </LoadingButton>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            {cards.length === 0 && !error && (
              <p className="text-sm text-muted-foreground">
                No cards yet — add your first card above.
              </p>
            )}

            <ul className="space-y-4">
              {cards.map((card) => (
                <li key={card.id}>
                  <Card>
                  {editingId === card.id ? (
                    <CardContent className="pt-6">
                      <form onSubmit={handleSave} className="space-y-4">
                        <CardFormFields
                          form={editForm}
                          setForm={setEditForm}
                          idPrefix={`edit-${card.id}`}
                        />
                        {editFormError && (
                          <p role="alert" className="text-sm text-destructive">
                            {editFormError}
                          </p>
                        )}
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={cancelEditing}
                            disabled={saving}
                          >
                            Cancel
                          </Button>
                          <LoadingButton
                            type="submit"
                            loading={saving}
                            loadingLabel="Saving…"
                          >
                            Save changes
                          </LoadingButton>
                        </div>
                      </form>
                    </CardContent>
                  ) : (
                    <>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">
                            {card.question}
                          </CardTitle>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit card"
                              onClick={() => startEditing(card)}
                            >
                              <Pencil className="size-4" aria-hidden="true" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete card"
                                >
                                  <Trash2
                                    className="size-4"
                                    aria-hidden="true"
                                  />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete this card?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently deletes the card and its
                                    review history. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteCard(card)}
                                  >
                                    Delete card
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <CardDescription>{card.answer}</CardDescription>
                      </CardHeader>
                      {card.source && (
                        <CardContent>
                          <p className="text-xs text-muted-foreground">
                            Source: {card.source}
                          </p>
                        </CardContent>
                      )}
                    </>
                  )}
                </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
