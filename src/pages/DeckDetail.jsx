import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
      cancelEditing()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {!deck ? (
          <div className="space-y-4">
            <p className="text-sm text-destructive">
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
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
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
                      <p className="text-sm text-destructive">{addFormError}</p>
                    )}
                    <DialogFooter>
                      <Button type="submit" disabled={adding}>
                        {adding ? 'Adding…' : 'Add card'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {cards.length === 0 && !error && (
              <p className="text-sm text-muted-foreground">
                No cards yet — add your first card above.
              </p>
            )}

            <div className="space-y-4">
              {cards.map((card) => (
                <Card key={card.id}>
                  {editingId === card.id ? (
                    <CardContent className="pt-6">
                      <form onSubmit={handleSave} className="space-y-4">
                        <CardFormFields
                          form={editForm}
                          setForm={setEditForm}
                          idPrefix={`edit-${card.id}`}
                        />
                        {editFormError && (
                          <p className="text-sm text-destructive">
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
                          <Button type="submit" disabled={saving}>
                            {saving ? 'Saving…' : 'Save changes'}
                          </Button>
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
                              <Pencil className="h-4 w-4" aria-hidden="true" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete card"
                                >
                                  <Trash2
                                    className="h-4 w-4"
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
                                    onClick={() => deleteCard(card.id)}
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
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
