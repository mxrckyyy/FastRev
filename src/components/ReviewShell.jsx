import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import ThemeToggle from '@/components/ThemeToggle'

/**
 * Focus-mode frame for the review session. The app shell (sidebar, top bar,
 * bottom nav) is already absent on /review (route sits outside <AppShell>) —
 * this component owns the little chrome that remains:
 *
 *   header   Exit review (left) · ThemeToggle (right)
 *   progress pinned below the header — never scrolls away
 *   main     centered, scrollable column (children)
 *   footer   shortcut hint — rendered by the page only while a card is active
 *
 * `progress` and `footer` are optional slots so loading/empty/error states can
 * drop what doesn't apply to them.
 */
export default function ReviewShell({ progress, footer, children }) {
  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 sm:px-6">
        <Button variant="ghost" size="sm" className="h-9 px-2 sm:h-7" asChild>
          <Link to="/dashboard">
            <ArrowLeft aria-hidden="true" />
            Exit review
          </Link>
        </Button>
        <ThemeToggle />
      </header>

      {progress && (
        <div className="shrink-0 px-4 pt-4 sm:px-6">
          <div className="mx-auto w-full max-w-2xl">{progress}</div>
        </div>
      )}

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col justify-center">
          <h1 className="sr-only">Review session</h1>
          {children}
        </div>
      </main>

      {footer && <footer className="shrink-0">{footer}</footer>}
    </div>
  )
}
