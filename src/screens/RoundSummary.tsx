import { GAME_CONFIG } from '../config/gameConfig'

interface RoundSummaryProps {
  correct: number
  currentNumberCount: number
  consecutiveCorrect: number
  leveledUpThisRound: boolean
  wrongCount: number
  onPlayAgain: () => void
  onChangeDigitLevel: () => void
  onGetBetter: () => void
}

export function RoundSummary({
  correct,
  currentNumberCount,
  consecutiveCorrect,
  leveledUpThisRound,
  wrongCount,
  onPlayAgain,
  onChangeDigitLevel,
  onGetBetter,
}: RoundSummaryProps) {
  const hasWrongs = wrongCount > 0

  // Continue label changes based on whether the child leveled up. Either way
  // the action (playAgain) starts a fresh round at the current number count.
  const continueLabel = leveledUpThisRound
    ? `Next level (${currentNumberCount} numbers)`
    : 'Play Again'

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-card bg-card-surface border border-card-border p-6 text-center">
        <div className="inline-block bg-magic-gold text-bg-navy font-bold rounded-pill px-3 py-1 text-xs uppercase tracking-wider mb-4">
          Round Complete!
        </div>
        <div className="text-5xl font-black tabular-nums mb-1">
          {correct}<span className="text-text-muted text-3xl"> / {GAME_CONFIG.questionsPerRound}</span>
        </div>
        <div className="text-text-muted mb-6">correct</div>

        {leveledUpThisRound ? (
          <div className="rounded-card bg-level-green/20 border border-level-green/40 p-4 mb-3">
            <div className="text-sm text-text-muted">New level reached!</div>
            <div className="text-xl font-bold text-level-green">
              ✦ You moved up to {currentNumberCount} numbers
            </div>
          </div>
        ) : (
          <div className="rounded-card bg-bg-navy border border-card-border p-4 mb-3">
            <div className="text-sm text-text-muted">Current level</div>
            <div className="text-xl font-bold">
              {currentNumberCount}-number questions
            </div>
          </div>
        )}

        {consecutiveCorrect > 0 && (
          <div className="rounded-card bg-bg-navy border border-card-border p-4 mb-3">
            <div className="text-sm text-text-muted">Streak carried over</div>
            <div className="text-xl font-bold text-magic-gold">
              ✓ {consecutiveCorrect} in a row
            </div>
          </div>
        )}

        {hasWrongs && (
          <div className="rounded-card bg-quest-red/15 border border-quest-red/40 p-4 mb-3 text-left">
            <div className="text-sm font-bold text-quest-red mb-1">
              {leveledUpThisRound ? 'Want to review?' : 'Almost there!'}
            </div>
            <div className="text-xs text-white/80">
              {leveledUpThisRound
                ? `Great job leveling up! You missed ${wrongCount} ${wrongCount === 1 ? 'question' : 'questions'} along the way — review them in Get Better Mode, or skip ahead to the next level.`
                : `You missed ${wrongCount} ${wrongCount === 1 ? 'question' : 'questions'} this round and didn't level up. Try Get Better Mode to review them with no timer.`}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          {/* Primary action depends on the situation:
              - Leveled up: continue celebrates the win; review is secondary.
              - Did not level up + wrongs: review is primary (learning focus).
              - Did not level up + no wrongs: continue is primary. */}
          {leveledUpThisRound ? (
            <>
              <button
                onClick={onPlayAgain}
                className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
              >
                {continueLabel}
              </button>
              {hasWrongs && (
                <button
                  onClick={onGetBetter}
                  className="w-full min-h-touch bg-quest-red/15 text-quest-red border-2 border-quest-red font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
                >
                  Review wrong answers
                </button>
              )}
            </>
          ) : hasWrongs ? (
            <>
              <button
                onClick={onGetBetter}
                className="w-full min-h-touch bg-quest-red text-white font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
              >
                Get Better Mode
              </button>
              <button
                onClick={onPlayAgain}
                className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
              >
                {continueLabel}
              </button>
            </>
          ) : (
            <button
              onClick={onPlayAgain}
              className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
            >
              {continueLabel}
            </button>
          )}
          <button
            onClick={onChangeDigitLevel}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            Change Digit Level
          </button>
        </div>
      </div>
    </div>
  )
}
