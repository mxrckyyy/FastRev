import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from 'cn'

// Semantic icon-chip tones. Each pairs a 10% token tint with a foreground
// that reads against it in BOTH themes (all verified >= 4.5:1). The label
// text next to it always spells out the meaning, so color is never the only
// cue. Warning is the exception that proves the rule: the light-theme amber
// is too pale for text (2.9:1), so light mode uses its dark pairing token
// and dark mode switches to the pale amber (which works on dark cards).
const TONES = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning-foreground dark:text-warning',
  muted: 'bg-muted text-muted-foreground',
}

/**
 * Dashboard statistic: icon chip, label, large value, supporting caption.
 * Pass `loading` to render value/caption skeletons in place of `value` /
 * `caption` (they are ignored while loading).
 */
export function StatCard({
  icon: Icon,
  tone = 'primary',
  label,
  value,
  caption,
  loading = false,
  className,
}) {
  return (
    <Card className={cn('px-4 sm:px-5', className)}>
      <div className="space-y-2.5">
        <span
          className={cn(
            'flex size-9 items-center justify-center rounded-lg',
            TONES[tone],
          )}
          aria-hidden="true"
        >
          <Icon className="size-4.5" />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-14" />
          ) : (
            <p className="animate-in text-2xl font-semibold tabular-nums fade-in-0 duration-200 motion-reduce:animate-none">
              {value}
            </p>
          )}
          {loading ? (
            <Skeleton className="h-3 w-24" />
          ) : (
            <p className="animate-in text-xs text-muted-foreground fade-in-0 duration-200 motion-reduce:animate-none">
              {caption}
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Placeholder that mirrors StatCard's shape while stats are loading. */
export function StatCardSkeleton() {
  return (
    <Card className="px-4 sm:px-5">
      <div className="space-y-2.5">
        <Skeleton className="size-9 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3.5 w-16" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </Card>
  )
}
