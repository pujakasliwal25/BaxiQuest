import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import {
  CURRICULUM_LEVELS,
  type CurriculumLevel,
  isCurriculumLevel,
} from '../utils/curriculumLevel'
import { getDb } from './firebase'

// Classes are teacher-managed groups. Each class has a unique 6-character
// code that students enter once to link their account. The class also
// declares a curriculum level (F1-L10) which is applied to every linked
// student so the leaderboard buckets by level even if the student never
// picked a level themselves.
export interface ClassRecord {
  classId: string
  name: string
  code: string
  curriculumLevel: CurriculumLevel
  createdAt: number
  // uid of the admin who created it. Mostly informational since the
  // admin allowlist is hardcoded; when we add multi-admin support this
  // becomes the ownership boundary.
  createdByUid: string
}

const COLLECTION = 'classes'

function genCode(len = 6): string {
  // Avoid easily-confused chars (0/O, 1/I/L). Uppercase for readability.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

function classDocId(): string {
  // Random 12-char id; uniqueness is enforced by Firestore. Decoupling
  // the doc id from the (mutable) class name keeps renames cheap.
  return Math.random().toString(36).slice(2, 14)
}

export async function listClasses(): Promise<ClassRecord[]> {
  const db = getDb()
  if (!db) return []
  try {
    const snap = await getDocs(collection(db, COLLECTION))
    const out: ClassRecord[] = []
    snap.forEach((d) => {
      const data = d.data() as Record<string, unknown>
      const rawCreatedAt = data.createdAt
      let createdAt = 0
      if (typeof rawCreatedAt === 'number') {
        createdAt = rawCreatedAt
      } else if (
        rawCreatedAt &&
        typeof (rawCreatedAt as { toMillis?: unknown }).toMillis === 'function'
      ) {
        createdAt = (rawCreatedAt as { toMillis: () => number }).toMillis()
      }
      out.push({
        classId: d.id,
        name: typeof data.name === 'string' ? data.name : '',
        code: typeof data.code === 'string' ? data.code : '',
        curriculumLevel: isCurriculumLevel(data.curriculumLevel)
          ? data.curriculumLevel
          : 'F1',
        createdAt,
        createdByUid:
          typeof data.createdByUid === 'string' ? data.createdByUid : '',
      })
    })
    out.sort((a, b) => a.name.localeCompare(b.name))
    return out
  } catch (err) {
    console.warn('[classStore] listClasses failed:', err)
    return []
  }
}

export async function findClassByCode(
  code: string,
): Promise<ClassRecord | null> {
  const db = getDb()
  if (!db) return null
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  try {
    const q = query(
      collection(db, COLLECTION),
      where('code', '==', normalized),
    )
    const snap = await getDocs(q)
    if (snap.empty) return null
    const d = snap.docs[0]
    const data = d.data() as Partial<ClassRecord>
    return {
      classId: d.id,
      name: data.name ?? '',
      code: data.code ?? normalized,
      curriculumLevel: isCurriculumLevel(data.curriculumLevel)
        ? data.curriculumLevel
        : 'F1',
      createdAt: 0,
      createdByUid: data.createdByUid ?? '',
    }
  } catch (err) {
    console.warn('[classStore] findClassByCode failed:', err)
    return null
  }
}

export async function getClass(classId: string): Promise<ClassRecord | null> {
  const db = getDb()
  if (!db || !classId) return null
  try {
    const snap = await getDoc(doc(db, COLLECTION, classId))
    if (!snap.exists()) return null
    const data = snap.data() as Partial<ClassRecord>
    return {
      classId,
      name: data.name ?? '',
      code: data.code ?? '',
      curriculumLevel: isCurriculumLevel(data.curriculumLevel)
        ? data.curriculumLevel
        : 'F1',
      createdAt: 0,
      createdByUid: data.createdByUid ?? '',
    }
  } catch (err) {
    console.warn('[classStore] getClass failed:', err)
    return null
  }
}

export async function createClass(args: {
  name: string
  curriculumLevel: CurriculumLevel
  createdByUid: string
}): Promise<ClassRecord> {
  const db = getDb()
  if (!db) throw new Error('Firestore is not configured')
  const name = args.name.trim()
  if (!name) throw new Error('Class name is required')
  if (!CURRICULUM_LEVELS.includes(args.curriculumLevel)) {
    throw new Error('Invalid curriculum level')
  }

  // Try a few times to mint a unique code. Collisions are extremely rare
  // but worth handling so we never silently overwrite another class.
  let code = ''
  for (let i = 0; i < 5; i++) {
    const candidate = genCode()
    const existing = await findClassByCode(candidate)
    if (!existing) {
      code = candidate
      break
    }
  }
  if (!code) throw new Error('Could not generate a unique class code')

  const classId = classDocId()
  const rec: ClassRecord = {
    classId,
    name,
    code,
    curriculumLevel: args.curriculumLevel,
    createdAt: Date.now(),
    createdByUid: args.createdByUid,
  }
  try {
    await setDoc(doc(db, COLLECTION, classId), {
      name: rec.name,
      code: rec.code,
      curriculumLevel: rec.curriculumLevel,
      createdAt: serverTimestamp(),
      createdByUid: rec.createdByUid,
    })
    return rec
  } catch (err) {
    console.warn('[classStore] createClass failed:', err)
    throw new Error('Could not create class — check your permissions.')
  }
}

export async function deleteClass(classId: string): Promise<void> {
  const db = getDb()
  if (!db) return
  try {
    await deleteDoc(doc(db, COLLECTION, classId))
  } catch (err) {
    console.warn('[classStore] deleteClass failed:', err)
    throw err
  }
}
