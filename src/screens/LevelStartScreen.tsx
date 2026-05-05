import { useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import { DIGIT_TYPE_LABELS, type DigitType } from '../utils/questionGenerator'

interface LevelStartScreenProps {
  digitType: DigitType
  numberCount: number
  onConfirm: (extraSeconds: number, noTimer: boolean) => void
  onChangeDigitLevel: () => void
}

type TimerChoice =
  | { kind: 'timed'; extraSeconds: number }
  | { kind: 'no-timer' }

export function LevelStartScreen({
  digitType,
  numberCount,
  onConfirm,
  onChangeDigitLevel,
}: LevelStartScreenProps) {
  const [choice, setChoice] = useState<TimerChoice>({
    kind: 'timed',
    extraSeconds: 0,
  })

  const handleStart = () => {
    if (choice.kind === 'no-timer') {
      onConfirm(0, true)
    } else {
      onConfirm(choice.extraSeconds, false)
    }
  }

  const isSelected = (c: TimerChoice) => {
    if (choice.kind !== c.kind) return false
    if (choice.kind === 'no-timer') return true
    return choice.extraSeconds === (c as { extraSeconds: number }).extraSeconds
  }

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-8">
      <div className="w-full max-w-sm rounded-card bg-card-surface border border-card-border p-6 text-center">
        <div className="inline-block bg-magic-gold text-bg-navy font-bold rounded-pill px-3 py-1 text-xs uppercase tracking-wider mb-3">
          Ready for this level?
        </div>
        <h1 className="text-2xl font-bold mb-1">
          {DIGIT_TYPE_LABELS[digitType]}
        </h1>
        <p className="text-text-muted mb-5">
          {numberCount} numbers per question
        </p>

        <div className="text-left mb-2">
          <div className="text-sm font-semibold text-text-muted uppercase tracking-wider">
            Extra time per question
          </div>
          <div className="text-xs text-text-muted mt-1">
            The base timer scales with the number of digits. Pick a bonus to
            keep it relaxed, or remove the timer entirely.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
          {GAME_CONFIG.extraTimeOptions.map((sec) => {
            const selected = isSelected({ kind: 'timed', extraSeconds: sec })
            return (
              <button
                key={sec}
                onClick={() => setChoice({ kind: 'timed', extraSeconds: sec })}
                className={`min-h-touch rounded-btn font-bold text-base px-3 py-2 border-2 active:scale-[0.99] transition-transform ${
                  selected
                    ? 'bg-magic-gold text-bg-navy border-magic-gold'
                    : 'bg-bg-navy text-white border-card-border'
                }`}
              >
                {sec === 0 ? 'Default' : `+${sec}s`}
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setChoice({ kind: 'no-timer' })}
          className={`w-full min-h-touch rounded-btn font-bold text-base px-3 py-2 border-2 active:scale-[0.99] transition-transform mb-5 ${
            choice.kind === 'no-timer'
              ? 'bg-baxi-blue text-bg-navy border-baxi-blue'
              : 'bg-bg-navy text-white border-card-border'
          }`}
        >
          No timer
        </button>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleStart}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            Let's go!
          </button>
          <button
            onClick={onChangeDigitLevel}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-bold text-base rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            Change Digit Level
          </button>
        </div>
      </div>
    </div>
  )
}
