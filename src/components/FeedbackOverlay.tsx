import { CelebratingBaxi } from './CelebratingBaxi'
import { CoinBurst } from './CoinBurst'
import { Confetti } from './Confetti'
import { Sparkles } from './Sparkles'
import type { FeedbackState } from '../hooks/useGameState'

interface FeedbackOverlayProps {
  feedback: FeedbackState
}

export function FeedbackOverlay({ feedback }: FeedbackOverlayProps) {
  const isCorrect = feedback.kind === 'correct'
  const bg = isCorrect ? 'bg-level-green' : 'bg-quest-red'
  const isStreak = feedback.coins.streakBonus > 0
  const baxiKind = isStreak ? 'cheer' : 'hop'
  return (
    <div
      className={`fixed inset-0 z-40 ${bg} flex flex-col items-center justify-center text-white px-6 overflow-hidden`}
      role="status"
      aria-live="polite"
    >
      {isCorrect ? (
        <>
          {isStreak && <Confetti tick={feedback.tick} />}
          <CoinBurst
            perCorrect={feedback.coins.perCorrect}
            streakBonus={feedback.coins.streakBonus}
            tick={feedback.tick}
          />
          <div className="text-[110px] leading-none font-black select-none">✓</div>
          <div className="relative mt-1 w-[180px] h-[180px] flex items-center justify-center">
            <Sparkles tick={feedback.tick} />
            <CelebratingBaxi
              size={130}
              trigger={{ tick: feedback.tick, kind: baxiKind }}
            />
          </div>
          {feedback.streak > 1 && (
            <div className="text-2xl font-bold mt-1">
              {feedback.streak} in a row!
            </div>
          )}
          {feedback.leveledUp && feedback.newNumberCount != null && (
            <div className="text-xl font-semibold mt-2">
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
