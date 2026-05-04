import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseSpeechInput {
  isListening: boolean
  transcript: string
  parsedNumber: number | null
  startListening: () => void
  stopListening: () => void
  reset: () => void
  supported: boolean
  error: string | null
}

function getSpeechRecognitionCtor(): { new (): SpeechRecognition } | null {
  if (typeof window === 'undefined') return null
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

function parseSpokenNumber(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed) return null

  // Try a direct integer parse first (handles "123", "123.0").
  const digitsOnly = trimmed.replace(/[^0-9-]/g, '')
  if (/[0-9]/.test(trimmed)) {
    const direct = parseInt(digitsOnly, 10)
    if (!Number.isNaN(direct)) return direct
  }

  // Fallback: word-to-number for small spoken answers like "twenty three".
  const words: Record<string, number> = {
    zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
    eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
    fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
    nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
    seventy: 70, eighty: 80, ninety: 90,
  }
  const scales: Record<string, number> = { hundred: 100, thousand: 1000 }
  let total = 0
  let current = 0
  let matched = false
  for (const tok of trimmed.replace(/-/g, ' ').split(/\s+/)) {
    if (tok in words) {
      current += words[tok]
      matched = true
    } else if (tok in scales) {
      current = (current || 1) * scales[tok]
      if (scales[tok] >= 1000) {
        total += current
        current = 0
      }
      matched = true
    }
    // ignore unknown tokens silently
  }
  if (!matched) return null
  return total + current
}

export function useSpeechInput(): UseSpeechInput {
  const Ctor = getSpeechRecognitionCtor()
  const supported = Ctor != null
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    // Single-utterance: recognition ends after one finalized result. This is
    // faster than continuous mode (no wait for additional speech).
    rec.continuous = false

    rec.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const text = last?.[0]?.transcript ?? ''
      if (text) setTranscript(text)
    }
    rec.onerror = (event) => {
      setError(event.error || 'speech-error')
    }
    rec.onend = () => {
      setIsListening(false)
    }
    rec.onstart = () => {
      setIsListening(true)
      setError(null)
    }
    recognitionRef.current = rec
    return () => {
      try {
        rec.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
  }, [Ctor])

  const startListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    setTranscript('')
    setError(null)
    try {
      rec.start()
    } catch {
      // start() throws if already started — safe to ignore
    }
  }, [])

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec) return
    try {
      rec.stop()
    } catch {
      // ignore
    }
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  const parsedNumber = transcript ? parseSpokenNumber(transcript) : null

  return {
    isListening,
    transcript,
    parsedNumber,
    startListening,
    stopListening,
    reset,
    supported,
    error,
  }
}
