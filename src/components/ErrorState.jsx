import { RotateCw, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

/**
 * Shared data-loading error state: friendly heading + message, an optional
 * raw `detail` (small, for debugging) and a real retry button — only pass
 * `onRetry` when the caller actually has a refetch function.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message,
  detail,
  onRetry,
  retryLabel = 'Try again',
  className,
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center',
        className,
      )}
    >
      <span
        className="mb-3 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"
        aria-hidden="true"
      >
        <TriangleAlert className="size-5" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{message}</p>
      {detail && (
        <p className="mt-2 max-w-md break-words text-xs text-muted-foreground">
          {detail}
        </p>
      )}
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
