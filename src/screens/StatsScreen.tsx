import { useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import {
  type CellStat,
  getCellStat,
  headlineAvgMs,
  type UserRecord,
} from '../services/progressStore'
import {
  ALL_DIGIT_TYPES,
  DIGIT_TYPE_LABELS,
  type DigitType,
} from '../utils/questionGenerator'

interface StatsScreenProps {
  userRecord: UserRecord | null
  onBack: () => void
  onRedo: (digitType: DigitType, numberCount: number) => void
}

type StatsTab = 'scorecard' | 'leaderboard'

// Short column labels — the full digit-type names are too long to fit a
// 7-column matrix on a phone.
const SHORT_LABELS: Record<DigitType, string> = {
  '1-digit': '1d',
  '2-digit': '2d',
  '3-digit': '3d',
  '4-digit': '4d',
  '1-2-mixed': '1-2',
  '2-3-mixed': '2-3',
  '1-2-3-mixed': '1-2-3',
}

const NUMBER_COUNTS: number[] = []
for (
  let i = GAME_CONFIG.startNumberCount;
  i <= GAME_CONFIG.maxNumberCount;
  i++
) {
  NUMBER_COUNTS.push(i)
}

function fmtMs(ms: number | null): string {
  if (ms == null) return '—'
  const sec = ms / 1000
  if (sec < 10) return `${sec.toFixed(1)}s`
  return `${Math.round(sec)}s`
}

function fmtDate(at: number | null): string {
  if (at == null) return '—'
  const d = new Date(at)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function StatsScreen({
  userRecord,
  onBack,
  onRedo,
}: StatsScreenProps) {
  const [tab, setTab] = useState<StatsTab>('scorecard')
  const [selected, setSelected] = useState<{
    dt: DigitType
    nc: number
  } | null>(null)

  const selectedStat: CellStat | undefined = selected
    ? getCellStat(userRecord, selected.dt, selected.nc)
    : undefined

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <button
          onClick={onBack}
          className="text-sm text-text-muted hover:text-white px-2 py-1"
        >
          ← Back
        </button>
        <h1 className="text-lg font-bold">Stats</h1>
        <span className="w-12" />
      </div>

      <div className="flex gap-2 px-4 mb-3 shrink-0">
        <button
          onClick={() => setTab('scorecard')}
          className={`flex-1 min-h-touch rounded-pill text-sm font-bold transition-colors ${
            tab === 'scorecard'
              ? 'bg-magic-gold text-bg-navy'
              : 'bg-card-surface border border-card-border text-white'
          }`}
        >
          Scorecard
        </button>
        <button
          onClick={() => setTab('leaderboard')}
          className={`flex-1 min-h-touch rounded-pill text-sm font-bold transition-colors ${
            tab === 'leaderboard'
              ? 'bg-magic-gold text-bg-navy'
              : 'bg-card-surface border border-card-border text-white'
          }`}
        >
          Leaderboard
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
        {tab === 'scorecard' ? (
          <ScorecardMatrix
            userRecord={userRecord}
            onSelectCell={(dt, nc) => setSelected({ dt, nc })}
          />
        ) : (
          <div className="text-text-muted text-center py-16 px-6">
            Leaderboard is coming soon!
          </div>
        )}
      </div>

      {selected && (
        <CellDetailModal
          digitType={selected.dt}
          numberCount={selected.nc}
          stat={selectedStat}
          onClose={() => setSelected(null)}
          onRedo={() => {
            const dt = selected.dt
            const nc = selected.nc
            setSelected(null)
            onRedo(dt, nc)
          }}
        />
      )}
    </div>
  )
}

function ScorecardMatrix({
  userRecord,
  onSelectCell,
}: {
  userRecord: UserRecord | null
  onSelectCell: (dt: DigitType, nc: number) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-1">
        <thead>
          <tr>
            <th className="sticky left-0 bg-bg-navy z-10 px-1 py-1 text-text-muted text-[10px] font-semibold uppercase tracking-wider">
              #
            </th>
            {ALL_DIGIT_TYPES.map((dt) => (
              <th
                key={dt}
                className="px-1 py-1 text-text-muted text-[10px] font-semibold uppercase tracking-wider"
              >
                {SHORT_LABELS[dt]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {NUMBER_COUNTS.map((nc) => (
            <tr key={nc}>
              <td className="sticky left-0 bg-bg-navy z-10 px-1 py-1 text-text-muted font-bold text-xs text-center">
                {nc}
              </td>
              {ALL_DIGIT_TYPES.map((dt) => {
                const stat = getCellStat(userRecord, dt, nc)
                const avg = headlineAvgMs(stat)
                const cleared = stat?.cleared ?? false
                const attempted = (stat?.attempts ?? 0) > 0
                return (
                  <td key={dt} className="p-0">
                    <button
                      onClick={() => onSelectCell(dt, nc)}
                      className={`w-14 h-12 flex flex-col items-center justify-center rounded-md text-[10px] active:scale-[0.97] transition-transform ${
                        cleared
                          ? 'bg-level-green/25 border border-level-green/60 text-white'
                          : attempted
                            ? 'bg-magic-gold/15 border border-magic-gold/40 text-white'
                            : 'bg-card-surface border border-card-border text-text-muted'
                      }`}
                    >
                      <div className="font-bold tabular-nums">{fmtMs(avg)}</div>
                      <div className="text-[9px] opacity-70 tabular-nums">
                        {stat?.attempts ?? 0}×
                      </div>
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <div className="flex justify-center gap-3 mt-4 px-2 text-[10px] text-text-muted flex-wrap">
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-level-green/25 border border-level-green/60 inline-block" />
        cleared
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-magic-gold/15 border border-magic-gold/40 inline-block" />
        attempted
      </span>
      <span className="flex items-center gap-1">
        <span className="w-3 h-3 rounded bg-card-surface border border-card-border inline-block" />
        none
      </span>
    </div>
  )
}

function CellDetailModal({
  digitType,
  numberCount,
  stat,
  onClose,
  onRedo,
}: {
  digitType: DigitType
  numberCount: number
  stat: CellStat | undefined
  onClose: () => void
  onRedo: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-30 bg-black/60 flex items-end sm:items-center justify-center px-3 py-3"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-card bg-card-surface border border-card-border p-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold">
              {DIGIT_TYPE_LABELS[digitType]} · {numberCount} numbers
            </h2>
            <p className="text-text-muted text-xs">
              {stat?.cleared ? '✓ Cleared' : 'Not cleared yet'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted text-lg w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {stat ? (
          <>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <Stat label="Attempts" value={String(stat.attempts)} />
              <Stat label="Last" value={fmtDate(stat.lastAttemptAt)} />
              <Stat label="✓ Correct" value={String(stat.correctCount)} />
              <Stat label="✗ Wrong" value={String(stat.wrongCount)} />
              <Stat
                label={stat.cleared ? 'Best 3-in-row avg' : 'Avg of last 10 ✓'}
                value={fmtMs(headlineAvgMs(stat))}
                wide
              />
            </div>

            {stat.topTenFastestMs.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">
                  Top 10 fastest correct
                </div>
                <ol className="text-sm space-y-1">
                  {stat.topTenFastestMs.map((f, i) => (
                    <li
                      key={i}
                      className="flex justify-between items-center bg-bg-navy rounded px-2 py-1"
                    >
                      <span className="text-text-muted text-xs w-6">
                        #{i + 1}
                      </span>
                      <span className="font-bold tabular-nums">
                        {fmtMs(f.ms)}
                      </span>
                      <span className="text-text-muted text-xs">
                        {fmtDate(f.at)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        ) : (
          <p className="text-text-muted text-sm mb-4">No attempts yet.</p>
        )}

        {stat?.cleared ? (
          <button
            onClick={onRedo}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-base rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            Redo to improve avg
          </button>
        ) : (
          <p className="text-text-muted text-xs text-center">
            Clear this level once and you'll be able to redo it from here to
            chase a faster avg.
          </p>
        )}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  return (
    <div
      className={`rounded-card bg-bg-navy border border-card-border p-2 ${
        wide ? 'col-span-2' : ''
      }`}
    >
      <div className="text-[10px] text-text-muted uppercase tracking-wider">
        {label}
      </div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  )
}
