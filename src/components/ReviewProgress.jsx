/**
 * Session progress: position counter + determinate bar, centered above the
 * flashcard. The bar mirrors the numeric rather than replacing it, and
 * carries real progressbar semantics (aria-valuenow/valuetext) so assistive
 * tech hears "Card 12 of 30" instead of a bare number.
 */
export default function ReviewProgress({ position, total }) {
  const pct = total > 0 ? Math.min(100, (position / total) * 100) : 0
  const remaining = Math.max(total - position, 0)

  return (
    <div className="space-y-2">
      <p className="text-center text-sm">
        <span className="font-medium text-foreground">
          {position} / {total}
        </span>
        {remaining > 0 && (
          <span className="hidden text-muted-foreground sm:inline">
            {' '}
            · {remaining} remaining
          </span>
        )}
      </p>
      <div
        role="progressbar"
        aria-label="Review progress"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={position}
        aria-valuetext={`Card ${position} of ${total}`}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
