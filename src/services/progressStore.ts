import {
  doc,
  getDoc,
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

const RECENT_ATTEMPT_LIMIT = 10
const TOP_FASTEST_LIMIT = 10

export interface AttemptRecord {
  ms: number
  correct: boolean
}

export interface FastestRecord {
  ms: number
  at: number
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
  // Sliding window of the most recent attempts at this cell. Used to
  // compute "avg of correct in last 10" for cells the child hasn't yet
  // cleared.
  recentAttempts: AttemptRecord[]
  // Top 10 fastest individual correct answers, sorted ascending. Bounded.
  topTenFastestMs: FastestRecord[]
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
    recentAttempts: [],
    topTenFastestMs: [],
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

function normalizeCellStats(raw: unknown): CellStats {
  if (!raw || typeof raw !== 'object') return {}
  const out: CellStats = {}
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue
    const v = val as Partial<CellStat>
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
      recentAttempts: Array.isArray(v.recentAttempts)
        ? v.recentAttempts.slice(-RECENT_ATTEMPT_LIMIT)
        : [],
      topTenFastestMs: Array.isArray(v.topTenFastestMs)
        ? v.topTenFastestMs.slice(0, TOP_FASTEST_LIMIT)
        : [],
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

// Bumps the attempt counter for a cell (each round-start = one attempt).
export async function recordCellAttemptStart(
  rec: UserRecord,
  digitType: DigitType,
  numberCount: number,
): Promise<UserRecord> {
  const key = cellKey(digitType, numberCount)
  const prev = rec.cellStats[key] ?? emptyCellStat()
  const next: CellStat = {
    ...prev,
    attempts: prev.attempts + 1,
    lastAttemptAt: Date.now(),
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
  const recentAttempts = [
    ...prev.recentAttempts,
    { ms: input.elapsedMs, correct: input.correct },
  ].slice(-RECENT_ATTEMPT_LIMIT)

  let topTenFastestMs = prev.topTenFastestMs
  if (input.correct) {
    topTenFastestMs = [
      ...prev.topTenFastestMs,
      { ms: input.elapsedMs, at: now },
    ]
      .sort((a, b) => a.ms - b.ms)
      .slice(0, TOP_FASTEST_LIMIT)
  }

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
    recentAttempts,
    topTenFastestMs,
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
//   • Not-yet-cleared cells: avg of correct ms in the most recent 10
//     attempts; null if none of the recent attempts were correct.
export function headlineAvgMs(stat: CellStat | undefined): number | null {
  if (!stat) return null
  if (stat.cleared && stat.bestThreeInARowAvgMs != null) {
    return stat.bestThreeInARowAvgMs
  }
  const corrects = stat.recentAttempts.filter((a) => a.correct)
  if (corrects.length === 0) return null
  const sum = corrects.reduce((s, a) => s + a.ms, 0)
  return sum / corrects.length
}

export function getCellStat(
  rec: UserRecord | null,
  digitType: DigitType,
  numberCount: number,
): CellStat | undefined {
  if (!rec) return undefined
  return rec.cellStats[cellKey(digitType, numberCount)]
}
