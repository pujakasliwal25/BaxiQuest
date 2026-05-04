import { Baxi } from '../components/Baxi'
import type { DigitProgress } from '../services/progressStore'
import {
  ALL_DIGIT_TYPES,
  DIGIT_TYPE_LABELS,
  type DigitType,
} from '../utils/questionGenerator'

interface ModeSelectScreenProps {
  name: string
  progress: DigitProgress
  onPickDigitType: (digitType: DigitType) => void
}

export function ModeSelectScreen({
  name,
  progress,
  onPickDigitType,
}: ModeSelectScreenProps) {
  return (
    <div className="h-full overflow-y-auto flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <div className="flex items-start justify-between mb-8">
        <h1 className="text-3xl font-bold leading-tight">
          Hi {name}!<br />Ready to quest?
        </h1>
        <div className="shrink-0">
          <Baxi size={84} />
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-text-muted uppercase text-xs tracking-wider font-semibold mb-3">
          Choose your mode
        </h2>
        <div className="rounded-card bg-quest-red text-white p-5 font-bold text-2xl shadow-lg">
          Add &amp; Subtract
          <div className="text-sm font-normal text-white/80 mt-1">
            Add and subtract numbers and find the total
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-text-muted uppercase text-xs tracking-wider font-semibold mb-3">
          Choose your digit level
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {ALL_DIGIT_TYPES.map((dt) => {
            const best = progress[dt] ?? 0
            return (
              <button
                key={dt}
                onClick={() => onPickDigitType(dt)}
                className="relative min-h-touch rounded-pill border border-card-border bg-card-surface text-white font-semibold px-4 py-3 text-base hover:bg-magic-gold hover:text-bg-navy hover:border-magic-gold focus:bg-magic-gold focus:text-bg-navy focus:border-magic-gold transition-colors active:scale-[0.99]"
              >
                {DIGIT_TYPE_LABELS[dt]}
                {best > 0 && (
                  <span className="absolute -top-2 -right-1 bg-magic-gold text-bg-navy text-xs font-bold rounded-pill px-2 py-0.5 border border-bg-navy">
                    {best}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {Object.keys(progress).length > 0 && (
          <p className="text-text-muted text-xs mt-4 text-center">
            Numbers in gold show your best — you'll start there.
          </p>
        )}
      </section>
    </div>
  )
}
