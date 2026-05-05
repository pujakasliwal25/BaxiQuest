import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import {
  type CurriculumLevel,
  isCurriculumLevel,
} from '../utils/curriculumLevel'
import type { DigitType } from '../utils/questionGenerator'
import { getDb } from './firebase'

export type DigitProgress = Partial<Record<DigitType, number>>

// Key format `${digitType}:${numberCount}` — flat string keys serialize
// cleanly to Firestore and localStorage as a record.
export function cellKey(digitType: DigitType, numberCount: number): string {
  return `${digitType}:${numberCount}`
}

const ATTEMPT_HISTORY_LIMIT = 25

export interface QuestionOutcome {
  ms: number
  correct: boolean
}

export interface AttemptDetail {
  startedAt: number
  questions: QuestionOutcome[]
}

// Per-cell stat shape. A "cell" is one (digitType, numberCount) coordinate
// in the scorecard matrix. Stats are derived from individual question
// outcomes — see recordCellAnswer.
export interface CellStat {
  // Flips to true the first time the child gets 3-in-a-row at this cell.
  // Once true, never resets (even if they later fail) — represents the
  // "have you ever beaten this level" achievement.
  cleared: boolean
  // Avg ms of the fastest 3-consecutive-correct run ever observed at this
  // cell. Null until the first 3-in-a-row.
  bestThreeInARowAvgMs: number | null
  bestThreeInARowAt: number | null
  // Lifetime totals.
  correctCount: number
  wrongCount: number
  // Count of rounds attempted at this cell (each round-start increments).
  attempts: number
  lastAttemptAt: number | null
  // Per-attempt detail with question-by-question outcomes, capped at the
  // most recent N rounds. Drives the scorecard detail view (with restarted
  // numbering and a highlighted best-3 run). Older attempts roll off; the
  // headline bestThreeInARowAvgMs still reflects the lifetime best even if
  // its source run is no longer in history.
  attemptHistory: AttemptDetail[]
}

export type CellStats = Record<string, CellStat>

export function emptyCellStat(): CellStat {
  return {
    cleared: false,
    bestThreeInARowAvgMs: null,
    bestThreeInARowAt: null,
    correctCount: 0,
    wrongCount: 0,
    attempts: 0,
    lastAttemptAt: null,
    attemptHistory: [],
  }
}

export interface UserRecord {
  userKey: string
  name: string
  classCode: string
  // Brain-O-Magic curriculum level (F1-F4, L1-L10). Captured at login until
  // the teacher admin portal owns batch-level promotion.
  curriculumLevel: CurriculumLevel
  progress: DigitProgress
  cellStats: CellStats
}

const LS_PREFIX = 'baxiquest:user:'

export function buildUserKey(classCode: string, name: string): string {
  const code = classCode.trim().toUpperCase()
  const n = name.trim().toLowerCase().replace(/\s+/g, '_')
  return `${code}_${n}`
}

function normalizeAttemptDetail(raw: unknown): AttemptDetail | null {
  if (!raw || typeof raw !== 'object') return null
  const v = raw as Partial<AttemptDetail>
  if (typeof v.startedAt !== 'number') return null
  if (!Array.isArray(v.questions)) return null
  const questions: QuestionOutcome[] = []
  for (const q of v.questions) {
    if (!q || typeof q !== 'object') continue
    const qq = q as Partial<QuestionOutcome>
    if (typeof qq.ms !== 'number') continue
    questions.push({ ms: qq.ms, correct: Boolean(qq.correct) })
  }
  return { startedAt: v.startedAt, questions }
}

function normalizeCellStats(raw: unknown): CellStats {
  if (!raw || typeof raw !== 'object') return {}
  const out: CellStats = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue
    const v = val as Partial<CellStat>
    const history: AttemptDetail[] = []
    if (Array.isArray(v.attemptHistory)) {
      for (const a of v.attemptHistory) {
        const norm = normalizeAttemptDetail(a)
        if (norm) history.push(norm)
      }
    }
    out[key] = {
      cleared: Boolean(v.cleared),
      bestThreeInARowAvgMs:
        typeof v.bestThreeInARowAvgMs === 'number'
          ? v.bestThreeInARowAvgMs
          : null,
      bestThreeInARowAt:
        typeof v.bestThreeInARowAt === 'number' ? v.bestThreeInARowAt : null,
      correctCount: typeof v.correctCount === 'number' ? v.correctCount : 0,
      wrongCount: typeof v.wrongCount === 'number' ? v.wrongCount : 0,
      attempts: typeof v.attempts === 'number' ? v.attempts : 0,
      lastAttemptAt:
        typeof v.lastAttemptAt === 'number' ? v.lastAttemptAt : null,
      attemptHistory: history.slice(-ATTEMPT_HISTORY_LIMIT),
    }
  }
  return out
}

function loadFromLocalStorage(userKey: string): UserRecord | null {
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + userKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<UserRecord> & {
      curriculumLevel?: unknown
      cellStats?: unknown
    }
    return {
      userKey,
      name: parsed.name ?? '',
      classCode: parsed.classCode ?? '',
      curriculumLevel: isCurriculumLevel(parsed.curriculumLevel)
        ? parsed.curriculumLevel
        : 'F1',
      progress: parsed.progress ?? {},
      cellStats: normalizeCellStats(parsed.cellStats),
    }
  } catch {
    return null
  }
}

function loadAllFromLocalStorage(): UserRecord[] {
  try {
    const out: UserRecord[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i)
      if (!key || !key.startsWith(LS_PREFIX)) continue
      const userKey = key.slice(LS_PREFIX.length)
      const rec = loadFromLocalStorage(userKey)
      if (rec) out.push(rec)
    }
    return out
  } catch {
    return []
  }
}

function saveToLocalStorage(rec: UserRecord) {
  try {
    window.localStorage.setItem(LS_PREFIX + rec.userKey, JSON.stringify(rec))
  } catch {
    // ignore
  }
}

async function loadFromFirestore(userKey: string): Promise<UserRecord | null> {
  const db = getDb()
  if (!db) return null
  try {
    const snap = await getDoc(doc(db, 'users', userKey))
    if (!snap.exists()) return null
    const data = snap.data() as
      | (Partial<UserRecord> & {
          curriculumLevel?: unknown
          cellStats?: unknown
        })
      | undefined
    if (!data) return null
    return {
      userKey,
      name: data.name ?? '',
      classCode: data.classCode ?? '',
      curriculumLevel: isCurriculumLevel(data.curriculumLevel)
        ? data.curriculumLevel
        : 'F1',
      progress: data.progress ?? {},
      cellStats: normalizeCellStats(data.cellStats),
    }
  } catch (err) {
    console.warn('[progressStore] firestore load failed:', err)
    return null
  }
}

async function saveToFirestore(
  rec: UserRecord,
  fields: Partial<Record<keyof UserRecord, unknown>>,
) {
  const db = getDb()
  if (!db) return
  try {
    await setDoc(
      doc(db, 'users', rec.userKey),
      {
        ...fields,
        lastSeen: serverTimestamp(),
      },
      { merge: true },
    )
  } catch (err) {
    console.warn('[progressStore] firestore save failed:', err)
  }
}

export async function recordUser(
  userKey: string,
  name: string,
  classCode: string,
  curriculumLevel: CurriculumLevel,
): Promise<UserRecord> {
  // Load existing record (firestore preferred, ls fallback)
  const remote = await loadFromFirestore(userKey)
  const local = loadFromLocalStorage(userKey)
  const existing = remote ?? local

  // Login-time level selection wins — there's no teacher portal yet, so the
  // child's pick is authoritative for this session and onwards.
  const merged: UserRecord = {
    userKey,
    name: name.trim() || existing?.name || '',
    classCode: classCode.trim().toUpperCase() || existing?.classCode || '',
    curriculumLevel,
    progress: existing?.progress ?? {},
    cellStats: existing?.cellStats ?? {},
  }

  saveToLocalStorage(merged)
  void saveToFirestore(merged, {
    name: merged.name,
    classCode: merged.classCode,
    curriculumLevel: merged.curriculumLevel,
    progress: merged.progress,
    cellStats: merged.cellStats,
  })

  return merged
}

// Look up a stored curriculum level for a userKey without fully signing in.
// Used by the login screen to pre-select the dropdown if the child has
// logged in before on this device.
export async function loadKnownCurriculumLevel(
  userKey: string,
): Promise<CurriculumLevel | null> {
  const remote = await loadFromFirestore(userKey)
  if (remote) return remote.curriculumLevel
  const local = loadFromLocalStorage(userKey)
  if (local) return local.curriculumLevel
  return null
}

// Admin: wipe every student record. Clears localStorage and (if Firestore
// is configured) deletes every doc in the users collection. Returns the
// number of records cleared from each source.
export async function clearAllUsers(): Promise<{
  local: number
  remote: number
}> {
  let local = 0
  try {
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(LS_PREFIX)) toRemove.push(k)
    }
    for (const k of toRemove) window.localStorage.removeItem(k)
    local = toRemove.length
  } catch (err) {
    console.warn('[progressStore] clearAllUsers local failed:', err)
  }
  let remote = 0
  const db = getDb()
  if (db) {
    try {
      const snap = await getDocs(collection(db, 'users'))
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
      remote = snap.size
    } catch (err) {
      console.warn('[progressStore] clearAllUsers firestore failed:', err)
    }
  }
  return { local, remote }
}

// Admin: fetch every user record we know about. Tries Firestore first and
// falls back to (or merges with) localStorage so admins testing locally
// without Firebase configured still see at least the records on this
// device. When both sources have a user, Firestore wins.
export async function loadAllUsers(): Promise<UserRecord[]> {
  const local = loadAllFromLocalStorage()
  const db = getDb()
  if (!db) return local
  try {
    const snap = await getDocs(collection(db, 'users'))
    const remote: UserRecord[] = []
    snap.forEach((d) => {
      const data = d.data() as
        | (Partial<UserRecord> & {
            curriculumLevel?: unknown
            cellStats?: unknown
          })
        | undefined
      if (!data) return
      remote.push({
        userKey: d.id,
        name: data.name ?? '',
        classCode: data.classCode ?? '',
        curriculumLevel: isCurriculumLevel(data.curriculumLevel)
          ? data.curriculumLevel
          : 'F1',
        progress: data.progress ?? {},
        cellStats: normalizeCellStats(data.cellStats),
      })
    })
    const map = new Map<string, UserRecord>()
    for (const r of local) map.set(r.userKey, r)
    for (const r of remote) map.set(r.userKey, r)
    return Array.from(map.values())
  } catch (err) {
    console.warn('[progressStore] admin load all failed:', err)
    return local
  }
}

export async function saveProgress(
  rec: UserRecord,
  digitType: DigitType,
  numberCount: number,
): Promise<UserRecord> {
  const prev = rec.progress[digitType] ?? 0
  if (numberCount <= prev) return rec

  const updated: UserRecord = {
    ...rec,
    progress: { ...rec.progress, [digitType]: numberCount },
  }

  saveToLocalStorage(updated)
  void saveToFirestore(updated, { progress: updated.progress })

  return updated
}

// Bumps the attempt counter for a cell and starts a fresh AttemptDetail
// entry that subsequent recordCellAnswer calls will append to. Capped at
// the most recent ATTEMPT_HISTORY_LIMIT rounds.
export async function recordCellAttemptStart(
  rec: UserRecord,
  digitType: DigitType,
  numberCount: number,
): Promise<UserRecord> {
  const key = cellKey(digitType, numberCount)
  const prev = rec.cellStats[key] ?? emptyCellStat()
  const now = Date.now()
  const attemptHistory = [
    ...prev.attemptHistory,
    { startedAt: now, questions: [] },
  ].slice(-ATTEMPT_HISTORY_LIMIT)
  const next: CellStat = {
    ...prev,
    attempts: prev.attempts + 1,
    lastAttemptAt: now,
    attemptHistory,
  }
  const updated: UserRecord = {
    ...rec,
    cellStats: { ...rec.cellStats, [key]: next },
  }
  saveToLocalStorage(updated)
  void saveToFirestore(updated, { cellStats: updated.cellStats })
  return updated
}

export interface CellAnswerInput {
  correct: boolean
  elapsedMs: number
  // Avg ms of the just-completed 3-in-a-row run, if this answer completed
  // one. Caller computes from the in-memory streak buffer.
  threeInARowAvgMs?: number
  // Set true if this answer triggered a level-up at this cell — flips
  // `cleared` permanently.
  triggeredLevelUp?: boolean
}

export async function recordCellAnswer(
  rec: UserRecord,
  digitType: DigitType,
  numberCount: number,
  input: CellAnswerInput,
): Promise<UserRecord> {
  if (!Number.isFinite(input.elapsedMs) || input.elapsedMs < 0) return rec
  const key = cellKey(digitType, numberCount)
  const prev = rec.cellStats[key] ?? emptyCellStat()
  const now = Date.now()

  // Append the question outcome to the most recent attempt. If for some
  // reason there's no in-progress attempt (defensive — should always be
  // set by recordCellAttemptStart), start one implicitly.
  let attemptHistory = prev.attemptHistory
  if (attemptHistory.length === 0) {
    attemptHistory = [{ startedAt: now, questions: [] }]
  }
  const lastIdx = attemptHistory.length - 1
  attemptHistory = [
    ...attemptHistory.slice(0, lastIdx),
    {
      ...attemptHistory[lastIdx],
      questions: [
        ...attemptHistory[lastIdx].questions,
        { ms: input.elapsedMs, correct: input.correct },
      ],
    },
  ]

  let bestThreeInARowAvgMs = prev.bestThreeInARowAvgMs
  let bestThreeInARowAt = prev.bestThreeInARowAt
  if (
    input.threeInARowAvgMs != null &&
    Number.isFinite(input.threeInARowAvgMs)
  ) {
    if (
      bestThreeInARowAvgMs == null ||
      input.threeInARowAvgMs < bestThreeInARowAvgMs
    ) {
      bestThreeInARowAvgMs = input.threeInARowAvgMs
      bestThreeInARowAt = now
    }
  }

  const next: CellStat = {
    cleared: prev.cleared || Boolean(input.triggeredLevelUp),
    bestThreeInARowAvgMs,
    bestThreeInARowAt,
    correctCount: prev.correctCount + (input.correct ? 1 : 0),
    wrongCount: prev.wrongCount + (input.correct ? 0 : 1),
    attempts: prev.attempts,
    lastAttemptAt: now,
    attemptHistory,
  }
  const updated: UserRecord = {
    ...rec,
    cellStats: { ...rec.cellStats, [key]: next },
  }
  saveToLocalStorage(updated)
  void saveToFirestore(updated, { cellStats: updated.cellStats })
  return updated
}

// Headline avg-time metric for a cell:
//   • Cleared cells: best 3-in-a-row avg.
//   • Not-yet-cleared cells: avg of correct ms in the most recent attempt
//     (the latest round of up to 10 questions). Null if none correct.
export function headlineAvgMs(stat: CellStat | undefined): number | null {
  if (!stat) return null
  if (stat.cleared && stat.bestThreeInARowAvgMs != null) {
    return stat.bestThreeInARowAvgMs
  }
  const last = stat.attemptHistory[stat.attemptHistory.length - 1]
  if (!last) return null
  const corrects = last.questions.filter((q) => q.correct)
  if (corrects.length === 0) return null
  const sum = corrects.reduce((s, q) => s + q.ms, 0)
  return sum / corrects.length
}

// Within an attempt history, find the lowest-avg 3-consecutive-correct
// window across all attempts. Returns null if no 3-in-a-row exists in the
// visible history (e.g., no attempt ever produced one, or the run rolled
// off when older attempts were trimmed).
export interface BestThreeLocation {
  attemptIndex: number
  startQuestionIndex: number
  avgMs: number
}

export function findBestThreeInARow(
  history: AttemptDetail[],
): BestThreeLocation | null {
  let best: BestThreeLocation | null = null
  history.forEach((attempt, attemptIndex) => {
    const qs = attempt.questions
    for (let i = 0; i + 2 < qs.length; i++) {
      const a = qs[i]
      const b = qs[i + 1]
      const c = qs[i + 2]
      if (a.correct && b.correct && c.correct) {
        const avg = (a.ms + b.ms + c.ms) / 3
        if (best == null || avg < best.avgMs) {
          best = { attemptIndex, startQuestionIndex: i, avgMs: avg }
        }
      }
    }
  })
  return best
}

export function getCellStat(
  rec: UserRecord | null,
  digitType: DigitType,
  numberCount: number,
): CellStat | undefined {
  if (!rec) return undefined
  return rec.cellStats[cellKey(digitType, numberCount)]
}
