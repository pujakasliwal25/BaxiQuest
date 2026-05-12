import { useState } from 'react'
import { AuthError, changePassword } from '../services/authStore'

interface ChangePasswordScreenProps {
  // The user's display name, for the heading.
  displayName: string
  onSuccess: () => void
  onCancel: () => void
}

export function ChangePasswordScreen({
  displayName,
  onSuccess,
  onCancel,
}: ChangePasswordScreenProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (newPassword !== confirmPassword) {
      setError("The two new-password fields don't match.")
      return
    }
    setLoading(true)
    setError(null)
    try {
      await changePassword({ currentPassword, newPassword })
      setDone(true)
      // Briefly show the success state, then let the caller navigate away.
      setTimeout(() => onSuccess(), 1200)
    } catch (err) {
      if (err instanceof AuthError) setError(err.message)
      else {
        console.warn('[ChangePassword] error', err)
        setError('Something went wrong — try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Change password</h1>
        <p className="text-text-muted text-sm mb-6">
          Updating password for <span className="text-white font-semibold">{displayName}</span>.
        </p>

        {done ? (
          <div className="rounded-card bg-level-green/20 border border-level-green/40 p-4 text-center">
            <div className="text-level-green font-bold text-lg">Password changed</div>
            <p className="text-text-muted text-sm mt-1">Taking you back…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-muted">Current password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-muted">New password (6+ chars)</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-text-muted">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setError(null)
                }}
                disabled={loading}
                className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60"
              />
            </label>

            {error && (
              <div className="text-quest-red text-sm font-medium" role="alert">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2 mt-2">
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword}
                className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="w-full min-h-touch bg-card-surface text-white border border-card-border font-bold rounded-btn px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
