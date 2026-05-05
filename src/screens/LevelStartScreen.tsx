import { useState } from 'react'
import { CoinSvg } from '../components/CoinCounter'
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

function multiplierFor(choice: TimerChoice): number {
  if (choice.kind === 'no-timer') return GAME_CONFIG.coinMultiplierNoTimer
  return GAME_CONFIG.coinMultiplierByExtraSeconds[choice.extraSeconds] ?? 1
}

function multiplierLabel(mult: number): string {
  return `${Math.round(mult * 100)}%`
}

// Friendly explainer copy that reacts to the picked timer choice.
function rewardCopy(mult: number): { title: string; sub: string } {
  if (mult >= 1) {
    return {
      title: 'Top reward — full coins!',
      sub: 'You picked the snappy timer. Every correct answer earns the most coins. Speed = bonus!',
    }
  }
  if (mult >= 0.7) {
    return {
      title: 'Great reward',
      sub: `Comfortable timer — you'll still earn ${multiplierLabel(mult)} of full coins.`,
    }
  }
  if (mult >= 0.5) {
    return {
      title: 'Steady reward',
      sub: `Plenty of time, but coins are reduced to ${multiplierLabel(mult)}.`,
    }
  }
  return {
    title: 'Practice mode',
    sub: `No timer means relaxed practice — you'll earn ${multiplierLabel(mult)} of full coins.`,
  }
}

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

  const mult = multiplierFor(choice)
  const reward = rewardCopy(mult)

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
            Faster timer = more coins. Pick a bonus to keep things relaxed,
            or remove the timer for practice.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 mb-3">
          {GAME_CONFIG.extraTimeOptions.map((sec) => {
            const c: TimerChoice = { kind: 'timed', extraSeconds: sec }
            const selected = isSelected(c)
            const m = multiplierFor(c)
            return (
              <button
                key={sec}
                onClick={() => setChoice(c)}
                className={`relative min-h-touch rounded-btn font-bold text-base px-3 py-2 border-2 active:scale-[0.99] transition-transform ${
                  selected
                    ? 'bg-magic-gold text-bg-navy border-magic-gold'
                    : 'bg-bg-navy text-white border-card-border'
                }`}
              >
                {sec === 0 ? 'Default' : `+${sec}s`}
                <span
                  className={`absolute -top-2 -right-2 inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-extrabold border ${
                    selected
                      ? 'bg-bg-navy text-magic-gold border-magic-gold'
                      : 'bg-magic-gold/15 text-magic-gold border-magic-gold/60'
                  }`}
                  aria-label={`${multiplierLabel(m)} of full coins`}
                >
                  <CoinSvg size={10} />
                  {multiplierLabel(m)}
                </span>
              </button>
            )
          })}
        </div>

        <button
          onClick={() => setChoice({ kind: 'no-timer' })}
          className={`relative w-full min-h-touch rounded-btn font-bold text-base px-3 py-2 border-2 active:scale-[0.99] transition-transform mb-4 ${
            choice.kind === 'no-timer'
              ? 'bg-baxi-blue text-bg-navy border-baxi-blue'
              : 'bg-bg-navy text-white border-card-border'
          }`}
        >
          No timer
          <span
            className={`absolute -top-2 -right-2 inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[10px] font-extrabold border ${
              choice.kind === 'no-timer'
                ? 'bg-bg-navy text-baxi-blue border-baxi-blue'
                : 'bg-magic-gold/15 text-magic-gold border-magic-gold/60'
            }`}
            aria-label={`${multiplierLabel(GAME_CONFIG.coinMultiplierNoTimer)} of full coins`}
          >
            <CoinSvg size={10} />
            {multiplierLabel(GAME_CONFIG.coinMultiplierNoTimer)}
          </span>
        </button>

        <div className="rounded-card bg-magic-gold/10 border border-magic-gold/40 p-3 mb-5 flex items-start gap-2 text-left">
          <CoinSvg size={20} />
          <div>
            <div className="text-magic-gold font-extrabold text-sm">
              {reward.title}
            </div>
            <div className="text-xs text-white/80 mt-0.5">{reward.sub}</div>
          </div>
        </div>

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
