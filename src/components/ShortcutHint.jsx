import { RATINGS } from '@/lib/ratings'

function Key({ children }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-xs font-medium text-foreground">
      {children}
    </kbd>
  )
}

/**
 * Secondary keyboard hint under the review area. State-aware: "Space" only
 * while the answer is hidden, the 1–4 rating keys only after it is revealed
 * (that is all the shortcuts do). Hidden below sm — no keyboard there — but
 * the shortcuts themselves keep working regardless of what is displayed.
 */
export default function ShortcutHint({ revealed }) {
  return (
    <div className="hidden items-center justify-center gap-x-4 gap-y-1 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground sm:flex sm:flex-wrap">
      {!revealed ? (
        <span className="flex items-center gap-1.5">
          <Key>Space</Key>
          Reveal answer
        </span>
      ) : (
        RATINGS.map((rating, i) => (
          <span key={rating.value} className="flex items-center gap-1.5">
            <Key>{i + 1}</Key>
            {rating.label}
          </span>
        ))
      )}
    </div>
  )
}
