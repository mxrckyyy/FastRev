import { LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Submit button with a real loading state: while `loading` the button is
 * disabled (no double submits), announces `aria-busy`, dims via the Button
 * base's `data-[loading=true]` styles, and swaps its label for a spinner +
 * `loadingLabel`. This is the same pattern Auth already used — extracted so
 * every form/dialog submit looks and behaves identically.
 *
 * The spinner carries `motion-reduce:animate-none` like Auth's does, so it
 * stops under the OS reduced-motion setting (the global clamp in index.css
 * is the belt, this is the suspenders for the one element users stare at).
 */
export default function LoadingButton({
  loading = false,
  loadingLabel = 'Working…',
  disabled = false,
  children,
  ...props
}) {
  return (
    <Button
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={loading || disabled}
      {...props}
    >
      {loading && (
        <LoaderCircle
          className="animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
      {loading ? loadingLabel : children}
    </Button>
  )
}
