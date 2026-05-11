import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getAuthClient } from './firebase'

// Username → synthetic email mapping. Firebase Auth requires an email so we
// fabricate one from the username; the user never sees it. Usernames are
// case-insensitive and constrained to a safe charset for the local-part.
const EMAIL_DOMAIN = 'baxiquest.app'

// Hardcoded admin allowlist. Whoever signs up first with these usernames
// owns admin powers. To grant admin to additional users, add them here and
// redeploy. This isn't bulletproof (anyone reading the bundle sees the
// list), but it's a reasonable trust model for a small classroom rollout.
export const ADMIN_USERNAMES = ['baxiadmin'] as const

export type AuthRole = 'admin' | 'student'

export interface AuthIdentity {
  uid: string
  username: string
  displayName: string
  role: AuthRole
}

export class AuthError extends Error {
  // Stable code, suitable for matching in UI. Mirrors a small subset of
  // Firebase's auth/* codes plus our own validation.
  constructor(
    public readonly code:
      | 'invalid-username'
      | 'invalid-password'
      | 'username-taken'
      | 'invalid-credentials'
      | 'not-configured'
      | 'unknown',
    message: string,
  ) {
    super(message)
  }
}

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{1,23}$/

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function isAdminUsername(u: string): boolean {
  const n = normalizeUsername(u)
  return ADMIN_USERNAMES.some((a) => a === n)
}

function emailFor(username: string): string {
  return `${normalizeUsername(username)}@${EMAIL_DOMAIN}`
}

function usernameFromUser(u: User): string {
  // Username is encoded in the synthetic email — local-part is canonical
  // since it's what was used at signup. displayName carries the friendly
  // name (e.g. "Aarav") and should NOT be parsed as the username, or the
  // admin allowlist breaks once Firebase fully hydrates the user object.
  if (u.email) return normalizeUsername(u.email.split('@')[0])
  if (u.displayName) return normalizeUsername(u.displayName)
  return ''
}

export function identityForUser(u: User): AuthIdentity {
  const username = usernameFromUser(u)
  return {
    uid: u.uid,
    username,
    displayName: u.displayName || username,
    role: isAdminUsername(username) ? 'admin' : 'student',
  }
}

export async function signUp(args: {
  username: string
  password: string
  displayName?: string
}): Promise<AuthIdentity> {
  const auth = getAuthClient()
  if (!auth) throw new AuthError('not-configured', 'Auth is not configured')

  const username = normalizeUsername(args.username)
  if (!USERNAME_RE.test(username)) {
    throw new AuthError(
      'invalid-username',
      'Username must be 2–24 chars, letters/numbers/underscore/dash, starting with a letter or number.',
    )
  }
  if (typeof args.password !== 'string' || args.password.length < 6) {
    throw new AuthError(
      'invalid-password',
      'Password must be at least 6 characters.',
    )
  }

  let cred
  try {
    cred = await createUserWithEmailAndPassword(
      auth,
      emailFor(username),
      args.password,
    )
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/email-already-in-use') {
      throw new AuthError(
        'username-taken',
        'That username is already taken — try a different one.',
      )
    }
    if (code === 'auth/weak-password') {
      throw new AuthError(
        'invalid-password',
        'Password must be at least 6 characters.',
      )
    }
    if (code === 'auth/invalid-email') {
      throw new AuthError(
        'invalid-username',
        'Username has invalid characters.',
      )
    }
    console.warn('[authStore] signUp unknown error', err)
    throw new AuthError('unknown', 'Something went wrong — try again.')
  }

  // Set displayName so we can recover the username later without parsing
  // the synthetic email. We use the typed username (lowercase) so the
  // identity is stable; an optional friendly name lives on the UserRecord
  // in progressStore.
  await updateProfile(cred.user, { displayName: args.displayName || username })

  return identityForUser(cred.user)
}

export async function signIn(args: {
  username: string
  password: string
}): Promise<AuthIdentity> {
  const auth = getAuthClient()
  if (!auth) throw new AuthError('not-configured', 'Auth is not configured')

  const username = normalizeUsername(args.username)
  if (!USERNAME_RE.test(username)) {
    throw new AuthError('invalid-credentials', 'Wrong username or password.')
  }

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      emailFor(username),
      args.password,
    )
    return identityForUser(cred.user)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (
      code === 'auth/user-not-found' ||
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-email'
    ) {
      throw new AuthError(
        'invalid-credentials',
        'Wrong username or password.',
      )
    }
    console.warn('[authStore] signIn unknown error', err)
    throw new AuthError('unknown', 'Something went wrong — try again.')
  }
}

export async function signOut(): Promise<void> {
  const auth = getAuthClient()
  if (!auth) return
  await fbSignOut(auth)
}

// Subscribes to Firebase Auth state. Calls back with the identity (or null
// if signed out). Returns an unsubscribe function. Firebase persists auth
// in IndexedDB by default, so the user stays signed in across reloads.
export function observeAuth(
  cb: (identity: AuthIdentity | null) => void,
): () => void {
  const auth = getAuthClient()
  if (!auth) {
    // Auth not configured — no user, no listener.
    cb(null)
    return () => {}
  }
  return onAuthStateChanged(auth, (user) => {
    cb(user ? identityForUser(user) : null)
  })
}
