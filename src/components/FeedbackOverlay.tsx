import type { FeedbackState } from '../hooks/useGameState'

interface FeedbackOverlayProps {
  feedback: FeedbackState
}

export function FeedbackOverlay({ feedback }: FeedbackOverlayProps) {
  const isCorrect = feedback.kind === 'correct'
  const bg = isCorrect ? 'bg-level-green' : 'bg-quest-red'
  return (
    <div
      className={`fixed inset-0 z-40 ${bg} flex flex-col items-center justify-center text-white px-6`}
      role="status"
      aria-live="polite"
    >
      {isCorrect ? (
        <>
          <div className="text-[160px] leading-none font-black select-none">✓</div>
          {feedback.streak > 1 && (
            <div className="text-3xl font-bold mt-2">
              + streak {feedback.streak} in a row!
            </div>
          )}
          {feedback.leveledUp && feedback.newNumberCount != null && (
            <div className="text-2xl font-semibold mt-3">
              Level up! Now {feedback.newNumberCount} numbers!
            </div>
          )}
        </>
      ) : (
        <>
          <div className="text-[160px] leading-none font-black select-none">✗</div>
          <div className="text-3xl font-bold mt-2">Not quite!</div>
          <div className="text-base text-white/80 mt-2">Keep going — you've got this</div>
        </>
      )}
    </div>
  )
}
