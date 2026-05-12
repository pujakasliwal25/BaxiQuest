import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Baxi } from '../components/Baxi'
import { AuthError, signIn } from '../services/authStore'

interface SignInScreenProps {
  onSuccess: () => void
}

export function SignInScreen({ onSuccess }: SignInScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      await signIn({ username, password })
      onSuccess()
    } catch (err) {
      if (err instanceof AuthError) setError(err.message)
      else {
        console.warn('[SignIn] error', err)
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

        <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
        <p className="text-text-muted text-sm mb-6">Sign in to keep questing</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Username</span>
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
              placeholder="yourusername"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Password</span>
            <input
              type="password"
              autoComplete="current-password"
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
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <Link
          to="/forgot-password"
          className="text-text-muted text-xs mt-3 hover:text-white"
        >
          Forgot your password?
        </Link>

        <p className="text-text-muted text-sm mt-6">
          New here?{' '}
          <Link to="/signup" className="text-baxi-blue font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
