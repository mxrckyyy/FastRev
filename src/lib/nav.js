// Single source of truth for app navigation: sidebar, mobile menu, bottom bar
// and top-bar titles all read from here, so adding a destination means adding
// one entry (plus a route in App.jsx).

import { ChartColumn, LayoutDashboard, Layers, Play, Settings, Sparkles } from 'lucide-react'
import { cn } from 'cn'

export const NAV_ITEMS = [
  { id: 'dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'decks', to: '/decks', label: 'Decks', icon: Layers },
  { id: 'review', to: '/review', label: 'Review', icon: Play },
  { id: 'upload', to: '/upload', label: 'Upload', icon: Sparkles },
  { id: 'analytics', to: '/analytics', label: 'Analytics', icon: ChartColumn },
  { id: 'settings', to: '/settings', label: 'Settings', icon: Settings },
]

// The bottom bar shows the four core destinations; everything else lives in
// the sidebar (desktop) and the hamburger menu (mobile).
export const MOBILE_NAV_IDS = ['dashboard', 'decks', 'review', 'upload']
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  MOBILE_NAV_IDS.includes(item.id),
)

const ROUTE_TITLES = {
  '/dashboard': 'Dashboard',
  '/decks': 'Decks',
  '/review': 'Review',
  '/upload': 'Upload',
  '/analytics': 'Analytics',
  '/settings': 'Settings',
}

/**
 * Top-bar meta for the current pathname. Nested deck pages get a breadcrumb
 * trail (Decks / Biology); every other route gets a plain title.
 * @param {string} pathname
 * @param {{ id: string, name: string }[]} [decks] deck rows, to resolve /decks/:id names
 */
export function getPageMeta(pathname, decks) {
  if (pathname.startsWith('/decks/')) {
    const deck = decks?.find((candidate) => candidate.id === pathname.slice(7))
    const name = deck?.name || 'Deck'
    return {
      title: name,
      breadcrumbs: [{ label: 'Decks', to: '/decks' }, { label: name }],
    }
  }
  return { title: ROUTE_TITLES[pathname] || 'FastRev', breadcrumbs: null }
}

// Shared NavLink class builders — active state uses weight + shape (not color
// alone) and always comes with NavLink's aria-current="page".
export function sidebarLinkClass({ isActive }) {
  return cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring/50',
    isActive
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}

export function bottomLinkClass({ isActive }) {
  return cn(
    'mx-2 flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-xs outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring/50',
    isActive
      ? 'bg-primary/10 font-medium text-primary'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )
}
