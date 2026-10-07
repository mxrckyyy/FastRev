import { useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  FileUp,
  KeyRound,
  Plus,
  RefreshCw,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import EmptyState from '@/components/EmptyState'
import GeneratedCard from '@/components/GeneratedCard'
import GenerationSkeleton from '@/components/GenerationSkeleton'
import LoadingButton from '@/components/LoadingButton'
import { useCards } from '@/hooks/useCards'
import { useDecks } from '@/hooks/useDecks'
import {
  generateCards,
  hasAnyApiKey,
  loadApiKeys,
  providerLabel,
} from '@/lib/ai'
import { extractFromFile, SUPPORTED_INPUTS } from '@/lib/extract'
import { friendlyDbError } from '@/lib/errors'
import { cn } from 'cn'
import SettingsDialog from '@/pages/Settings'

let rowCounter = 0

// Client-side input bounds (SEC-06 / SEC-08). Images are capped lower
// because they are base64-encoded and sent to Gemini inline.
const MAX_NOTES_LENGTH = 60000
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_FILE_BYTES = 25 * 1024 * 1024

function makeRow(fields = {}) {
  rowCounter += 1
  return {
    id: `row-${rowCounter}`,
    question: '',
    answer: '',
    source: '',
    selected: true,
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
    case 'too_long':
      return 'That\u2019s too much text at once. Trim the notes to under 60,000 characters and try again.'
    case 'too_big':
      return error?.message || 'That file is too large to import.'
    case 'unavailable':
      return (
        error?.message ||
        'The AI provider is busy right now. Try again in a minute.'
      )
    case 'malformed':
      return 'The AI replied in an unexpected format. Try generating again.'
    default:
      // Raw messages are development-only — production gets generic copy
      // (SEC-03).
      return import.meta.env.DEV && error?.message
        ? error.message
        : 'Something went wrong while generating cards.'
  }
}

// Native <select> (no shadcn Select installed) styled from the same tokens as
// the Input component so both controls read identically in either theme.
const selectClasses =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30'

export default function Upload() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { decks, loading: decksLoading, error: decksError, fetchDecks } =
    useDecks()
  const { createCard } = useCards()

  // Deep link from a deck page (`/upload?deck=<id>`): preselect that deck
  // so the user never has to re-find it (U-04).
  const [deckId, setDeckId] = useState(() => searchParams.get('deck') || '')
  const [notes, setNotes] = useState('')
  const [apiKeys, setApiKeys] = useState(() => loadApiKeys())

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState(null)
  const [meta, setMeta] = useState(null)

  const [rows, setRows] = useState([])
  const [editDraft, setEditDraft] = useState(null)

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [settingsOpen, setSettingsOpen] = useState(false)

  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importMsg, setImportMsg] = useState(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef(null)
  const addCardButtonRef = useRef(null)
  const editButtonsRef = useRef(new Map())

  function handleSettingsChange(open) {
    setSettingsOpen(open)
    if (!open) setApiKeys(loadApiKeys())
  }

  async function runImport(file) {
    if (importing) return
    // Size guard before any read/parse/upload (SEC-06). `file.type` plus the
    // extension decides which limit applies — extensions alone are never
    // trusted elsewhere either.
    const isImage =
      (file.type || '').startsWith('image/') ||
      /\.(png|jpe?g|webp|heic|heif)$/i.test(file.name || '')
    const sizeLimit = isImage ? MAX_IMAGE_BYTES : MAX_FILE_BYTES
    if (file.size > sizeLimit) {
      const mb = Math.round(sizeLimit / (1024 * 1024))
      setImportError({
        code: 'too_big',
        message: `That file is over ${mb} MB. Import a smaller file (or split it up) and try again.`,
      })
      return
    }
    setImporting(true)
    setImportError(null)
    setImportMsg(null)
    try {
      const { text, meta } = await extractFromFile(file)
      if (!text) {
        setImportError({
          code: 'empty',
          message:
            'No selectable text found in this file. If it is a scanned PDF or a photo of a page, take a screenshot of it and import that image instead.',
        })
        return
      }
      // Appending must never blow past the notes cap either (the textarea's
      // maxLength only constrains typed input, not programmatic appends).
      const combined = notes.trim() ? `${notes.trimEnd()}\n\n${text}` : text
      if (combined.length > MAX_NOTES_LENGTH) {
        setImportError({ code: 'too_long' })
        return
      }
      setNotes(combined)
      setImportMsg(
        `Imported ${meta ? `${meta} of text ` : ''}from ${file.name}.`,
      )
    } catch (error) {
      setImportError(error)
    } finally {
      setImporting(false)
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) runImport(file)
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) runImport(file)
  }

  async function handleGenerate() {
    if (generating) return
    // Bound the prompt before any network call (SEC-08).
    if (notes.trim().length > MAX_NOTES_LENGTH) {
      setGenError({ code: 'too_long' })
      return
    }
    setGenError(null)
    setSaveError(null)
    setGenerating(true)
    try {
      const result = await generateCards(notes.trim(), loadApiKeys())
      setRows(result.cards.map((card) => makeRow(card)))
      setEditDraft(null)
      setMeta({
        provider: result.provider,
        failures: result.failures || [],
        count: result.cards.length,
      })
    } catch (error) {
      // Keep any previously generated rows — only the request failed, and
      // regenerating costs time/quota. The notes are untouched either way.
      setGenError(error)
    } finally {
      setGenerating(false)
    }
  }

  function startEdit(id) {
    const row = rows.find((candidate) => candidate.id === id)
    if (!row) return
    setEditDraft({
      id: row.id,
      question: row.question,
      answer: row.answer,
      source: row.source,
    })
  }

  function changeDraft(field, value) {
    setEditDraft((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  function focusEditButton(id) {
    // After Save/Cancel the row remounts from its edit key back to its
    // display key; the Edit button ref is re-registered during that commit.
    requestAnimationFrame(() => editButtonsRef.current.get(id)?.focus())
  }

  function commitRow(id, fields) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...fields } : row)),
    )
    setEditDraft((prev) => (prev?.id === id ? null : prev))
    focusEditButton(id)
  }

  function cancelEdit(id) {
    setEditDraft((prev) => (prev?.id === id ? null : prev))
    focusEditButton(id)
  }

  function toggleRow(id) {
    setRows((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, selected: !row.selected } : row,
      ),
    )
  }

  function toggleAll() {
    const next = !allSelected
    setRows((prev) => prev.map((row) => ({ ...row, selected: next })))
  }

  function removeRow(id) {
    const index = rows.findIndex((row) => row.id === id)
    const remaining = rows.filter((row) => row.id !== id)
    setRows(remaining)
    setEditDraft((prev) => (prev?.id === id ? null : prev))
    // Keep keyboard focus in the list: move to the row that took this one's
    // place, otherwise fall back to "Add blank card" (or the last row).
    requestAnimationFrame(() => {
      const next = remaining[Math.min(index, remaining.length - 1)]
      const button = next ? editButtonsRef.current.get(next.id) : null
      if (button) button.focus()
      else addCardButtonRef.current?.focus()
    })
  }

  function addRow() {
    const row = makeRow()
    setRows((prev) => [...prev, row])
    setEditDraft({ id: row.id, question: '', answer: '', source: '' })
  }

  function registerEditButton(id, node) {
    if (node) editButtonsRef.current.set(id, node)
    else editButtonsRef.current.delete(id)
  }

  async function handleSave(mode) {
    // Require a *resolved* deck (not just a raw id): a stale `?deck=` link
    // can't produce a foreign-key failure, and the guard doubles as the
    // re-entry lock while `saving` stays armed on the success path (U-01).
    if (!deck || saving) return
    const targets = rows.filter(
      (row) => isValidRow(row) && (mode === 'all' || row.selected),
    )
    if (targets.length === 0) return

    setSaving(true)
    setSaveError(null)

    const savedIds = new Set()
    let failure = null
    for (const row of targets) {
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

    if (failure) {
      setSaving(false)
      // Saved rows leave the list; unsaved rows and their selection stay so
      // the user can retry without regenerating anything.
      setRows((prev) => prev.filter((row) => !savedIds.has(row.id)))
      setEditDraft((prev) =>
        prev && savedIds.has(prev.id) ? null : prev,
      )
      setSaveError(
        `Saved ${savedIds.size} of ${targets.length} cards. ${friendlyDbError(failure)}`,
      )
      return
    }

    // Success: `saving` deliberately stays true through the 1-second redirect
    // so a second click during the delay can't insert the same cards twice
    // (U-01). The buttons keep spinning "Saving…" until the route unmounts.
    const deckName = deck.name
    // The global toast survives the redirect below (the old in-page toast
    // disappeared the moment the route changed).
    toast.success(
      `${savedIds.size} ${savedIds.size === 1 ? 'card' : 'cards'} saved to ${deckName}`,
    )
    setTimeout(() => navigate(`/decks/${deckId}`), 1000)
  }

  const validCount = rows.filter(isValidRow).length
  const selectedCount = rows.filter((row) => row.selected).length
  const selectedValidCount = rows.filter(
    (row) => row.selected && isValidRow(row),
  ).length
  const allSelected = rows.length > 0 && rows.every((row) => row.selected)
  const noKeys = !hasAnyApiKey(apiKeys)
  const canGenerate = Boolean(notes.trim()) && !noKeys && !generating
  const deck = decks.find((candidate) => candidate.id === deckId)

  return (
    <div>
      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5" aria-hidden="true" />
            Generate cards with AI
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Turn your notes or study materials into review cards — edit and
            select them before saving.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          {/* LEFT — study material in, generate action */}
          <section aria-labelledby="study-material-heading">
            <Card>
              <CardHeader>
                <CardTitle id="study-material-heading">
                  Study material
                </CardTitle>
                <CardDescription>
                  Paste notes, or import a PDF, image, or document.
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
                    {decks.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name} ({candidate.card_count})
                      </option>
                    ))}
                  </select>
                  {!decksLoading && decks.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No decks yet —{' '}
                      <Link to="/decks" className="underline">
                        create one first
                      </Link>
                      .
                    </p>
                  )}
                </div>

                <div
                  className="space-y-2"
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                >
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="notes" className="text-sm font-medium">
                      Study notes
                    </label>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {notes.length.toLocaleString()}{' '}
                      {notes.length === 1 ? 'character' : 'characters'}
                    </span>
                  </div>
                  <Textarea
                    id="notes"
                    maxLength={MAX_NOTES_LENGTH}
                    placeholder="Paste your notes here — or import a PDF, screenshot, or document…"
                    className={cn(
                      'min-h-36 max-h-60',
                      dragging && 'border-ring ring-2 ring-ring/50',
                    )}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                  />

                  <div
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-4 text-center transition-colors',
                      dragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/30',
                    )}
                  >
                    <FileUp
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                      <span className="text-muted-foreground">
                        Drag a file here, or
                      </span>
                      <LoadingButton
                        type="button"
                        variant="outline"
                        size="lg"
                        loading={importing}
                        loadingLabel="Importing."
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Browse files
                      </LoadingButton>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Supported: {SUPPORTED_INPUTS}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.txt,.md,.markdown,.docx,image/*"
                      onChange={handleFileChange}
                    />
                  </div>

                  {importError && (
                    <div
                      role="alert"
                      className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                    >
                      <p className="flex items-start gap-2 text-sm text-destructive">
                        <TriangleAlert
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {friendlyMessage(importError)}
                      </p>
                      {(importError.code === 'missing_key' ||
                        importError.code === 'invalid_key' ||
                        importError.code === 'rate_limit') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSettingsOpen(true)}
                        >
                          <KeyRound
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Open Settings
                        </Button>
                      )}
                      {importError.code === 'unsupported' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <FileUp
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Choose another file
                        </Button>
                      )}
                    </div>
                  )}
                  {importMsg && !importError && (
                    <p role="status" className="text-xs font-medium text-foreground">
                      {importMsg}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <LoadingButton
                    className="w-full"
                    size="lg"
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    loading={generating}
                    loadingLabel="Generating…"
                  >
                    <Sparkles className="mr-2 size-4" aria-hidden="true" />
                    Generate Cards
                  </LoadingButton>
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

                {decksError && (
                  <div
                    role="alert"
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5"
                  >
                    <p className="min-w-40 flex-1 text-sm text-destructive">
                      Couldn’t load your decks. Check your connection and try
                      again.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchDecks()}
                    >
                      Try again
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* RIGHT — generated cards preview, selection, save */}
          <section aria-labelledby="generated-cards-heading">
            <Card aria-busy={generating}>
              <CardHeader>
                <CardTitle
                  id="generated-cards-heading"
                  className="flex items-center justify-between gap-2"
                >
                  <span>Generated cards</span>
                  {rows.length > 0 && !generating && (
                    <Badge variant="soft">
                      {rows.length} {rows.length === 1 ? 'card' : 'cards'}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {meta
                    ? `${meta.count} generated with ${providerLabel(meta.provider)}${
                        meta.failures.length > 0
                          ? ` · ${meta.failures
                              .map((f) => providerLabel(f.provider))
                              .join(', ')} unavailable`
                          : ''
                      }. `
                    : ''}
                  Review, edit, and select cards, then save them to your deck.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generating && <GenerationSkeleton />}

                {!generating && genError && (
                  <div
                    role="alert"
                    className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
                  >
                    <p className="flex items-start gap-2 text-sm text-destructive">
                      <TriangleAlert
                        className="mt-0.5 size-4 shrink-0"
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
                          <KeyRound
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Open Settings
                        </Button>
                      )}
                      {(genError.code === 'network' ||
                        genError.code === 'unavailable') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerate}
                        >
                          <RefreshCw
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Retry
                        </Button>
                      )}
                      {genError.code === 'malformed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleGenerate}
                        >
                          <RefreshCw
                            className="mr-1.5 size-3.5"
                            aria-hidden="true"
                          />
                          Try again
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {!generating && rows.length === 0 && !genError && (
                  <EmptyState
                    icon={Sparkles}
                    title="Your generated cards will appear here"
                    description="Add study material and generate cards to get started."
                  />
                )}

                {!generating && rows.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-cards"
                          checked={allSelected}
                          onCheckedChange={toggleAll}
                          disabled={rows.length === 0}
                        />
                        <label
                          htmlFor="select-all-cards"
                          className="cursor-pointer text-sm font-medium"
                        >
                          {allSelected ? 'Deselect all' : 'Select all'}
                        </label>
                      </div>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {selectedCount} of {rows.length} selected
                      </p>
                    </div>

                    <ul className="space-y-3">
                      {rows.map((row, index) => (
                        <GeneratedCard
                          key={
                            editDraft?.id === row.id
                              ? `${row.id}::edit`
                              : row.id
                          }
                          row={row}
                          index={index}
                          editing={editDraft?.id === row.id}
                          draft={editDraft}
                          onDraftChange={changeDraft}
                          onToggle={toggleRow}
                          onStartEdit={startEdit}
                          onCancelEdit={cancelEdit}
                          onCommit={commitRow}
                          onRemove={removeRow}
                          registerEditButton={registerEditButton}
                        />
                      ))}
                    </ul>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addRow}
                          ref={addCardButtonRef}
                        >
                          <Plus className="mr-1.5 size-4" aria-hidden="true" />
                          Add blank card
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          {deck ? (
                            <>
                              Saving to{' '}
                              <span className="font-medium text-foreground">
                                {deck.name}
                              </span>
                            </>
                          ) : (
                            'Choose a deck to save these cards.'
                          )}
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-end">
                        <LoadingButton
                          type="button"
                          variant="outline"
                          disabled={!deck || selectedValidCount === 0}
                          loading={saving}
                          loadingLabel="Saving…"
                          onClick={() => handleSave('selected')}
                        >
                          Save Selected ({selectedValidCount})
                        </LoadingButton>
                        <LoadingButton
                          type="button"
                          disabled={!deck || validCount === 0}
                          loading={saving}
                          loadingLabel="Saving…"
                          onClick={() => handleSave('all')}
                        >
                          Save All ({validCount})
                        </LoadingButton>
                      </div>

                      {selectedValidCount === 0 && validCount > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Select at least one card to use Save Selected.
                        </p>
                      )}

                      {saveError && (
                        <p role="alert" className="text-sm text-destructive">
                          {saveError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={handleSettingsChange} />
    </div>
  )
}
