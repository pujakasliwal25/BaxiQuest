import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import type { DigitType } from '../utils/questionGenerator'
import { getDb } from './firebase'

export type DigitProgress = Partial<Record<DigitType, number>>

export interface UserRecord {
  userKey: string
  name: string
  classCode: string
  progress: DigitProgress
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
    const data = snap.data() as Partial<UserRecord> | undefined
    if (!data) return null
    return {
      userKey,
      name: data.name ?? '',
      classCode: data.classCode ?? '',
      progress: data.progress ?? {},
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
): Promise<UserRecord> {
  // Load existing record (firestore preferred, ls fallback)
  const remote = await loadFromFirestore(userKey)
  const local = loadFromLocalStorage(userKey)
  const existing = remote ?? local

  const merged: UserRecord = {
    userKey,
    name: name.trim() || existing?.name || '',
    classCode: classCode.trim().toUpperCase() || existing?.classCode || '',
    progress: existing?.progress ?? {},
  }

  saveToLocalStorage(merged)
  void saveToFirestore(merged, {
    name: merged.name,
    classCode: merged.classCode,
    progress: merged.progress,
  })

  return merged
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
