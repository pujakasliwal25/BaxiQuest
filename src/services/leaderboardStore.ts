import {
  collection,
  deleteDoc,
  doc,
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

// Each entry is one user's personal best avg at one (digitType, numberCount)
// cell. We denormalize curriculumLevel onto the entry so the leaderboard
// view can filter by level without a second lookup against the users
// collection. The trade-off is staleness: if a child's level changes (next
// login or future teacher promotion) their old entries keep the old level
// until the next time they set a new personal best.
export interface LeaderboardEntry {
  cellKey: string
  digitType: DigitType
  numberCount: number
  userKey: string
  name: string
  curriculumLevel: CurriculumLevel
  avgMs: number
  achievedAt: number
}

const COLLECTION = 'leaderboardEntries'

// Deterministic doc ID so a user's entry at a given cell is one row that
// gets overwritten on improvement, not appended.
function entryDocId(cellKey: string, userKey: string): string {
  return `${cellKey}__${userKey}`
}

export function buildEntry(args: {
  digitType: DigitType
  numberCount: number
  userKey: string
  name: string
  curriculumLevel: CurriculumLevel
  avgMs: number
}): LeaderboardEntry {
  return {
    cellKey: `${args.digitType}:${args.numberCount}`,
    digitType: args.digitType,
    numberCount: args.numberCount,
    userKey: args.userKey,
    name: args.name,
    curriculumLevel: args.curriculumLevel,
    avgMs: args.avgMs,
    achievedAt: Date.now(),
  }
}

export async function recordLeaderboardEntry(
  entry: LeaderboardEntry,
): Promise<void> {
  const db = getDb()
  if (!db) return
  try {
    await setDoc(
      doc(db, COLLECTION, entryDocId(entry.cellKey, entry.userKey)),
      {
        ...entry,
        updatedAt: serverTimestamp(),
      },
    )
  } catch (err) {
    console.warn('[leaderboard] write failed:', err)
  }
}

function normalizeEntry(raw: unknown): LeaderboardEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<LeaderboardEntry>
  if (
    typeof r.cellKey !== 'string' ||
    typeof r.userKey !== 'string' ||
    typeof r.name !== 'string' ||
    typeof r.avgMs !== 'number' ||
    typeof r.numberCount !== 'number' ||
    !isCurriculumLevel(r.curriculumLevel)
  ) {
    return null
  }
  return {
    cellKey: r.cellKey,
    digitType: r.digitType as DigitType,
    numberCount: r.numberCount,
    userKey: r.userKey,
    name: r.name,
    curriculumLevel: r.curriculumLevel,
    avgMs: r.avgMs,
    achievedAt: typeof r.achievedAt === 'number' ? r.achievedAt : Date.now(),
  }
}

export async function loadAllLeaderboardEntries(): Promise<
  LeaderboardEntry[]
> {
  const db = getDb()
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, COLLECTION))
    const out: LeaderboardEntry[] = []
    snap.forEach((d) => {
      const e = normalizeEntry(d.data())
      if (e) out.push(e)
    })
    return out
  } catch (err) {
    console.warn('[leaderboard] read failed:', err)
    return []
  }
}

// Admin: wipe the entire leaderboard from Firestore. `local` is kept in
// the response shape so callers' UI keeps working, but always 0 now —
// localStorage is no longer used as a store.
export async function clearAllLeaderboard(): Promise<{
  local: boolean
  remote: number
}> {
  let remote = 0
  const db = getDb()
  if (db) {
    try {
      const snap = await getDocs(collection(db, COLLECTION))
      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)))
      remote = snap.size
    } catch (err) {
      console.warn('[leaderboard] clear firestore failed:', err)
    }
  }
  return { local: false, remote }
}

// Group entries by cellKey for O(1) lookup in the leaderboard view.
export function groupEntriesByCell(
  entries: LeaderboardEntry[],
): Map<string, LeaderboardEntry[]> {
  const out = new Map<string, LeaderboardEntry[]>()
  for (const e of entries) {
    const list = out.get(e.cellKey)
    if (list) list.push(e)
    else out.set(e.cellKey, [e])
  }
  return out
}

// Pick the lowest-avg entry whose curriculumLevel passes the filter.
// `levels === null` means "all levels".
export function pickBestForCell(
  entries: LeaderboardEntry[] | undefined,
  levels: Set<CurriculumLevel> | null,
): LeaderboardEntry | null {
  if (!entries || entries.length === 0) return null
  let best: LeaderboardEntry | null = null
  for (const e of entries) {
    if (levels && !levels.has(e.curriculumLevel)) continue
    if (best == null || e.avgMs < best.avgMs) best = e
  }
  return best
}
