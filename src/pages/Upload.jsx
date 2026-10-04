import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  KeyRound,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCards } from '@/hooks/useCards'
import { useDecks } from '@/hooks/useDecks'
import {
  generateCards,
  hasAnyApiKey,
  loadApiKeys,
  providerLabel,
} from '@/lib/ai'
import SettingsDialog from '@/pages/Settings'

let rowCounter = 0

function makeRow(fields = {}) {
  rowCounter += 1
  return {
    id: `row-${rowCounter}`,
    question: '',
    answer: '',
    source: '',
    ...fields,
  }
}

function isValidRow(row) {
  return Boolean(row.question.trim() && row.answer.trim())
}

function friendlyMessage(error) {
  switch (error?.code) {
    case 'missing_key':
      return 'No API key configured yet. Add a free Gemini key to start generating.'
    case 'invalid_key':
      return 'Your API key was rejected by the provider. Check it in Settings.'
    case 'rate_limit':
      return 'Free tier limit reached. Try again in a minute or switch provider.'
    case 'network':
      return 'Could not reach the AI provider. Check your connection and try again.'
    case 'malformed':
      return 'The AI replied in an unexpected format. Try generating again.'
    default:
      return error?.message || 'Something went wrong while generating cards.'
  }
}

const selectClasses =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export default function Upload() {
  const navigate = useNavigate()
  const { decks, loading: decksLoading, error: decksError } = useDecks()
  const { createCard } = useCards()

  const [deckId, setDeckId] = useState('')
  const [notes, setNotes] = useState('')
  const [apiKeys, setApiKeys] = useState(() => loadApiKeys())

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const [meta, setMeta] = useState(null)

  const [rows, setRows] = useState([])

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  function handleSettingsChange(open) {
    setSettingsOpen(open)
    if (!open) setApiKeys(loadApiKeys())
  }

  async function handleGenerate() {
    setGenError(null)
    setSaveError(null)
    setGenerating(true)
    try {
      const result = await generateCards(notes.trim(), loadApiKeys())
      setRows(result.cards.map((card) => makeRow(card)))
      setMeta({
        provider: result.provider,
        failures: result.failures || [],
        count: result.cards.length,
      })
    } catch (error) {
      setRows([])
      setMeta(null)
      setGenError(error)
    } finally {
      setGenerating(false)
    }
  }

  function updateRow(id, field, value) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    )
  }

  function removeRow(id) {
    setRows((prev) => prev.filter((row) => row.id !== id))
  }

  function addRow() {
    setRows((prev) => [...prev, makeRow()])
  }

  async function handleSave() {
    if (!deckId || saving) return
    const targets = rows.filter(isValidRow)
    if (targets.length === 0) return

    setSaving(true)
    setSaveError(null)

    const savedIds = new Set()
    let failure = null
    for (const row of rows) {
      if (!isValidRow(row)) continue
      const { error } = await createCard(deckId, {
        question: row.question.trim(),
        answer: row.answer.trim(),
        source: row.source.trim(),
      })
      if (error) {
        failure = error
        break
      }
      savedIds.add(row.id)
    }

    setSaving(false)

    if (failure) {
      setRows((prev) => prev.filter((row) => !savedIds.has(row.id)))
      setSaveError(
        `Saved ${savedIds.size} of ${targets.length} cards. ${failure.message}`,
      )
      return
    }

    const deck = decks.find((candidate) => candidate.id === deckId)
    setToast(
      `${savedIds.size} ${savedIds.size === 1 ? 'card' : 'cards'} saved to ${deck?.name || 'deck'}`,
    )
    setTimeout(() => navigate(`/decks/${deckId}`), 1000)
  }

  const validCount = rows.filter(isValidRow).length
  const noKeys = !hasAnyApiKey(apiKeys)
  const canGenerate = Boolean(notes.trim()) && !noKeys && !generating

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to dashboard
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingsOpen(true)}
          >
            <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-6 py-6">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
            Generate cards with AI
          </h1>
          <p className="text-sm text-muted-foreground">
            Paste your notes, pick a deck, then edit the cards before saving.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>
              Paste lecture notes, a chapter, or any study material.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="deck-select" className="text-sm font-medium">
                Deck
              </label>
              <select
                id="deck-select"
                className={selectClasses}
                value={deckId}
                onChange={(event) => setDeckId(event.target.value)}
              >
                <option value="">
                  {decksLoading ? 'Loading decks…' : 'Select a deck…'}
                </option>
                {decks.map((deck) => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} ({deck.card_count})
                  </option>
                ))}
              </select>
              {!decksLoading && decks.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No decks yet —{' '}
                  <Link to="/dashboard" className="underline">
                    create one first
                  </Link>
                  .
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="notes" className="text-sm font-medium">
                Study notes
              </label>
              <Textarea
                id="notes"
                placeholder="Paste your notes here…"
                className="min-h-40"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleGenerate} disabled={!canGenerate}>
                {generating ? (
                  <>
                    <RefreshCw
                      className="mr-2 h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                    Generate Cards
                  </>
                )}
              </Button>
              {noKeys && (
                <p className="text-xs text-muted-foreground">
                  No API key yet —{' '}
                  <button
                    type="button"
                    className="underline hover:text-foreground"
                    onClick={() => setSettingsOpen(true)}
                  >
                    open Settings
                  </button>{' '}
                  to add one.
                </p>
              )}
              {!noKeys && !notes.trim() && (
                <p className="text-xs text-muted-foreground">
                  Paste some notes to generate cards.
                </p>
              )}
            </div>

            {genError && (
              <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="flex items-start gap-2 text-sm text-destructive">
                  <TriangleAlert
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  {friendlyMessage(genError)}
                </p>
                <div className="flex gap-2">
                  {(genError.code === 'missing_key' ||
                    genError.code === 'invalid_key' ||
                    genError.code === 'rate_limit') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSettingsOpen(true)}
                    >
                      <KeyRound className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Open Settings
                    </Button>
                  )}
                  {genError.code === 'network' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Retry
                    </Button>
                  )}
                  {genError.code === 'malformed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Try again
                    </Button>
                  )}
                </div>
              </div>
            )}

            {decksError && (
              <p className="text-sm text-destructive">{decksError}</p>
            )}
          </CardContent>
        </Card>

        {rows.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>
                Preview — {rows.length} {rows.length === 1 ? 'card' : 'cards'}
              </CardTitle>
              <CardDescription>
                {meta
                  ? `${meta.count} generated with ${providerLabel(meta.provider)}${
                      meta.failures.length > 0
                        ? ` · ${meta.failures.map((f) => providerLabel(f.provider)).join(', ')} unavailable`
                        : ''
                    }. `
                  : ''}
                Edit, remove, or add cards before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rows.map((row, index) => (
                <div key={row.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      Card {index + 1}
                      {!isValidRow(row) && ' · needs question and answer'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete card"
                      onClick={() => removeRow(row.id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </Button>
                  </div>
                  <Textarea
                    aria-label={`Question for card ${index + 1}`}
                    placeholder="Question"
                    value={row.question}
                    onChange={(event) =>
                      updateRow(row.id, 'question', event.target.value)
                    }
                  />
                  <Textarea
                    aria-label={`Answer for card ${index + 1}`}
                    placeholder="Answer"
                    value={row.answer}
                    onChange={(event) =>
                      updateRow(row.id, 'answer', event.target.value)
                    }
                  />
                  <Input
                    aria-label={`Source for card ${index + 1}`}
                    placeholder="Source (optional)"
                    value={row.source}
                    onChange={(event) =>
                      updateRow(row.id, 'source', event.target.value)
                    }
                  />
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={addRow}>
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Add blank card
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !deckId || validCount === 0}
                >
                  {saving
                    ? 'Saving…'
                    : `Save to Deck (${validCount})`}
                </Button>
              </div>

              {!deckId && (
                <p className="text-xs text-muted-foreground">
                  Choose a deck above to save these cards.
                </p>
              )}
              {saveError && (
                <p className="text-sm text-destructive">{saveError}</p>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <SettingsDialog open={settingsOpen} onOpenChange={handleSettingsChange} />

      {toast && (
        <div
          role="status"
          className="fixed right-6 bottom-6 z-50 rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  )
}
