import { Suspense, useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import MobileMenu from '@/components/MobileMenu'
import MobileNav from '@/components/MobileNav'
import RouteFallback from '@/components/RouteFallback'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'
import { useDecks } from '@/hooks/useDecks'
import { getPageMeta } from '@/lib/nav'

/**
 * Application shell for standard pages.
 *
 *   Desktop (≥1024px)          Mobile (<1024px)
 *   ┌────────┬────────────┐    ┌─────────────────┐
 *   │Sidebar │ Top bar    │    │ Top bar (≡)     │
 *   │        ├────────────┤    ├─────────────────┤
 *   │        │ scrollable │    │ scrollable      │
 *   │        │ <Outlet/>  │    │ <Outlet/>       │
 *   │        │            │    ├─────────────────┤
 *   └────────┴────────────┘    │ bottom nav      │
 *                              └─────────────────┘
 *
 * Layout rules:
 * - `h-dvh overflow-hidden` root + `flex-1 overflow-y-auto` content column
 *   keeps the sidebar stable while content scrolls.
 * - Bottom nav is in normal flow (never fixed), so it cannot cover content.
 * - The bottom nav/menu is rendered here once; pages add no chrome of their
 *   own — their only job is content + width control.
 *
 * Focus mode: routes that must run without any of this (Review) are simply
 * NOT nested under AppShell in App.jsx — see the router for the pattern.
 */
export default function AppShell() {
  const { pathname } = useLocation()
  const { decks } = useDecks()
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollRef = useRef(null)
  const { title, breadcrumbs } = getPageMeta(pathname, decks)

  // Reset scroll + keep the tab title in step with the route (DOM-only, no
  // component state — keeps oxlint's set-state-in-effect rule clean).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
    document.title = `${title} · FastRev`
  }, [pathname, title])

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          title={title}
          breadcrumbs={breadcrumbs}
          onOpenMenu={() => setMenuOpen(true)}
        />

        <main
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
        >
          {/* Keyed by route so each page fades in on navigation (one quiet
              150ms opacity move — no slide/scale, no layout animation).
              The key remounts the subtree, which route changes already do;
              motion-reduce turns the fade off. The Suspense boundary sits
              HERE (inside the shell, not around it) so lazy route chunks
              load without ever unmounting the chrome — no layout shift. */}
          <div
            key={pathname}
            className="animate-in fade-in-0 duration-150 motion-reduce:animate-none"
          >
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </div>
        </main>

        <MobileNav />
      </div>

      <MobileMenu open={menuOpen} onOpenChange={setMenuOpen} />
    </div>
  )
}
