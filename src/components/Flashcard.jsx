import { Card, CardContent } from '@/components/ui/card'

/**
 * The flashcard itself. Calm surface (existing Card tokens: bg-card, ring,
 * rounded-xl) with generous padding — question prominent on top, answer
 * revealed below a divider. Text is left-aligned so long content wraps
 * naturally (centered card, readable ragged-right text).
 *
 * The heading is the focus target when the session advances: tabIndex -1 +
 * a screen-reader-only "Card x of y." prefix means focusing it announces
 * both position and question in one utterance.
 */
export default function Flashcard({
  card,
  index,
  total,
  revealed,
  questionRef,
}) {
  return (
    <Card className="py-0 shadow-sm">
      <CardContent className="px-5 py-7 sm:px-8 sm:py-9">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Question
        </p>
        <h2
          ref={questionRef}
          tabIndex={-1}
          className="mt-2 text-xl leading-snug font-semibold break-words text-card-foreground sm:text-2xl"
        >
          <span className="sr-only">{`Card ${index + 1} of ${total}. `}</span>
          {card.question}
        </h2>

        {revealed && (
          <div className="mt-6 animate-in border-t border-border pt-5 fade-in-0 slide-in-from-bottom-1 duration-150">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Answer
            </p>
            <div className="mt-2 text-base leading-relaxed break-words whitespace-pre-wrap sm:text-lg">
              {card.answer}
            </div>
            {card.source && (
              <p className="mt-4 text-xs break-words text-muted-foreground">
                Source: {card.source}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
