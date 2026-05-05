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

// Aggregate timing per (digitType, numberCount). Stored as `${digitType}:${numberCount}` so it serializes cleanly to localStorage and Firestore as a flat record.
export interface TimeStat {
  totalMs: number
  count: number
}
export type TimeStats = Record<string, TimeStat>

export function timeStatKey(digitType: DigitType, numberCount: number): string {
  return `${digitType}:${numberCount}`
}

export interface UserRecord {
  userKey: string
  name: string
  classCode: string
  // Brain-O-Magic curriculum level (F1-F4, L1-L10). Captured at login until
  // the teacher admin portal owns batch-level promotion.
  curriculumLevel: CurriculumLevel
  progress: DigitProgress
  timeStats: TimeStats
}

const LS_PREFIX = 'baxiquest:user:'

export function buildUserKey(classCode: string, name: string): string {
  const code = classCode.trim().toUpperCase()
  const n = name.trim().toLowerCase().replace(/\s+/g, '_')
  return `${code}_${n}`
}

function loadFromLocalStorage(userKey: string): UserRecord | null {
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + userKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as UserRecord
    return parsed
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
      | (Partial<UserRecord> & { curriculumLevel?: unknown })
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
      timeStats: data.timeStats ?? {},
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
    timeStats: existing?.timeStats ?? {},
  }

  saveToLocalStorage(merged)
  void saveToFirestore(merged, {
    name: merged.name,
    classCode: merged.classCode,
    curriculumLevel: merged.curriculumLevel,
    progress: merged.progress,
    timeStats: merged.timeStats,
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

export async function recordTime(
  rec: UserRecord,
  digitType: DigitType,
  numberCount: number,
  elapsedMs: number,
): Promise<UserRecord> {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return rec
  const key = timeStatKey(digitType, numberCount)
  const prev = rec.timeStats[key] ?? { totalMs: 0, count: 0 }
  const next: TimeStat = {
    totalMs: prev.totalMs + elapsedMs,
    count: prev.count + 1,
  }
  const updated: UserRecord = {
    ...rec,
    timeStats: { ...rec.timeStats, [key]: next },
  }

  saveToLocalStorage(updated)
  void saveToFirestore(updated, { timeStats: updated.timeStats })

  return updated
}

export function avgMsAt(
  rec: UserRecord | null,
  digitType: DigitType,
  numberCount: number,
): number | null {
  if (!rec) return null
  const stat = rec.timeStats[timeStatKey(digitType, numberCount)]
  if (!stat || stat.count === 0) return null
  return stat.totalMs / stat.count
}
