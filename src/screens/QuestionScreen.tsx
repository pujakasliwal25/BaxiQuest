import { useEffect, useRef, useState } from 'react'
import { AnswerInput } from '../components/AnswerInput'
import { CoinCounter } from '../components/CoinCounter'
import { QuestionDisplay } from '../components/QuestionDisplay'
import { TimerBar } from '../components/TimerBar'
import { GAME_CONFIG } from '../config/gameConfig'
import { useSpeechInput } from '../hooks/useSpeechInput'
import type { Question } from '../utils/questionGenerator'

interface QuestionScreenProps {
  question: Question
  questionInRound: number
  consecutiveCorrect: number
  // Lifetime coin total for the active user. Drives the header coin chip
  // which tweens up each time the value changes.
  coins: number
  paused: boolean
  // Level-level timer settings, picked once on the level-start screen and
  // applied to every question of the level.
  extraSeconds: number
  noTimer: boolean
  onSubmit: (answer: number | null, elapsedMs: number) => void
  onTimeout: (elapsedMs: number) => void
  onExit: () => void
}

export function QuestionScreen({
  question,
  questionInRound,
  consecutiveCorrect,
  coins,
  paused,
  extraSeconds,
  noTimer,
  onSubmit,
  onTimeout,
  onExit,
}: QuestionScreenProps) {
  const [answer, setAnswer] = useState('')
  // The child must explicitly choose Speak or Type before answering. Both
  // modes hide the question and pause the timer. They're mutually exclusive.
  const [speakActive, setSpeakActive] = useState(false)
  const [typeActive, setTypeActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const speech = useSpeechInput()
  // `submitted` drives UI (disabled buttons); the ref shadows it so handlers
  // can do synchronous double-submit checks without a render cycle delay.
  const [submitted, setSubmitted] = useState(false)
  const submittedRef = useRef(false)
  const markSubmitted = (v: boolean) => {
    submittedRef.current = v
    setSubmitted(v)
  }
  const wasListeningRef = useRef(false)
  const onSubmitRef = useRef(onSubmit)
  onSubmitRef.current = onSubmit
  // Wall-clock timestamp captured when this question first appeared. The
  // elapsed-time metric for stats is from this point until the FIRST press
  // of Type or Speak (decision moment) — typing/speaking time is excluded.
  const questionStartedAtRef = useRef<number>(performance.now())
  // Set the first time the child presses Type or Speak. Subsequent toggles
  // (Back from Type, switching modes) don't reset it.
  const decidedAtRef = useRef<number | null>(null)
  const markDecided = () => {
    if (decidedAtRef.current == null) {
      decidedAtRef.current = performance.now()
    }
  }
  // Snapshot the elapsed time. If the child has pressed Type/Speak, return
  // the time-to-decision; otherwise (timeout before any press), the full
  // wall-clock elapsed.
  const decidedElapsedMs = () => {
    const stop = decidedAtRef.current ?? performance.now()
    return Math.max(0, stop - questionStartedAtRef.current)
  }

  useEffect(() => {
    setAnswer('')
    setSpeakActive(false)
    setTypeActive(false)
    markSubmitted(false)
    wasListeningRef.current = false
    speech.reset()
    questionStartedAtRef.current = performance.now()
    decidedAtRef.current = null
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question])

  useEffect(() => {
    if (!speakActive) return
    if (submittedRef.current) return
    if (speech.parsedNumber == null) return
    const value = speech.parsedNumber
    const elapsed = decidedElapsedMs()
    markSubmitted(true)
    setAnswer(String(value))
    setSpeakActive(false)
    speech.stopListening()
    onSubmitRef.current(value, elapsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speakActive, speech.parsedNumber])

  useEffect(() => {
    const wasListening = wasListeningRef.current
    wasListeningRef.current = speech.isListening
    if (
      speakActive &&
      wasListening &&
      !speech.isListening &&
      !submittedRef.current
    ) {
      setSpeakActive(false)
    }
  }, [speakActive, speech.isListening])

  // When the child enters Type mode, focus the input so the keyboard pops up.
  useEffect(() => {
    if (!typeActive) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(t)
  }, [typeActive])

  const isLocked = paused || speakActive || typeActive
  // The "must pick speak or type" rule is only blocking when neither is active.
  const modeChosen = speakActive || typeActive

  const handleSubmit = () => {
    if (submittedRef.current) return
    if (!typeActive) return
    if (paused) return
    if (answer.trim() === '') return
    const elapsed = decidedElapsedMs()
    markSubmitted(true)
    setTypeActive(false)
    speech.stopListening()
    const parsed = parseInt(answer, 10)
    onSubmit(Number.isNaN(parsed) ? null : parsed, elapsed)
  }

  const handleTimeout = () => {
    if (submittedRef.current) return
    const elapsed = decidedElapsedMs()
    markSubmitted(true)
    setTypeActive(false)
    setSpeakActive(false)
    speech.stopListening()
    onTimeout(elapsed)
  }

  const handleSpeak = () => {
    if (submittedRef.current || paused) return
    if (!speech.supported) return
    if (speakActive) return
    markDecided()
    if (typeActive) {
      // Switch from type to speak: cancel type, then start speak.
      setTypeActive(false)
    }
    setSpeakActive(true)
    speech.startListening()
  }

  const handleType = () => {
    if (submittedRef.current || paused) return
    if (typeActive) {
      // Toggle off — back to question view. The decision moment is sticky
      // (we already captured it on the first press), so toggling Back
      // doesn't restart the clock.
      setTypeActive(false)
      return
    }
    markDecided()
    if (speakActive) {
      // Switch from speak to type: cancel speak, then start type.
      setSpeakActive(false)
      speech.stopListening()
    }
    setTypeActive(true)
  }

  const handleExit = () => {
    if (submittedRef.current) return
    speech.stopListening()
    onExit()
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 text-sm shrink-0">
        <span className="text-text-muted font-semibold">
          Q {questionInRound}/{GAME_CONFIG.questionsPerRound}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-magic-gold font-bold">
            ✓ {consecutiveCorrect}
          </span>
          <CoinCounter coins={coins} compact />
        </div>
      </div>

      <div className="px-4 pb-2 shrink-0">
        <TimerBar
          baseSeconds={question.timerSeconds}
          extraSeconds={extraSeconds}
          noTimer={noTimer}
          resetKey={question.display}
          onExpire={handleTimeout}
          paused={isLocked}
        />
      </div>

      <div className="flex-1 flex min-h-0 px-3 pb-3 gap-3">
        {/* Left: question, mode prompt, or input */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 min-w-0 gap-3">
          {speakActive && (
            <div className="flex flex-col items-center justify-center gap-3 text-center">
              <div className="text-5xl animate-pulse" aria-hidden>
                🎤
              </div>
              <div className="text-xl font-bold text-baxi-blue">
                Speak your answer
              </div>
              <div className="text-xs text-text-muted">
                Question hidden — say your number
              </div>
            </div>
          )}

          {typeActive && (
            <div className="w-full flex flex-col items-center gap-4 px-2">
              <div className="text-lg font-bold text-baxi-blue text-center">
                Type your answer
              </div>
              <AnswerInput
                ref={inputRef}
                value={answer}
                onChange={setAnswer}
                onSubmit={handleSubmit}
                disabled={paused}
              />
              <div className="text-xs text-text-muted text-center">
                Question hidden — tap Check when done
              </div>
            </div>
          )}

          {!modeChosen && (
            <>
              <QuestionDisplay numbers={question.numbers} />
              <div className="text-xs text-text-muted text-center mt-1">
                Tap Speak or Type to answer
              </div>
            </>
          )}
        </div>

        {/* Right: action buttons */}
        <div className="w-[125px] sm:w-[140px] flex flex-col gap-2 shrink-0 justify-center">
          {speech.supported && (
            <button
              onClick={handleSpeak}
              disabled={submitted || paused || speakActive}
              className={`min-h-touch rounded-btn font-bold text-sm px-2 py-2 flex items-center justify-center gap-1 active:scale-[0.99] transition-transform ${
                speakActive
                  ? 'bg-white text-quest-red border-2 border-quest-red animate-pulse'
                  : 'bg-quest-red text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <MicIcon />
              {speakActive ? 'Listening' : 'Speak'}
            </button>
          )}
          <button
            onClick={handleType}
            disabled={submitted || paused}
            className={`min-h-touch rounded-btn font-bold text-sm px-2 py-2 active:scale-[0.99] transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${
              typeActive
                ? 'bg-baxi-blue text-bg-navy border-2 border-baxi-blue'
                : 'bg-card-surface border border-card-border text-white'
            }`}
          >
            {typeActive ? 'Back' : 'Type'}
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              submitted ||
              paused ||
              !typeActive ||
              answer.trim() === ''
            }
            className="min-h-touch rounded-btn font-bold text-base px-2 py-2 bg-magic-gold text-bg-navy active:scale-[0.99] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Check
          </button>
          <button
            onClick={handleExit}
            disabled={submitted}
            className="min-h-touch rounded-btn bg-transparent text-text-muted border border-card-border font-semibold text-sm px-2 py-2 active:scale-[0.99] transition-transform hover:text-white hover:border-white"
            title="Exit and save progress"
          >
            Exit
          </button>
        </div>
      </div>
    </div>
  )
}

function MicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <line x1="12" y1="18" x2="12" y2="22" />
    </svg>
  )
}
