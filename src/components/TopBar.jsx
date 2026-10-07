import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Breadcrumbs from '@/components/Breadcrumbs'
import ThemeToggle from '@/components/ThemeToggle'
import UserMenu from '@/components/UserMenu'

/**
 * Reusable top bar for every shell page. Titles/breadcrumbs are passed in by
 * AppShell (derived from the route), so pages never render their own bar.
 *
 * - plain routes  → single <h1> title
 * - nested routes → breadcrumb trail (last segment acts as the title)
 * - below lg      → hamburger opens the mobile menu
 */
export default function TopBar({
  title,
  breadcrumbs,
  onOpenMenu,
  menuButtonRef,
}) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
      >
        <Menu className="size-4" aria-hidden="true" />
      </Button>

      <div className="min-w-0 flex-1">
        {breadcrumbs ? (
          <Breadcrumbs items={breadcrumbs} />
        ) : (
          <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
        )}
      </div>

      <ThemeToggle />
      <UserMenu variant="topbar" />
    </header>
  )
}
