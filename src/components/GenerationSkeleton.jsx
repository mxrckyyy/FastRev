import { RefreshCw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Loading state for the generated-cards panel. The status line is a live
 * region ("Generating review cards…") and the skeleton cards mirror the real
 * preview card shape (checkbox, index chip, question line, answer lines) so
 * the layout doesn't jump when results land. No fake progress percentages —
 * the backend gives us none. Skeletons are decorative; the global
 * prefers-reduced-motion rule clamps their pulse.
 */
export default function GenerationSkeleton({ count = 4 }) {
  return (
    <div className="space-y-4">
      <p
        role="status"
        className="flex items-center gap-2 text-sm font-medium text-foreground"
      >
        <RefreshCw
          className="h-4 w-4 shrink-0 animate-spin text-primary"
          aria-hidden="true"
        />
        Generating review cards…
        <span className="font-normal text-muted-foreground">
          This can take a little while.
        </span>
      </p>

      <div className="space-y-3" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <div
            key={index}
            className="flex gap-3 rounded-lg border border-border p-4"
          >
            <Skeleton className="size-4 rounded-[4px]" />
            <div className="min-w-0 flex-1 space-y-2.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
