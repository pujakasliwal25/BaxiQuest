import {
  collection,
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
const LS_KEY = 'baxiquest:leaderboard:v1'

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

function saveEntryToLocalStorage(entry: LeaderboardEntry) {
  // localStorage mirror — lets the UI degrade to a single-user view when
  // Firestore isn't configured.
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    const map: Record<string, LeaderboardEntry> = raw ? JSON.parse(raw) : {}
    const id = entryDocId(entry.cellKey, entry.userKey)
    map[id] = entry
    window.localStorage.setItem(LS_KEY, JSON.stringify(map))
  } catch {
    // ignore
  }
}

function loadEntriesFromLocalStorage(): LeaderboardEntry[] {
  try {
    const raw = window.localStorage.getItem(LS_KEY)
    if (!raw) return []
    const map = JSON.parse(raw) as Record<string, LeaderboardEntry>
    return Object.values(map)
  } catch {
    return []
  }
}

export async function recordLeaderboardEntry(
  entry: LeaderboardEntry,
): Promise<void> {
  saveEntryToLocalStorage(entry)
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
  if (!db) {
    return loadEntriesFromLocalStorage()
  }
  try {
    const snap = await getDocs(collection(db, COLLECTION))
    const remote: LeaderboardEntry[] = []
    snap.forEach((d) => {
      const e = normalizeEntry(d.data())
      if (e) remote.push(e)
    })
    // Merge with localStorage so the current device's just-set bests
    // appear immediately even if Firestore hasn't propagated yet.
    const local = loadEntriesFromLocalStorage()
    const map = new Map<string, LeaderboardEntry>()
    for (const e of remote) {
      map.set(entryDocId(e.cellKey, e.userKey), e)
    }
    for (const e of local) {
      const id = entryDocId(e.cellKey, e.userKey)
      const existing = map.get(id)
      if (!existing || e.achievedAt > existing.achievedAt) {
        map.set(id, e)
      }
    }
    return Array.from(map.values())
  } catch (err) {
    console.warn('[leaderboard] read failed, falling back to ls:', err)
    return loadEntriesFromLocalStorage()
  }
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
