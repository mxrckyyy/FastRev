import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from 'cn'

/**
 * Reusable breadcrumb trail. The last item is the current page (never a
 * link) and reads as the page title; earlier items are muted links, so the
 * trail stays visually secondary.
 *
 * @param {{ label: string, to?: string }[]} items
 */
export default function Breadcrumbs({ items, className }) {
  if (!items?.length) return null

  return (
    <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
      <ol className="flex items-center gap-1">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={item.to || item.label} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {last ? (
                <span
                  aria-current="page"
                  className="truncate text-sm font-medium text-foreground"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="truncate text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
