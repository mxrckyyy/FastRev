import { Link } from 'react-router-dom'
import { LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/useAuth'

function Avatar({ email }) {
  const initial = (email || '?').trim().charAt(0).toUpperCase()
  return (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {initial}
    </span>
  )
}

// Only actions that actually exist in the app: Settings (route) and Sign out
// (the existing useAuth().signOut). The email is shown as a label, not an
// action — there is no profile page to link to.
function MenuItems() {
  const { user, signOut } = useAuth()
  return (
    <>
      <DropdownMenuLabel className="text-muted-foreground">
        <span className="block truncate">{user?.email || 'Signed in'}</span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link to="/settings">
          <Settings aria-hidden="true" />
          Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => signOut()}>
        <LogOut aria-hidden="true" />
        Sign out
      </DropdownMenuItem>
    </>
  )
}

/**
 * Account menu shown in the top bar (`variant="topbar"`, icon trigger) and
 * pinned to the sidebar footer (`variant="sidebar"`, full-width row).
 */
export default function UserMenu({ variant = 'topbar' }) {
  const { user } = useAuth()
  const email = user?.email || ''
  const label = email ? `Account menu for ${email}` : 'Account menu'

  if (variant === 'sidebar') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2.5 px-2 py-2"
            aria-label={label}
          >
            <Avatar email={email} />
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-medium">
                {email || 'Account'}
              </span>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-56">
          <MenuItems />
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={label}>
          <Avatar email={email} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <MenuItems />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
