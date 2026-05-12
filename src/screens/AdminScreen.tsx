import { useEffect, useMemo, useState } from 'react'
import {
  adminCreateStudent,
  adminResetStudentPassword,
  AuthError,
  CloudFunctionUnavailable,
} from '../services/authStore'
import {
  type ClassRecord,
  createClass,
  deleteClass,
  listClasses,
} from '../services/classStore'
import { clearAllLeaderboard } from '../services/leaderboardStore'
import {
  type CellStats,
  clearAllUsers,
  loadAllUsers,
  type UserRecord,
} from '../services/progressStore'
import {
  CURRICULUM_LEVELS,
  type CurriculumLevel,
} from '../utils/curriculumLevel'
import { LeaderboardMatrix, StatsScreen } from './StatsScreen'

type AdminTab = 'students' | 'classes' | 'leaderboard'

interface AdminScreenProps {
  // The signed-in admin's Firebase uid; recorded on classes they create
  // so we can show ownership later.
  adminUid: string
  onLogout: () => void
  onChangePassword: () => void
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

export function AdminScreen({
  adminUid,
  onLogout,
  onChangePassword,
}: AdminScreenProps) {
  const [tab, setTab] = useState<AdminTab>('students')
  const [users, setUsers] = useState<UserRecord[] | null>(null)
  const [classes, setClasses] = useState<ClassRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const [classFilter, setClassFilter] = useState<string>('all')
  const [levelFilters, setLevelFilters] = useState<Set<CurriculumLevel>>(
    () => new Set(CURRICULUM_LEVELS),
  )
  const [nameSearch, setNameSearch] = useState('')

  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetSummary, setResetSummary] = useState<string | null>(null)

  const handleReset = async () => {
    setResetBusy(true)
    try {
      const u = await clearAllUsers()
      const l = await clearAllLeaderboard()
      setResetSummary(
        `Cleared ${u.remote} student record${
          u.remote === 1 ? '' : 's'
        } and ${l.remote} leaderboard entr${
          l.remote === 1 ? 'y' : 'ies'
        }. Logging out…`,
      )
      setTimeout(() => onLogout(), 1200)
    } finally {
      setResetBusy(false)
    }
  }

  // Initial load — users + classes in parallel.
  useEffect(() => {
    let cancelled = false
    Promise.all([loadAllUsers(), listClasses()])
      .then(([us, cs]) => {
        if (cancelled) return
        setUsers(us)
        setClasses(cs)
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[admin] load failed', err)
        setError('Could not load admin data.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Class id → class record map for fast lookup in the student list.
  const classMap = useMemo(() => {
    const m = new Map<string, ClassRecord>()
    for (const c of classes ?? []) m.set(c.classId, c)
    return m
  }, [classes])

  const filtered = useMemo(() => {
    if (!users) return []
    const ns = nameSearch.trim().toLowerCase()
    return users
      .filter((u) => {
        if (classFilter !== 'all') {
          if (classFilter === 'none' && u.classId) return false
          if (classFilter !== 'none' && u.classId !== classFilter) return false
        }
        if (!levelFilters.has(u.curriculumLevel)) return false
        if (
          ns &&
          !u.name.toLowerCase().includes(ns) &&
          !u.username.toLowerCase().includes(ns)
        )
          return false
        return true
      })
      .sort((a, b) => {
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
        <div className="flex items-center gap-2">
          <button
            onClick={onChangePassword}
            className="text-sm text-text-muted hover:text-white px-2 py-1"
          >
            Change password
          </button>
          <button
            onClick={() => setResetConfirm(true)}
            className="text-sm text-quest-red hover:underline px-2 py-1"
          >
            Reset all
          </button>
          <button
            onClick={onLogout}
            className="text-sm text-text-muted hover:text-white px-2 py-1"
          >
            Log out
          </button>
        </div>
      </div>

      <div className="flex gap-2 px-4 mb-3 shrink-0">
        {(['students', 'classes', 'leaderboard'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 min-h-touch rounded-pill text-sm font-bold transition-colors ${
              tab === t
                ? 'bg-magic-gold text-bg-navy'
                : 'bg-card-surface border border-card-border text-white'
            }`}
          >
            {t === 'students' ? 'Students' : t === 'classes' ? 'Classes' : 'Leaderboard'}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
          <LeaderboardMatrix />
        </div>
      ) : tab === 'classes' ? (
        <ClassesTab
          adminUid={adminUid}
          classes={classes}
          users={users}
          onClassesChange={setClasses}
          onUsersChange={setUsers}
        />
      ) : (
        <StudentsTab
          users={users}
          error={error}
          filtered={filtered}
          classes={classes ?? []}
          classMap={classMap}
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

      {resetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center px-4"
          onClick={() => !resetBusy && setResetConfirm(false)}
        >
          <div
            className="w-full max-w-sm rounded-card bg-card-surface border-2 border-quest-red p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1">Reset all data?</h2>
            <p className="text-sm text-text-muted mb-4">
              This deletes <span className="text-white font-semibold">every</span>{' '}
              student record and leaderboard entry. Class definitions are kept.
              The next student to log in starts fresh. This can't be undone.
            </p>

            {resetSummary && (
              <div className="text-sm text-level-green font-semibold mb-3">
                {resetSummary}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleReset}
                disabled={resetBusy || resetSummary != null}
                className="w-full min-h-touch bg-quest-red text-white font-bold rounded-btn px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                {resetBusy ? 'Clearing…' : 'Yes, reset everything'}
              </button>
              <button
                onClick={() => setResetConfirm(false)}
                disabled={resetBusy}
                className="w-full min-h-touch bg-card-surface text-white border border-card-border font-bold rounded-btn px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface StudentsTabProps {
  users: UserRecord[] | null
  error: string | null
  filtered: UserRecord[]
  classes: ClassRecord[]
  classMap: Map<string, ClassRecord>
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
  classes,
  classMap,
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
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="bg-card-surface text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
          >
            <option value="all">All classes</option>
            <option value="none">Unassigned</option>
            {classes.map((c) => (
              <option key={c.classId} value={c.classId}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            placeholder="Search name or username"
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
          <div className="text-quest-red text-sm text-center py-6">{error}</div>
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
                No student records yet. Once a student signs up and joins a
                class, they'll show up here.
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
                const className = u.classId
                  ? (classMap.get(u.classId)?.name ?? 'Unknown class')
                  : 'Unassigned'
                return (
                  <li
                    key={u.userKey}
                    className="rounded-card bg-card-surface border border-card-border p-3 hover:border-magic-gold transition-colors"
                  >
                    <button
                      onClick={() => onSelect(u.userKey)}
                      className="w-full text-left active:scale-[0.99] transition-transform"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-base">
                          {u.name || '(no name)'}
                          {u.username ? (
                            <span className="text-text-muted font-normal text-sm ml-1">
                              @{u.username}
                            </span>
                          ) : null}
                        </span>
                        <span className="text-xs text-magic-gold font-bold">
                          {u.curriculumLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-text-muted">
                        <span>{className}</span>
                        <span className="tabular-nums">
                          {cleared} cleared · {attempted} attempted · ¢{u.coins ?? 0} · last{' '}
                          {fmtDate(last)}
                        </span>
                      </div>
                    </button>
                    <ResetPasswordButton uid={u.userKey} username={u.username} />
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

interface ClassesTabProps {
  adminUid: string
  classes: ClassRecord[] | null
  users: UserRecord[] | null
  onClassesChange: (cs: ClassRecord[]) => void
  onUsersChange: (us: UserRecord[]) => void
}

function ClassesTab({
  adminUid,
  classes,
  users,
  onClassesChange,
  onUsersChange,
}: ClassesTabProps) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState<CurriculumLevel>('F1')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Which class's "Add student" form is open. null = none open.
  const [addStudentForClass, setAddStudentForClass] = useState<string | null>(
    null,
  )

  // Map classId → student count for the class list summary.
  const studentCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of users ?? []) {
      if (u.classId) m.set(u.classId, (m.get(u.classId) ?? 0) + 1)
    }
    return m
  }, [users])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) {
      setError('Class name is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await createClass({
        name: name.trim(),
        curriculumLevel: level,
        createdByUid: adminUid,
      })
      onClassesChange([...(classes ?? []), created].sort((a, b) =>
        a.name.localeCompare(b.name),
      ))
      setName('')
      setLevel('F1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create class')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (cls: ClassRecord) => {
    const linked = studentCounts.get(cls.classId) ?? 0
    const note =
      linked > 0
        ? `Delete "${cls.name}"? ${linked} student${linked === 1 ? ' is' : 's are'} currently linked — they will become unassigned.`
        : `Delete "${cls.name}"?`
    if (!window.confirm(note)) return
    try {
      await deleteClass(cls.classId)
      onClassesChange((classes ?? []).filter((c) => c.classId !== cls.classId))
    } catch (err) {
      console.warn('[admin] delete class failed', err)
      window.alert('Could not delete class — check permissions.')
    }
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
      <form
        onSubmit={handleCreate}
        className="rounded-card bg-card-surface border border-card-border p-4 mb-4 space-y-3"
      >
        <div className="text-[10px] text-text-muted uppercase tracking-wider font-semibold">
          New class
        </div>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder="Class name (e.g. Lotus)"
            disabled={busy}
            className="col-span-2 bg-bg-navy text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
          />
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as CurriculumLevel)}
            disabled={busy}
            className="bg-bg-navy text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
          >
            {CURRICULUM_LEVELS.map((lv) => (
              <option key={lv} value={lv}>
                {lv}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <div className="text-quest-red text-xs">{error}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold rounded-btn px-4 py-2 active:scale-[0.99] transition-transform disabled:opacity-60"
        >
          {busy ? 'Creating…' : 'Create class'}
        </button>
      </form>

      {classes == null ? (
        <div className="text-text-muted text-sm text-center py-12">
          Loading classes…
        </div>
      ) : classes.length === 0 ? (
        <div className="text-text-muted text-sm text-center py-12 px-4">
          No classes yet. Create one above and share the code with your
          students.
        </div>
      ) : (
        <ul className="space-y-2">
          {classes.map((c) => {
            const studentCount = studentCounts.get(c.classId) ?? 0
            return (
              <li
                key={c.classId}
                className="rounded-card bg-card-surface border border-card-border p-3"
              >
                <div className="flex items-start justify-between mb-1 gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-base truncate">{c.name}</div>
                    <div className="text-[11px] text-text-muted">
                      Level {c.curriculumLevel} · {studentCount} student
                      {studentCount === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(c)}
                    className="text-quest-red text-xs hover:underline px-1"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-2 rounded-btn bg-bg-navy border border-magic-gold/40 px-3 py-1.5">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-bold">
                      Code
                    </span>
                    <code className="text-magic-gold font-extrabold tracking-[0.2em] text-base">
                      {c.code}
                    </code>
                    <button
                      onClick={() => {
                        void navigator.clipboard?.writeText(c.code)
                      }}
                      className="text-baxi-blue text-[11px] font-semibold hover:underline"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() =>
                      setAddStudentForClass(
                        addStudentForClass === c.classId ? null : c.classId,
                      )
                    }
                    className="text-xs bg-baxi-blue text-bg-navy font-bold px-3 py-1.5 rounded-btn"
                  >
                    {addStudentForClass === c.classId ? 'Close' : '+ Add student'}
                  </button>
                </div>
                {addStudentForClass === c.classId && (
                  <AddStudentForm
                    cls={c}
                    onCreated={(rec) => {
                      onUsersChange([...(users ?? []), rec])
                      setAddStudentForClass(null)
                    }}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface AddStudentFormProps {
  cls: ClassRecord
  onCreated: (rec: UserRecord) => void
}

function AddStudentForm({ cls, onCreated }: AddStudentFormProps) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { uid } = await adminCreateStudent({
        username,
        password,
        name: name.trim() || username,
        classId: cls.classId,
        curriculumLevel: cls.curriculumLevel,
      })
      // Synthesize a minimal UserRecord to push into the list; the next
      // admin load will fetch the real one. Avoids a roundtrip.
      onCreated({
        userKey: uid,
        name: name.trim() || username,
        username: username.toLowerCase(),
        classId: cls.classId,
        curriculumLevel: cls.curriculumLevel,
        progress: {},
        cellStats: {},
        coins: 0,
      })
      setName('')
      setUsername('')
      setPassword('')
    } catch (err) {
      if (err instanceof AuthError) setError(err.message)
      else if (err instanceof Error) setError(err.message)
      else setError('Could not create student.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-card bg-bg-navy border border-card-border p-3 space-y-2"
    >
      <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">
        Add a student to {cls.name}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        placeholder="First name (optional)"
        disabled={busy}
        className="w-full bg-card-surface text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
      />
      <input
        type="text"
        value={username}
        autoCapitalize="none"
        onChange={(e) => {
          setUsername(e.target.value.toLowerCase())
          setError(null)
        }}
        placeholder="Username (lowercase, 2-24 chars)"
        disabled={busy}
        className="w-full bg-card-surface text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
      />
      <input
        type="text"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value)
          setError(null)
        }}
        placeholder="Initial password (6+ chars)"
        disabled={busy}
        className="w-full bg-card-surface text-white text-sm px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
      />
      {error && <div className="text-quest-red text-xs">{error}</div>}
      <button
        type="submit"
        disabled={busy || !username || !password}
        className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold rounded-btn px-3 py-2 active:scale-[0.99] transition-transform disabled:opacity-60 text-sm"
      >
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <p className="text-[10px] text-text-muted">
        Tell the student their username and initial password. They can
        change it from their home screen.
      </p>
    </form>
  )
}

// Inline "Reset password" widget on a student row. Expands into a small
// form when clicked, calls the adminResetStudentPassword Cloud Function.
// If the function isn't deployed yet, the error message tells the admin
// to follow the deploy instructions in the README.
function ResetPasswordButton({
  uid,
  username,
}: {
  uid: string
  username: string
}) {
  const [open, setOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await adminResetStudentPassword({ uid, newPassword })
      setDone(true)
      setNewPassword('')
      setTimeout(() => {
        setDone(false)
        setOpen(false)
      }, 1500)
    } catch (err) {
      if (
        err instanceof CloudFunctionUnavailable ||
        err instanceof AuthError ||
        err instanceof Error
      ) {
        setError(err.message)
      } else {
        setError('Could not reset password.')
      }
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 text-[11px] text-baxi-blue font-semibold hover:underline"
      >
        Reset password
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <div className="text-[10px] text-text-muted">
        Setting new password for @{username || uid.slice(0, 8)}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newPassword}
          onChange={(e) => {
            setNewPassword(e.target.value)
            setError(null)
          }}
          placeholder="New password (6+ chars)"
          disabled={busy}
          className="flex-1 bg-bg-navy text-white text-xs px-3 py-2 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy || newPassword.length < 6}
          className="text-xs bg-magic-gold text-bg-navy font-bold px-3 py-2 rounded-btn disabled:opacity-60"
        >
          {busy ? '…' : 'Set'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setError(null)
            setNewPassword('')
          }}
          disabled={busy}
          className="text-xs bg-card-surface border border-card-border text-white font-bold px-2 py-2 rounded-btn"
        >
          Cancel
        </button>
      </div>
      {error && <div className="text-quest-red text-[11px]">{error}</div>}
      {done && (
        <div className="text-level-green text-[11px] font-bold">
          Password updated.
        </div>
      )}
    </form>
  )
}
