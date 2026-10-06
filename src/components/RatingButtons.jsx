import { Button } from '@/components/ui/button'
import { RATINGS } from '@/lib/ratings'

/**
 * The four rating actions, in keyboard order: 1 Again · 2 Hard · 3 Good ·
 * 4 Easy. Semantic tones (danger/warning/success/primary) differentiate the
 * buttons, but the text labels are always the message — never color alone.
 * Order/labels/variants come from `src/lib/ratings.js`, the single source
 * also read by the shortcut hint and the keyboard handler.
 *
 * Layout: 2×2 grid on mobile (48px targets), one row of four on sm+ (44px).
 */
export default function RatingButtons({ onSelect, disabled = false }) {
  return (
    <div
      role="group"
      aria-label="Rate your recall"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3"
    >
      {RATINGS.map((rating, i) => (
        <Button
          key={rating.value}
          variant={rating.variant}
          disabled={disabled}
          aria-keyshortcuts={String(i + 1)}
          className="h-12 text-sm sm:h-11"
          onClick={() => onSelect(rating.value)}
        >
          {rating.label}
        </Button>
      ))}
    </div>
  )
}
