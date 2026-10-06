import { Rating } from '@/lib/fsrs'

// Presentation config for the four FSRS ratings: keyboard order (keys 1–4),
// user-facing label, and the Button variant each one maps to (danger /
// warning / success / primary — the text label always carries the meaning,
// never the color alone). Single source for the rating buttons, the shortcut
// hint, the keyboard shortcut map and the completion tally.
export const RATINGS = [
  { value: Rating.Again, label: 'Again', variant: 'danger' },
  { value: Rating.Hard, label: 'Hard', variant: 'warning' },
  { value: Rating.Good, label: 'Good', variant: 'success' },
  { value: Rating.Easy, label: 'Easy', variant: 'default' },
]
