import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import {
  HttpsError,
  onCall,
} from 'firebase-functions/v2/https'

initializeApp()

// Keep this in sync with ADMIN_USERNAMES in src/services/authStore.ts.
// Stored as synthetic emails since that's what we compare against on
// request.auth.token.email.
const ADMIN_EMAILS = new Set<string>(['baxiadmin@baxiquest.app'])

function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.has(email.toLowerCase())
}

interface ResetUserPasswordPayload {
  // The uid of the student whose password is being reset.
  uid?: string
  // The new password. Must be >= 6 chars.
  newPassword?: string
}

// adminResetStudentPassword: callable function (Firebase Functions v2,
// `onCall`) that lets a signed-in admin set any user's password without
// going through the normal "user signs in with old password" flow. Only
// callable by clients authenticated as one of ADMIN_EMAILS.
//
// Deployment requires the Blaze (pay-as-you-go) plan and `firebase
// deploy --only functions`. Without deployment, the client-side admin
// reset button will get "functions/not-found" and surface a clear
// error message.
export const adminResetStudentPassword = onCall<ResetUserPasswordPayload>(
  { region: 'us-central1' },
  async (request) => {
    const callerEmail = request.auth?.token.email ?? null
    if (!isAdminEmail(callerEmail)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can reset passwords.',
      )
    }

    const { uid, newPassword } = request.data ?? {}
    if (typeof uid !== 'string' || !uid) {
      throw new HttpsError('invalid-argument', 'Missing uid.')
    }
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new HttpsError(
        'invalid-argument',
        'New password must be at least 6 characters.',
      )
    }

    // Refuse to reset the admin's own password through this path — it'd
    // be a footgun (admin locks themselves out, no recovery). The admin
    // should change their own password via the regular flow.
    try {
      const target = await getAuth().getUser(uid)
      if (isAdminEmail(target.email)) {
        throw new HttpsError(
          'permission-denied',
          'Admin passwords must be changed via the regular Change Password flow.',
        )
      }
    } catch (err) {
      if (err instanceof HttpsError) throw err
      throw new HttpsError('not-found', 'Student not found.')
    }

    try {
      await getAuth().updateUser(uid, { password: newPassword })
    } catch (err) {
      console.error('[adminResetStudentPassword] updateUser failed', err)
      throw new HttpsError('internal', 'Could not update password.')
    }

    // Best-effort audit trail — admins can see who got their password
    // reset and when. Not security-critical, but useful for support.
    try {
      await getFirestore()
        .collection('passwordResets')
        .add({
          targetUid: uid,
          byEmail: callerEmail,
          at: new Date(),
        })
    } catch (err) {
      // Audit failure shouldn't fail the operation itself.
      console.warn('[adminResetStudentPassword] audit write failed', err)
    }

    return { ok: true }
  },
)
