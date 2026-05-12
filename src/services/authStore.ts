import { deleteApp, initializeApp } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  updatePassword as fbUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  type User,
} from 'firebase/auth'
import { doc, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import type { CurriculumLevel } from '../utils/curriculumLevel'
import {
  getAuthClient,
  getFirebaseConfig,
  getFunctionsClient,
} from './firebase'

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
      | 'no-current-user'
      | 'wrong-password'
      | 'requires-recent-login'
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

// Changes the currently signed-in user's password. Firebase requires
// re-authentication for sensitive operations after a session has been
// inactive for a while, so we always re-auth first using the user-
// provided current password — that keeps the UX consistent and avoids
// surprise "requires-recent-login" errors.
export async function changePassword(args: {
  currentPassword: string
  newPassword: string
}): Promise<void> {
  const auth = getAuthClient()
  if (!auth) throw new AuthError('not-configured', 'Auth is not configured')
  const user = auth.currentUser
  if (!user || !user.email) {
    throw new AuthError('no-current-user', 'No one is signed in.')
  }
  if (args.newPassword.length < 6) {
    throw new AuthError(
      'invalid-password',
      'New password must be at least 6 characters.',
    )
  }
  try {
    const cred = EmailAuthProvider.credential(user.email, args.currentPassword)
    await reauthenticateWithCredential(user, cred)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential'
    ) {
      throw new AuthError('wrong-password', 'Current password is wrong.')
    }
    console.warn('[authStore] changePassword reauth failed', err)
    throw new AuthError('unknown', 'Could not verify current password.')
  }
  try {
    await fbUpdatePassword(user, args.newPassword)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'auth/weak-password') {
      throw new AuthError(
        'invalid-password',
        'New password must be at least 6 characters.',
      )
    }
    if (code === 'auth/requires-recent-login') {
      throw new AuthError(
        'requires-recent-login',
        'Please sign out and back in, then try again.',
      )
    }
    console.warn('[authStore] changePassword update failed', err)
    throw new AuthError('unknown', 'Could not change password.')
  }
}

// Admin path: create a brand-new student account and seed their user
// doc with the class link in one shot. We use Firebase's secondary-app
// pattern — initializeApp(name) gives us a parallel Auth instance whose
// session is independent of the admin's. createUserWithEmailAndPassword
// on that secondary auth signs us in *as the new student* there, which
// is exactly what we want (so we can write the user doc under their own
// uid and satisfy the `isSelf(uid)` Firestore rule). Once persisted we
// sign out of the secondary auth and dispose the app instance — the
// admin's primary session is untouched the whole time.
export async function adminCreateStudent(args: {
  username: string
  password: string
  name: string
  classId: string
  curriculumLevel: CurriculumLevel
}): Promise<{ uid: string }> {
  const config = getFirebaseConfig()
  if (!config) throw new AuthError('not-configured', 'Auth is not configured')

  const username = normalizeUsername(args.username)
  if (!USERNAME_RE.test(username)) {
    throw new AuthError(
      'invalid-username',
      'Username must be 2–24 chars, letters/numbers/underscore/dash.',
    )
  }
  if (args.password.length < 6) {
    throw new AuthError(
      'invalid-password',
      'Password must be at least 6 characters.',
    )
  }

  // Unique name per call so we never collide if admin clicks twice fast.
  const secondaryName = `student-create-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const secondary = initializeApp(config, secondaryName)
  const secondaryAuth = getAuth(secondary)
  try {
    let cred
    try {
      cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        emailFor(username),
        args.password,
      )
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code === 'auth/email-already-in-use') {
        throw new AuthError(
          'username-taken',
          'That username is already taken.',
        )
      }
      if (code === 'auth/weak-password') {
        throw new AuthError(
          'invalid-password',
          'Password must be at least 6 characters.',
        )
      }
      console.warn('[authStore] adminCreateStudent create failed', err)
      throw new AuthError('unknown', 'Could not create account.')
    }
    await updateProfile(cred.user, { displayName: args.name || username })

    // Write the user doc using the secondary auth's Firestore client.
    // The rule `allow create, update: if isSelf(uid)` is satisfied
    // because the secondary auth IS signed in as the new student.
    const secondaryDb = getFirestore(secondary)
    await setDoc(doc(secondaryDb, 'users', cred.user.uid), {
      name: args.name || username,
      username,
      classId: args.classId,
      curriculumLevel: args.curriculumLevel,
      progress: {},
      cellStats: {},
      coins: 0,
      lastSeen: serverTimestamp(),
    })

    await fbSignOut(secondaryAuth)
    return { uid: cred.user.uid }
  } finally {
    await deleteApp(secondary)
  }
}

// Admin path: set a student's password without knowing their old one.
// Firebase Auth doesn't allow this from the client (security feature),
// so we route through a deployed Cloud Function that holds Admin SDK
// privileges. The function checks request.auth.token.email against an
// admin allowlist before doing anything.
//
// If the function isn't deployed yet, the call fails with
// 'functions/not-found' — caller should surface this as "Deploy the
// Cloud Function first" so a teacher in the field knows what's wrong.
export class CloudFunctionUnavailable extends Error {
  constructor(message: string) {
    super(message)
  }
}

export async function adminResetStudentPassword(args: {
  uid: string
  newPassword: string
}): Promise<void> {
  const functions = getFunctionsClient()
  if (!functions) {
    throw new CloudFunctionUnavailable(
      'Firebase Functions is not configured.',
    )
  }
  if (args.newPassword.length < 6) {
    throw new AuthError(
      'invalid-password',
      'New password must be at least 6 characters.',
    )
  }
  const callable = httpsCallable<
    { uid: string; newPassword: string },
    { ok: boolean }
  >(functions, 'adminResetStudentPassword')
  try {
    await callable(args)
  } catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'functions/not-found') {
      throw new CloudFunctionUnavailable(
        'The password-reset Cloud Function is not deployed yet. See README for deploy instructions.',
      )
    }
    if (code === 'functions/permission-denied') {
      throw new AuthError(
        'unknown',
        'Only admins can reset student passwords.',
      )
    }
    console.warn('[authStore] adminResetStudentPassword failed', err)
    throw new AuthError(
      'unknown',
      (err as { message?: string }).message ||
        'Could not reset password.',
    )
  }
}
