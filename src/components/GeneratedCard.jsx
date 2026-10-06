import { useEffect, useRef, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from 'cn'

function isValid(row) {
  return Boolean(row.question.trim() && row.answer.trim())
}

/**
 * One row in the generated-cards preview.
 *
 * Display mode: selection checkbox, question/answer scan view, Edit + Remove.
 * Edit mode is parent-controlled: the parent owns the edit draft (so it can
 * open a newly added blank card straight into edit) and keys this component
 * as `id::edit` while editing, which remounts the row — the draft comes in
 * as a prop and validation errors can never leak between edit sessions.
 * Save validates and commits; Cancel discards. Focus: the mount effect
 * focuses the question field; the parent returns focus to the Edit button
 * after Save/Cancel and moves focus after a removal (via
 * `registerEditButton`).
 */
export default function GeneratedCard({
  row,
  index,
  editing,
  draft,
  onDraftChange,
  onToggle,
  onStartEdit,
  onCancelEdit,
  onCommit,
  onRemove,
  registerEditButton,
}) {
  const [draftError, setDraftError] = useState(null)
  const questionRef = useRef(null)

  const number = index + 1
  const valid = isValid(row)

  useEffect(() => {
    if (editing) questionRef.current?.focus()
  }, [editing])

  function setField(field, next) {
    onDraftChange(field, next)
    setDraftError(null)
  }

  function handleCommit() {
    if (!draft.question.trim() || !draft.answer.trim()) {
      setDraftError('Question and answer are both required.')
      questionRef.current?.focus()
      return
    }
    onCommit(row.id, {
      question: draft.question.trim(),
      answer: draft.answer.trim(),
      source: draft.source.trim(),
    })
  }

  function handleCancel() {
    setDraftError(null)
    onCancelEdit(row.id)
  }

  if (editing) {
    return (
      <li>
        <div className="space-y-3 rounded-lg border border-primary/50 bg-card p-3 ring-1 ring-primary/20 sm:p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Editing card {number}
          </p>

          <div className="space-y-1.5">
            <label
              htmlFor={`edit-question-${row.id}`}
              className="text-sm font-medium"
            >
              Question
            </label>
            <Textarea
              id={`edit-question-${row.id}`}
              ref={questionRef}
              placeholder="Question"
              className="min-h-16 max-h-40"
              value={draft.question}
              onChange={(event) => setField('question', event.target.value)}
              aria-invalid={Boolean(draftError)}
              aria-describedby={draftError ? `edit-error-${row.id}` : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`edit-answer-${row.id}`}
              className="text-sm font-medium"
            >
              Answer
            </label>
            <Textarea
              id={`edit-answer-${row.id}`}
              placeholder="Answer"
              className="min-h-16 max-h-40"
              value={draft.answer}
              onChange={(event) => setField('answer', event.target.value)}
              aria-invalid={Boolean(draftError)}
              aria-describedby={draftError ? `edit-error-${row.id}` : undefined}
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={`edit-source-${row.id}`}
              className="text-sm font-medium"
            >
              Source{' '}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <Input
              id={`edit-source-${row.id}`}
              placeholder="e.g. Textbook p. 42"
              value={draft.source}
              onChange={(event) => setField('source', event.target.value)}
            />
          </div>

          {draftError && (
            <p
              id={`edit-error-${row.id}`}
              role="alert"
              className="text-sm text-destructive"
            >
              {draftError}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleCommit}>
              Save
            </Button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <li>
      <article
        className={cn(
          'flex gap-3 rounded-lg border bg-card p-3 transition-colors sm:p-4',
          row.selected
            ? 'border-primary/50 ring-1 ring-primary/20'
            : 'border-border',
        )}
      >
        <div className="pt-0.5">
          <Checkbox
            checked={row.selected}
            onCheckedChange={() => onToggle(row.id)}
            aria-label={`Select card ${number}`}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            Card {number}
            {!valid && (
              <span className="text-warning-foreground dark:text-warning">
                {' '}
                · needs question and answer
              </span>
            )}
          </p>
          <p className="text-sm font-medium break-words whitespace-pre-wrap">
            {row.question.trim() || (
              <span className="text-muted-foreground italic">
                No question yet
              </span>
            )}
          </p>
          <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
            {row.answer.trim() || <span className="italic">No answer yet</span>}
          </p>
          {row.source.trim() && (
            <p className="text-xs break-words text-muted-foreground">
              Source: {row.source.trim()}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-start gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit card ${number}`}
            ref={(node) => registerEditButton?.(row.id, node)}
            onClick={() => onStartEdit(row.id)}
          >
            <Pencil className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Remove card ${number}`}
            onClick={() => onRemove(row.id)}
          >
            <Trash2 className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </article>
    </li>
  )
}
