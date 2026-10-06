import { LoaderCircle } from 'lucide-react'

// Suspense fallback for lazy-loaded routes. Deliberately minimal: the app
// shell (sidebar/top bar/bottom nav) stays mounted around it, so this only
// fills the content column — no layout jump, no fake progress. The spinner
// is the app's one spinner (LoaderCircle) and stops under reduced motion;
// screen readers get the sr-only status text.
export default function RouteFallback() {
  return (
    <div
      role="status"
      className="flex min-h-[50vh] items-center justify-center"
    >
      <LoaderCircle
        className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none"
        aria-hidden="true"
      />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
