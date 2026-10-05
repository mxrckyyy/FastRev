import { NavLink } from 'react-router-dom'
import { MOBILE_NAV_ITEMS, bottomLinkClass } from '@/lib/nav'

/**
 * Mobile bottom navigation (below lg): the four core destinations, rendered
 * in normal flow at the bottom of the shell column — not fixed — so it can
 * never cover page content. Safe-area padding keeps it clear of the iOS
 * home indicator.
 */
export default function MobileNav() {
  return (
    <nav
      aria-label="Primary"
      className="shrink-0 border-t bg-card lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} className={bottomLinkClass}>
              <Icon className="size-5" aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
