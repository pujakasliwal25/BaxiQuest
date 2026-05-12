import { Link } from 'react-router-dom'
import { Baxi } from '../components/Baxi'

// Forgot-password landing for students who can't sign in. We can't do a
// self-serve reset because the app uses synthetic emails (no real inbox
// to send a reset link to), and Firebase doesn't let one client change
// another user's password. So this page just explains what to do:
// give your username to your teacher, who has a Reset Password button
// in the admin panel (wired to a Cloud Function under the hood).
export function ForgotPasswordScreen() {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        <Baxi size={100} />
        <h1 className="text-2xl font-bold mt-4 mb-3">Forgot your password?</h1>
        <div className="rounded-card bg-card-surface border border-card-border p-4 text-left text-sm space-y-3 mb-6">
          <p>
            <span className="text-magic-gold font-bold">Ask your teacher</span>{' '}
            to reset your password for you.
          </p>
          <p className="text-text-muted">
            Tell them your username and they can pick a new password from the
            admin panel. Then sign in with the new password and change it to
            something only you know.
          </p>
        </div>
        <Link
          to="/signin"
          className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform inline-flex items-center justify-center"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  )
}
