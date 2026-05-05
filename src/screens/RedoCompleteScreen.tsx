import { DIGIT_TYPE_LABELS, type DigitType } from '../utils/questionGenerator'

interface RedoCompleteScreenProps {
  digitType: DigitType
  numberCount: number
  avgMs: number
  // Best 3-in-a-row at this cell BEFORE this run. Null if this is the
  // child's first 3-in-a-row at the cell.
  previousBestMs: number | null
  onTryAgain: () => void
  onBackToScorecard: () => void
}

function fmtMs(ms: number): string {
  const sec = ms / 1000
  if (sec < 10) return `${sec.toFixed(1)}s`
  return `${Math.round(sec)}s`
}

// Pick a flavor of celebration based on whether this run beat the cell's
// previous best. Picking from a small pool so successive redos feel a bit
// more alive than a single fixed string.
function celebration(
  avgMs: number,
  previousBestMs: number | null,
): { headline: string; sub: string; isNewBest: boolean } {
  if (previousBestMs == null) {
    const opts = [
      'Nice run!',
      'You did it!',
      'Locked it in!',
      'Three in a row!',
    ]
    return {
      headline: opts[Math.floor(Math.random() * opts.length)],
      sub: 'First clean run on this level — your scorecard is updated.',
      isNewBest: true,
    }
  }
  if (avgMs < previousBestMs) {
    const delta = (previousBestMs - avgMs) / 1000
    const opts = [
      'New personal best!',
      'You beat your time!',
      'Faster than ever!',
    ]
    return {
      headline: opts[Math.floor(Math.random() * opts.length)],
      sub: `${delta.toFixed(1)}s faster than your last best of ${fmtMs(
        previousBestMs,
      )}.`,
      isNewBest: true,
    }
  }
  const delta = (avgMs - previousBestMs) / 1000
  const opts = [
    'Solid run!',
    'Steady three!',
    'Nailed it again!',
  ]
  return {
    headline: opts[Math.floor(Math.random() * opts.length)],
    sub:
      delta < 0.05
        ? `Right on your best of ${fmtMs(previousBestMs)}. So close!`
        : `${delta.toFixed(1)}s off your best of ${fmtMs(
            previousBestMs,
          )}. Try again to break it!`,
    isNewBest: false,
  }
}

export function RedoCompleteScreen({
  digitType,
  numberCount,
  avgMs,
  previousBestMs,
  onTryAgain,
  onBackToScorecard,
}: RedoCompleteScreenProps) {
  const { headline, sub, isNewBest } = celebration(avgMs, previousBestMs)

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-card bg-card-surface border border-card-border p-6 text-center">
        <div
          className={`inline-block rounded-pill px-3 py-1 text-xs uppercase tracking-wider mb-4 font-bold ${
            isNewBest
              ? 'bg-magic-gold text-bg-navy'
              : 'bg-baxi-blue/20 text-baxi-blue border border-baxi-blue/40'
          }`}
        >
          {isNewBest ? '✦ New best' : '3 in a row'}
        </div>

        <h1 className="text-3xl font-bold mb-2">{headline}</h1>
        <p className="text-text-muted text-sm mb-6">{sub}</p>

        <div className="rounded-card bg-bg-navy border border-card-border p-5 mb-3">
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
            Your 3-in-a-row average
          </div>
          <div className="text-5xl font-black tabular-nums text-magic-gold mb-1">
            {fmtMs(avgMs)}
          </div>
          <div className="text-text-muted text-xs">
            {DIGIT_TYPE_LABELS[digitType]} · {numberCount} numbers
          </div>
        </div>

        {previousBestMs != null && !isNewBest && (
          <div className="rounded-card bg-bg-navy border border-card-border p-3 mb-3 text-sm">
            <span className="text-text-muted">Best so far: </span>
            <span className="font-bold tabular-nums">
              {fmtMs(previousBestMs)}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 mt-6">
          <button
            onClick={onTryAgain}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            Try again
          </button>
          <button
            onClick={onBackToScorecard}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-bold text-base rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            Back to scorecard
          </button>
        </div>
      </div>
    </div>
  )
}
