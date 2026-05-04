import { useState } from 'react'
import { Baxi } from '../components/Baxi'

interface LoginScreenProps {
  onSubmit: (classCode: string, name: string) => Promise<boolean> | boolean
}

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [classCode, setClassCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!name.trim()) {
      setError('Please enter your first name')
      return
    }
    setLoading(true)
    try {
      const ok = await onSubmit(classCode, name)
      if (!ok) {
        setError('Oops! Check your class code')
      }
    } catch (err) {
      console.warn('[login] error', err)
      setError('Something went wrong — try again')
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
        <Baxi size={140} />
        <p className="text-text-muted mt-2 mb-8">by Brain-O-Magic</p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Class code</span>
            <input
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              value={classCode}
              onChange={(e) => {
                setClassCode(e.target.value.toUpperCase())
                setError(null)
              }}
              disabled={loading}
              className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none disabled:opacity-60"
              placeholder="BAXI2024"
            />
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">First name</span>
            <input
              type="text"
              autoComplete="given-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError(null)
              }}
              disabled={loading}
              className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none disabled:opacity-60"
              placeholder="Your name"
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
            {loading ? 'Loading…' : "Let's Go!"}
          </button>
        </form>
      </div>
    </div>
  )
}
