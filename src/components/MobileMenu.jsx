import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/hooks/useAuth'
import { NAV_ITEMS, sidebarLinkClass } from '@/lib/nav'

/**
 * Hamburger menu for small screens: the full navigation list (including
 * Analytics and Settings, which don't fit in the bottom bar) plus sign-out.
 * Reuses the shadcn Dialog, so Radix provides the focus trap, Escape-to-
 * close and labelled dialog semantics.
 */
export default function MobileMenu({ open, onOpenChange }) {
  const { user, signOut } = useAuth()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Menu</DialogTitle>
          <DialogDescription className="sr-only">
            Navigation and account actions
          </DialogDescription>
        </DialogHeader>

        <nav aria-label="Primary">
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={sidebarLinkClass}
                  onClick={() => onOpenChange(false)}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-2 border-t pt-3">
          <p className="truncate px-3 text-xs text-muted-foreground">
            {user?.email || 'Signed in'}
          </p>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => {
              onOpenChange(false)
              signOut()
            }}
          >
            <LogOut className="mr-2 size-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
