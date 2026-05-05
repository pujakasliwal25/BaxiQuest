import { Baxi } from '../components/Baxi'
import { CoinCounter } from '../components/CoinCounter'
import {
  type DigitProgress,
  getCellStat,
  headlineAvgMs,
  type UserRecord,
} from '../services/progressStore'
import {
  ALL_DIGIT_TYPES,
  DIGIT_TYPE_LABELS,
  type DigitType,
} from '../utils/questionGenerator'

interface ModeSelectScreenProps {
  name: string
  progress: DigitProgress
  userRecord: UserRecord | null
  onPickDigitType: (digitType: DigitType) => void
  onShowStats: () => void
}

function formatAvgSeconds(ms: number): string {
  const sec = ms / 1000
  if (sec < 10) return `${sec.toFixed(1)}s`
  return `${Math.round(sec)}s`
}

export function ModeSelectScreen({
  name,
  progress,
  userRecord,
  onPickDigitType,
  onShowStats,
}: ModeSelectScreenProps) {
  return (
    <div className="h-full overflow-y-auto flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Hi {name}!<br />Ready to quest?
          </h1>
        </div>
        <div className="shrink-0">
          <Baxi size={84} />
        </div>
      </div>

      <div className="mb-6 flex items-center justify-between gap-3 rounded-card bg-magic-gold/10 border-2 border-magic-gold/40 p-3">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-text-muted text-[11px] uppercase tracking-wider font-bold">
              Your coins
            </div>
            <CoinCounter coins={userRecord?.coins ?? 0} />
          </div>
        </div>
        <button
          onClick={onShowStats}
          className="min-h-touch rounded-btn bg-baxi-blue text-bg-navy font-bold text-sm px-4 py-2 active:scale-[0.99] transition-transform shadow-md"
        >
          📊 Scorecard
        </button>
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
            const avgMs =
              best > 0
                ? headlineAvgMs(getCellStat(userRecord, dt, best))
                : null
            return (
              <button
                key={dt}
                onClick={() => onPickDigitType(dt)}
                className="relative min-h-touch rounded-card border border-card-border bg-card-surface text-white font-semibold px-3 py-3 text-base hover:bg-magic-gold hover:text-bg-navy hover:border-magic-gold focus:bg-magic-gold focus:text-bg-navy focus:border-magic-gold transition-colors active:scale-[0.99] flex flex-col items-center justify-center gap-1"
              >
                <span>{DIGIT_TYPE_LABELS[dt]}</span>
                {avgMs != null && (
                  <span className="text-[11px] font-normal opacity-80">
                    {best}R · avg {formatAvgSeconds(avgMs)}
                  </span>
                )}
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
