import { useEffect, useMemo, useState } from 'react'
import {
  type CellStats,
  loadAllUsers,
  type UserRecord,
} from '../services/progressStore'
import {
  CURRICULUM_LEVELS,
  type CurriculumLevel,
} from '../utils/curriculumLevel'
import { LeaderboardMatrix, StatsScreen } from './StatsScreen'

type AdminTab = 'students' | 'leaderboard'

interface AdminScreenProps {
  onLogout: () => void
}

function clearedCount(cellStats: CellStats): number {
  return Object.values(cellStats).filter((c) => c.cleared).length
}

function attemptedCount(cellStats: CellStats): number {
  return Object.values(cellStats).filter((c) => c.attempts > 0).length
}

function lastActivity(cellStats: CellStats): number | null {
  let last: number | null = null
  for (const c of Object.values(cellStats)) {
    if (c.lastAttemptAt != null && (last == null || c.lastAttemptAt > last)) {
      last = c.lastAttemptAt
    }
  }
  return last
}

function fmtDate(at: number | null): string {
  if (at == null) return '—'
  const d = new Date(at)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function AdminScreen({ onLogout }: AdminScreenProps) {
  const [tab, setTab] = useState<AdminTab>('students')
  const [users, setUsers] = useState<UserRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const [classFilter, setClassFilter] = useState('')
  const [levelFilters, setLevelFilters] = useState<Set<CurriculumLevel>>(
    () => new Set(CURRICULUM_LEVELS),
  )
  const [nameSearch, setNameSearch] = useState('')

  useEffect(() => {
    let cancelled = false
    loadAllUsers()
      .then((us) => {
        if (cancelled) return
        setUsers(us)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[admin] load users failed', err)
        setError('Could not load users.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!users) return []
    const cf = classFilter.trim().toUpperCase()
    const ns = nameSearch.trim().toLowerCase()
    return users
      .filter((u) => {
        if (cf && !u.classCode.toUpperCase().includes(cf)) return false
        if (!levelFilters.has(u.curriculumLevel)) return false
        if (ns && !u.name.toLowerCase().includes(ns)) return false
        return true
      })
      .sort((a, b) => {
        // Most recently active first; ties fall back to name.
        const al = lastActivity(a.cellStats) ?? 0
        const bl = lastActivity(b.cellStats) ?? 0
        if (al !== bl) return bl - al
        return a.name.localeCompare(b.name)
      })
  }, [users, classFilter, levelFilters, nameSearch])

  const selected = users?.find((u) => u.userKey === selectedKey) ?? null

  if (selected) {
    return (
      <StatsScreen
        userRecord={selected}
        onBack={() => setSelectedKey(null)}
        onRedo={null}
        headerLabel={`${selected.name || 'Student'} · ${selected.curriculumLevel}`}
        showLeaderboard={false}
      />
    )
  }

  const toggleLevel = (lv: CurriculumLevel) => {
    setLevelFilters((prev) => {
      const next = new Set(prev)
      if (next.has(lv)) next.delete(lv)
      else next.add(lv)
      return next
    })
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
        <h1 className="text-lg font-bold">Admin</h1>
        <button
          onClick={onLogout}
          className="text-sm text-text-muted hover:text-white px-2 py-1"
        >
          Log out
        </button>
      </div>

      <div className="flex gap-2 px-4 mb-3 shrink-0">
        <button
          onClick={() => setTab('students')}
          className={`flex-1 min-h-touch rounded-pill text-sm font-bold transition-colors ${
            tab === 'students'
              ? 'bg-magic-gold text-bg-navy'
              : 'bg-card-surface border border-card-border text-white'
          }`}
        >
          Students
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

      {tab === 'leaderboard' ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
          <LeaderboardMatrix />
        </div>
      ) : (
        <StudentsTab
          users={users}
          error={error}
          filtered={filtered}
          classFilter={classFilter}
          setClassFilter={setClassFilter}
          nameSearch={nameSearch}
          setNameSearch={setNameSearch}
          levelFilters={levelFilters}
          toggleLevel={toggleLevel}
          setLevelFilters={setLevelFilters}
          onSelect={setSelectedKey}
        />
      )}
    </div>
  )
}

interface StudentsTabProps {
  users: UserRecord[] | null
  error: string | null
  filtered: UserRecord[]
  classFilter: string
  setClassFilter: (v: string) => void
  nameSearch: string
  setNameSearch: (v: string) => void
  levelFilters: Set<CurriculumLevel>
  toggleLevel: (lv: CurriculumLevel) => void
  setLevelFilters: (s: Set<CurriculumLevel>) => void
  onSelect: (userKey: string) => void
}

function StudentsTab({
  users,
  error,
  filtered,
  classFilter,
  setClassFilter,
  nameSearch,
  setNameSearch,
  levelFilters,
  toggleLevel,
  setLevelFilters,
  onSelect,
}: StudentsTabProps) {
  return (
    <>
      <div className="px-4 pb-3 shrink-0 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            placeholder="Class code"
            className="bg-card-surface text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
          />
          <input
            type="text"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Search name"
            className="bg-card-surface text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
              Levels
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setLevelFilters(new Set(CURRICULUM_LEVELS))}
                className="text-[11px] text-baxi-blue font-semibold hover:underline"
              >
                All
              </button>
              <span className="text-text-muted text-[11px]">·</span>
              <button
                onClick={() => setLevelFilters(new Set())}
                className="text-[11px] text-baxi-blue font-semibold hover:underline"
              >
                None
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {CURRICULUM_LEVELS.map((lv) => {
              const on = levelFilters.has(lv)
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
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {error && (
          <div className="text-quest-red text-sm text-center py-6">
            {error}
          </div>
        )}
        {users == null && !error && (
          <div className="text-text-muted text-sm text-center py-12">
            Loading students…
          </div>
        )}
        {users != null && filtered.length === 0 && (
          <div className="text-text-muted text-sm text-center py-12 px-4">
            {users.length === 0 ? (
              <>
                No student records found yet. Once a student logs in and
                plays a round, their data will show up here.
              </>
            ) : (
              <>No students match these filters.</>
            )}
          </div>
        )}
        {filtered.length > 0 && (
          <>
            <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold mb-2 px-1">
              {filtered.length} student{filtered.length === 1 ? '' : 's'}
            </div>
            <ul className="space-y-2">
              {filtered.map((u) => {
                const cleared = clearedCount(u.cellStats)
                const attempted = attemptedCount(u.cellStats)
                const last = lastActivity(u.cellStats)
                return (
                  <li key={u.userKey}>
                    <button
                      onClick={() => onSelect(u.userKey)}
                      className="w-full text-left rounded-card bg-card-surface border border-card-border p-3 active:scale-[0.99] transition-transform hover:border-magic-gold"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-base">
                          {u.name || '(no name)'}
                        </span>
                        <span className="text-xs text-magic-gold font-bold">
                          {u.curriculumLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>{u.classCode || '—'}</span>
                        <span className="tabular-nums">
                          {cleared} cleared · {attempted} attempted · last{' '}
                          {fmtDate(last)}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </>
  )
}
