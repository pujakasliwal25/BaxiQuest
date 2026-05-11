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
  // Firebase Auth uid — primary key for the user doc.
  userKey: string
  // Friendly name shown around the UI; admin sees this in the student list.
  name: string
  // Login username (lowercased, alphanumeric+_-). Stable identity across
  // device changes so admins can find the same student in the list.
  username: string
  // The class this student is currently linked to. Null until the student
  // enters a valid class code via JoinClassScreen. The class's curriculum
  // level wins for leaderboard bucketing.
  classId: string | null
  // Brain-O-Magic curriculum level. When linked to a class, this mirrors
  // the class's level so the student's leaderboard bucket matches their
  // class. Defaults to 'F1' until linked.
  curriculumLevel: CurriculumLevel
  progress: DigitProgress
  cellStats: CellStats
  // Lifetime coin total. Earned from correct answers, never spent or lost
  // (yet). Persisted alongside the rest of the record.
  coins: number
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
      username: typeof data.username === 'string' ? data.username : '',
      classId: typeof data.classId === 'string' ? data.classId : null,
      curriculumLevel: isCurriculumLevel(data.curriculumLevel)
        ? data.curriculumLevel
        : 'F1',
      progress: data.progress ?? {},
      cellStats: normalizeCellStats(data.cellStats),
      coins: typeof data.coins === 'number' ? data.coins : 0,
    }
  } catch (err) {
    console.warn('[progressStore] firestore load failed:', err)
    return null
  }
}

// Public read used for session restore: always hits Firestore. With the
// localStorage layer removed, a network failure here means the caller
// gets null and the user is treated as fresh — that's intentional, so we
// never display stale on-device state that doesn't match the source of
// truth.
export async function loadUserRecord(
  userKey: string,
): Promise<UserRecord | null> {
  return loadFromFirestore(userKey)
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

// Called right after Firebase Auth resolves to load (or create) the
// student's persistent record. Identity is the Firebase uid; if no record
// exists yet, an empty one is created with the provided username + name.
// Existing records keep their progress, cellStats, coins, and classId —
// only username/name are refreshed from auth.
//
// The Firestore write is awaited (not fire-and-forget) because the caller
// uses the returned record to decide where to route the user — we must
// know the record is actually persisted before that decision.
export async function ensureUserRecord(args: {
  uid: string
  username: string
  name: string
}): Promise<UserRecord> {
  const existing = await loadFromFirestore(args.uid)

  const merged: UserRecord = {
    userKey: args.uid,
    name: args.name.trim() || existing?.name || args.username,
    username: args.username || existing?.username || '',
    classId: existing?.classId ?? null,
    curriculumLevel: existing?.curriculumLevel ?? 'F1',
    progress: existing?.progress ?? {},
    cellStats: existing?.cellStats ?? {},
    coins: existing?.coins ?? 0,
  }

  await saveToFirestore(merged, {
    name: merged.name,
    username: merged.username,
    classId: merged.classId,
    curriculumLevel: merged.curriculumLevel,
    progress: merged.progress,
    cellStats: merged.cellStats,
    coins: merged.coins,
  })

  return merged
}

// Links a student to a class (or unlinks if classId is null). Awaited
// because the caller navigates to /game immediately after — if the write
// is in-flight when they answer the first question, we'd race against
// the in-game writes.
export async function setUserClass(
  rec: UserRecord,
  classId: string | null,
  curriculumLevel: CurriculumLevel,
): Promise<UserRecord> {
  const updated: UserRecord = { ...rec, classId, curriculumLevel }
  await saveToFirestore(updated, {
    classId: updated.classId,
    curriculumLevel: updated.curriculumLevel,
  })
  return updated
}

// Admin: wipe every student record from Firestore. Returns the number
// cleared (`local` is kept in the shape for callers' UI but always 0
// now — localStorage is no longer used as a store).
export async function clearAllUsers(): Promise<{
  local: number
  remote: number
}> {
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
  return { local: 0, remote }
}

// Admin: fetch every user record from Firestore. Returns an empty list
// if Firestore is unconfigured or the read fails.
export async function loadAllUsers(): Promise<UserRecord[]> {
  const db = getDb()
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, 'users'))
    const out: UserRecord[] = []
    snap.forEach((d) => {
      const data = d.data() as
        | (Partial<UserRecord> & {
            curriculumLevel?: unknown
            cellStats?: unknown
          })
        | undefined
      if (!data) return
      out.push({
        userKey: d.id,
        name: data.name ?? '',
        username: typeof data.username === 'string' ? data.username : '',
        classId: typeof data.classId === 'string' ? data.classId : null,
        curriculumLevel: isCurriculumLevel(data.curriculumLevel)
          ? data.curriculumLevel
          : 'F1',
        progress: data.progress ?? {},
        cellStats: normalizeCellStats(data.cellStats),
        coins: typeof data.coins === 'number' ? data.coins : 0,
      })
    })
    return out
  } catch (err) {
    console.warn('[progressStore] admin load all failed:', err)
    return []
  }
}

// In-game write — fire-and-forget so the UI doesn't hitch on every
// level-up. If the network drops mid-round the local state already
// reflects the new high; next page load will re-fetch from Firestore and
// recover whatever did land.
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
  void saveToFirestore(updated, { cellStats: updated.cellStats })
  return updated
}

// Bumps the lifetime coin total. No-op for amount <= 0 so callers can pass
// the formula's raw output without extra guards.
export async function addCoins(
  rec: UserRecord,
  amount: number,
): Promise<UserRecord> {
  if (!Number.isFinite(amount) || amount <= 0) return rec
  const updated: UserRecord = {
    ...rec,
    coins: (rec.coins ?? 0) + Math.round(amount),
  }
  void saveToFirestore(updated, { coins: updated.coins })
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
