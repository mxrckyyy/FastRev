import { Link, NavLink } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { NAV_ITEMS, sidebarLinkClass } from '@/lib/nav'
import UserMenu from '@/components/UserMenu'

/**
 * Desktop sidebar (≥1024px): brand, primary navigation, account footer.
 * Sits outside the scrolling column, so it stays visually fixed while the
 * main content scrolls. Hidden below lg — mobile uses the bottom bar +
 * hamburger menu instead.
 */
export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card lg:flex">
      <div className="flex h-14 shrink-0 items-center border-b px-4">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold tracking-tight">FastRev</span>
        </Link>
      </div>

      <nav aria-label="Main" className="min-h-0 flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} className={sidebarLinkClass}>
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="shrink-0 border-t p-2">
        <UserMenu variant="sidebar" />
      </div>
    </aside>
  )
}
