import { useEffect, useMemo, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import {
  groupEntriesByCell,
  type LeaderboardEntry,
  loadAllLeaderboardEntries,
  pickBestForCell,
} from '../services/leaderboardStore'
import {
  type AttemptDetail,
  cellKey,
  type CellStat,
  findBestThreeInARow,
  getCellStat,
  headlineAvgMs,
  type UserRecord,
} from '../services/progressStore'
import {
  CURRICULUM_LEVELS,
  type CurriculumLevel,
} from '../utils/curriculumLevel'
import {
  ALL_DIGIT_TYPES,
  DIGIT_TYPE_LABELS,
  type DigitType,
} from '../utils/questionGenerator'

interface StatsScreenProps {
  userRecord: UserRecord | null
  onBack: () => void
  // Pass null to hide the Redo button in cell detail (admin viewing a
  // student's scorecard shouldn't be able to start practice rounds for
  // them).
  onRedo: ((digitType: DigitType, numberCount: number) => void) | null
  // Header text. Defaults to "Stats". Admin viewing a student passes
  // e.g. "Aarav's scorecard".
  headerLabel?: string
  // When false, the Leaderboard tab is hidden and Scorecard is the only
  // view. Defaults to true (the child's own Stats screen has both tabs).
  showLeaderboard?: boolean
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
  headerLabel = 'Stats',
  showLeaderboard = true,
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
        <h1 className="text-lg font-bold truncate px-2">{headerLabel}</h1>
        <span className="w-12" />
      </div>

      {showLeaderboard && (
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
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
        {showLeaderboard && tab === 'leaderboard' ? (
          <LeaderboardMatrix />
        ) : (
          <ScorecardMatrix
            userRecord={userRecord}
            onSelectCell={(dt, nc) => setSelected({ dt, nc })}
          />
        )}
      </div>

      {selected && (
        <CellDetailModal
          digitType={selected.dt}
          numberCount={selected.nc}
          stat={selectedStat}
          onClose={() => setSelected(null)}
          onRedo={
            onRedo
              ? () => {
                  const dt = selected.dt
                  const nc = selected.nc
                  setSelected(null)
                  onRedo(dt, nc)
                }
              : null
          }
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
  // Null = read-only (admin viewing a student). Hides the Redo button.
  onRedo: (() => void) | null
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
                label={
                  stat.cleared ? 'Best 3-in-row avg' : 'Avg of latest round ✓'
                }
                value={fmtMs(headlineAvgMs(stat))}
                wide
              />
            </div>

            {stat.attemptHistory.length > 0 && (
              <AttemptHistory history={stat.attemptHistory} />
            )}
          </>
        ) : (
          <p className="text-text-muted text-sm mb-4">No attempts yet.</p>
        )}

        {onRedo && (stat?.attempts ?? 0) > 0 ? (
          <button
            onClick={onRedo}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-base rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
          >
            {stat?.cleared ? 'Redo to improve avg' : 'Play this level again'}
          </button>
        ) : onRedo && (stat?.attempts ?? 0) === 0 ? (
          <p className="text-text-muted text-xs text-center">
            You haven't reached this level yet — work your way up from your
            current level to unlock it.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function LeaderboardMatrix() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedLevels, setSelectedLevels] = useState<
    Set<CurriculumLevel>
  >(() => new Set(CURRICULUM_LEVELS))

  useEffect(() => {
    let cancelled = false
    loadAllLeaderboardEntries()
      .then((es) => {
        if (cancelled) return
        setEntries(es)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[stats] leaderboard load failed', err)
        setError('Could not load leaderboard. Try again later.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const grouped = useMemo(
    () => groupEntriesByCell(entries ?? []),
    [entries],
  )

  const allSelected = selectedLevels.size === CURRICULUM_LEVELS.length
  const filterSet: Set<CurriculumLevel> | null = allSelected
    ? null
    : selectedLevels

  const toggleLevel = (lv: CurriculumLevel) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev)
      if (next.has(lv)) next.delete(lv)
      else next.add(lv)
      return next
    })
  }

  return (
    <div>
      <div className="px-2 mb-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs text-text-muted uppercase tracking-wider font-semibold">
            Filter by level
          </h3>
          <div className="flex gap-1">
            <button
              onClick={() =>
                setSelectedLevels(new Set(CURRICULUM_LEVELS))
              }
              className="text-[11px] text-baxi-blue font-semibold hover:underline"
            >
              All
            </button>
            <span className="text-text-muted text-[11px]">·</span>
            <button
              onClick={() => setSelectedLevels(new Set())}
              className="text-[11px] text-baxi-blue font-semibold hover:underline"
            >
              None
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {CURRICULUM_LEVELS.map((lv) => {
            const on = selectedLevels.has(lv)
            return (
              <button
                key={lv}
                onClick={() => toggleLevel(lv)}
                className={`px-2 py-1 rounded-pill text-[11px] font-bold border transition-colors ${
                  on
                    ? 'bg-magic-gold text-bg-navy border-magic-gold'
                    : 'bg-card-surface border-card-border text-text-muted'
                }`}
              >
                {lv}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="text-quest-red text-sm text-center py-4">{error}</div>
      )}

      {entries == null && !error && (
        <div className="text-text-muted text-sm text-center py-8">
          Loading leaderboard…
        </div>
      )}

      {entries != null && (
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
                    const best = pickBestForCell(
                      grouped.get(cellKey(dt, nc)),
                      filterSet,
                    )
                    return (
                      <td key={dt} className="p-0">
                        <div
                          className={`w-20 h-12 flex flex-col items-center justify-center rounded-md text-[10px] px-1 ${
                            best
                              ? 'bg-magic-gold/15 border border-magic-gold/40 text-white'
                              : 'bg-card-surface border border-card-border text-text-muted'
                          }`}
                        >
                          {best ? (
                            <>
                              <div className="font-bold truncate w-full text-center">
                                {best.name}
                              </div>
                              <div className="text-[9px] opacity-80 tabular-nums">
                                {best.curriculumLevel} · {fmtMs(best.avgMs)}
                              </div>
                            </>
                          ) : (
                            <div className="text-[10px]">—</div>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function attemptAvgCorrectMs(attempt: AttemptDetail): number | null {
  const corrects = attempt.questions.filter((q) => q.correct)
  if (corrects.length === 0) return null
  const sum = corrects.reduce((s, q) => s + q.ms, 0)
  return sum / corrects.length
}

function attemptBestThreeAvgMs(attempt: AttemptDetail): number | null {
  let best: number | null = null
  const qs = attempt.questions
  for (let i = 0; i + 2 < qs.length; i++) {
    const a = qs[i]
    const b = qs[i + 1]
    const c = qs[i + 2]
    if (a.correct && b.correct && c.correct) {
      const avg = (a.ms + b.ms + c.ms) / 3
      if (best == null || avg < best) best = avg
    }
  }
  return best
}

function AttemptHistory({ history }: { history: AttemptDetail[] }) {
  // Newest first so the most recent attempt is at the top, matching the way
  // a child would naturally scan their history.
  const reversed = history.slice().reverse()
  const best = findBestThreeInARow(history)
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-text-muted uppercase tracking-wider font-semibold">
          Attempts ({history.length})
        </div>
        {best && (
          <div className="text-[10px] text-magic-gold font-semibold">
            Best 3-in-a-row · avg {fmtMs(best.avgMs)}
          </div>
        )}
      </div>
      <div className="space-y-2">
        {reversed.map((attempt, revIdx) => {
          // Map back to the index in the original (chronological) array so
          // we can match `findBestThreeInARow`'s coordinates.
          const originalIdx = history.length - 1 - revIdx
          const correct = attempt.questions.filter((q) => q.correct).length
          const total = attempt.questions.length
          const isBestAttempt = best?.attemptIndex === originalIdx
          const avgCorrect = attemptAvgCorrectMs(attempt)
          const bestThree = attemptBestThreeAvgMs(attempt)
          return (
            <div
              key={attempt.startedAt}
              className="rounded-card bg-bg-navy border border-card-border p-2"
            >
              <div className="flex items-center justify-between mb-1 text-[11px]">
                <span className="font-semibold">
                  Attempt #{originalIdx + 1}
                </span>
                <span className="text-text-muted">
                  {fmtDate(attempt.startedAt)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-text-muted mb-1.5 flex-wrap">
                <span>
                  <span className="text-white font-semibold tabular-nums">
                    {correct}/{total}
                  </span>{' '}
                  correct
                </span>
                {avgCorrect != null && (
                  <span>
                    avg{' '}
                    <span className="text-white font-semibold tabular-nums">
                      {fmtMs(avgCorrect)}
                    </span>
                  </span>
                )}
                {bestThree != null && (
                  <span>
                    best&nbsp;3{' '}
                    <span
                      className={`font-semibold tabular-nums ${
                        isBestAttempt ? 'text-magic-gold' : 'text-white'
                      }`}
                    >
                      {fmtMs(bestThree)}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                {attempt.questions.map((q, qIdx) => {
                  const inBest =
                    isBestAttempt &&
                    best != null &&
                    qIdx >= best.startQuestionIndex &&
                    qIdx <= best.startQuestionIndex + 2
                  return (
                    <div
                      key={qIdx}
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] tabular-nums border ${
                        inBest
                          ? 'bg-magic-gold/30 border-magic-gold text-white font-bold'
                          : q.correct
                            ? 'bg-level-green/20 border-level-green/40 text-white'
                            : 'bg-quest-red/15 border-quest-red/40 text-white/70'
                      }`}
                      title={
                        inBest
                          ? 'Part of your best 3-in-a-row'
                          : q.correct
                            ? 'Correct'
                            : 'Wrong'
                      }
                    >
                      <span className="text-text-muted">{qIdx + 1}.</span>
                      <span>{q.correct ? '✓' : '✗'}</span>
                      <span>{fmtMs(q.ms)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
