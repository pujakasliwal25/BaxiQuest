import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Baxi } from '../components/Baxi'
import { AuthError, signUp } from '../services/authStore'

interface SignUpScreenProps {
  onSuccess: () => void
}

export function SignUpScreen({ onSuccess }: SignUpScreenProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!displayName.trim()) {
      setError('Please enter your first name')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await signUp({ username, password, displayName: displayName.trim() })
      onSuccess()
    } catch (err) {
      if (err instanceof AuthError) setError(err.message)
      else {
        console.warn('[SignUp] error', err)
        setError('Something went wrong — try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="mb-3">
          <span className="inline-block bg-magic-gold text-bg-navy font-bold tracking-wide rounded-pill px-4 py-1 text-sm">
            BAXI QUEST
          </span>
        </div>
        <Baxi size={120} />
        <p className="text-text-muted mt-2 mb-6">by Brain-O-Magic</p>

        <h1 className="text-2xl font-bold mb-1">Create your account</h1>
        <p className="text-text-muted text-sm mb-6 text-center">
          You'll need a class code from your teacher to start playing.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Your name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value)
                setError(null)
              }}
              disabled={loading}
              className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60"
              placeholder="Your first name"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">
              Username <span className="text-text-muted">(2–24, lowercase letters/numbers)</span>
            </span>
            <input
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value.toLowerCase())
                setError(null)
              }}
              disabled={loading}
              className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60"
              placeholder="pickaname"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Password (6+ characters)</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(null)
              }}
              disabled={loading}
              className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60"
              placeholder="••••••"
            />
          </label>

          {error && (
            <div className="text-quest-red text-sm font-medium" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="text-text-muted text-sm mt-6">
          Already have an account?{' '}
          <Link to="/signin" className="text-baxi-blue font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
