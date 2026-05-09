import { useState } from 'react'
import { Baxi } from '../components/Baxi'

interface JoinClassScreenProps {
  // Returns the class id on success, or null if the code didn't match a
  // class. Network/validation errors should throw.
  onJoin: (classCode: string) => Promise<{ classId: string } | null>
  onSignOut: () => void
}

export function JoinClassScreen({ onJoin, onSignOut }: JoinClassScreenProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      setError('Enter the class code from your teacher.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await onJoin(trimmed)
      if (!result) setError('Hmm — that code does not match any class.')
    } catch (err) {
      console.warn('[JoinClass] error', err)
      setError('Something went wrong — try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        <Baxi size={100} />
        <h1 className="text-2xl font-bold mt-4 mb-1">One more thing!</h1>
        <p className="text-text-muted text-sm mb-6 text-center">
          Enter the class code your teacher gave you.
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Class code</span>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase())
                setError(null)
              }}
              disabled={loading}
              className="bg-card-surface text-white text-2xl tracking-[0.3em] text-center px-4 py-3 rounded-btn border border-card-border focus:border-baxi-blue focus:outline-none disabled:opacity-60 font-bold"
              placeholder="ABC123"
              maxLength={12}
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
            {loading ? 'Checking…' : 'Join class'}
          </button>
        </form>

        <button
          onClick={onSignOut}
          className="text-text-muted text-sm mt-6 hover:text-white"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
