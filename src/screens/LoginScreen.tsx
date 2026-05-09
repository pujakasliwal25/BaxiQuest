import { useEffect, useState } from 'react'
import { Baxi } from '../components/Baxi'
import { buildUserKey, loadKnownCurriculumLevel } from '../services/progressStore'
import {
  CURRICULUM_LEVELS,
  type CurriculumLevel,
} from '../utils/curriculumLevel'

interface LoginScreenProps {
  // Returns the role the user logged in as, or null on bad code.
  onSubmit: (
    classCode: string,
    name: string,
    curriculumLevel: CurriculumLevel,
  ) => Promise<'admin' | 'student' | null>
}

export function LoginScreen({ onSubmit }: LoginScreenProps) {
  const [classCode, setClassCode] = useState('')
  const [name, setName] = useState('')
  const [curriculumLevel, setCurriculumLevel] =
    useState<CurriculumLevel>('F1')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // If the child has logged in before on this device with the same
  // (classCode, name), pre-fill the dropdown with what they last picked so
  // they don't have to re-enter it every time.
  useEffect(() => {
    const code = classCode.trim().toUpperCase()
    const trimmedName = name.trim()
    if (!code || !trimmedName) return
    const key = buildUserKey(code, trimmedName)
    let cancelled = false
    loadKnownCurriculumLevel(key).then((known) => {
      if (cancelled) return
      if (known) setCurriculumLevel(known)
    })
    return () => {
      cancelled = true
    }
  }, [classCode, name])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    if (!name.trim()) {
      setError('Please enter your first name')
      return
    }
    setLoading(true)
    try {
      const role = await onSubmit(classCode, name, curriculumLevel)
      if (!role) {
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
          <label className="flex flex-col gap-2">
            <span className="text-sm text-text-muted">Your level</span>
            <select
              value={curriculumLevel}
              onChange={(e) =>
                setCurriculumLevel(e.target.value as CurriculumLevel)
              }
              disabled={loading}
              className="bg-card-surface text-white text-lg px-4 py-3 rounded-btn border border-card-border focus:border-deep-blue focus:outline-none disabled:opacity-60"
            >
              {CURRICULUM_LEVELS.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
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
