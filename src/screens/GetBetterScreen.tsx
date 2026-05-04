import { useEffect, useMemo, useRef, useState } from 'react'
import { AnswerInput } from '../components/AnswerInput'
import { QuestionDisplay } from '../components/QuestionDisplay'
import type { WrongAttempt } from '../hooks/useGameState'
import {
  analyzeError,
  getRulesForProblem,
  type ErrorAnalysis,
  type RodRule,
} from '../utils/sorobanRules'

const CORRECT_PHRASES = [
  'Good job!',
  'Great work!',
  'You got it!',
  'Awesome!',
  'Nice one!',
  'Way to go!',
]
const ENCOURAGE_PHRASES = [
  'Try again!',
  'Almost there!',
  "You're so close!",
  'Keep going!',
  'You can do this!',
]
function pickPhrase(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length]
}

interface GetBetterScreenProps {
  attempts: WrongAttempt[]
  onExit: () => void
}

type Phase = 'review' | 'retry' | 'step' | 'step-feedback' | 'done'

function computeRunning(numbers: number[], upTo: number): number {
  let sum = 0
  for (let i = 0; i <= upTo && i < numbers.length; i++) sum += numbers[i]
  return sum
}

export function GetBetterScreen({ attempts, onExit }: GetBetterScreenProps) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('review')
  const [answer, setAnswer] = useState('')
  const [stepIndex, setStepIndex] = useState(1)
  const [stepUserValue, setStepUserValue] = useState<number | null>(null)
  const [stepWasCorrect, setStepWasCorrect] = useState(false)
  const [retrySuccess, setRetrySuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const current = attempts[index]
  const totalAttempts = attempts.length

  // Whole-question analysis from the rules engine.
  const analysis: ErrorAnalysis | null = useMemo(() => {
    if (!current) return null
    if (current.userAnswer == null) {
      // Timeout — synthesize a "didn't finish" analysis without a misleading diff.
      return {
        rulesInvolved: [],
        likelyMistake:
          "Time ran out before you could finish. No timer here — let's go through it together.",
        correctionSteps: [],
        practiceQuestions: [],
      }
    }
    return analyzeError(
      current.question.numbers,
      current.userAnswer,
      current.question.answer,
    )
  }, [current])

  // Per-step rule decomposition for the step-by-step phase.
  const stepRules: RodRule[] = useMemo(() => {
    if (!current) return []
    if (stepIndex < 1 || stepIndex >= current.question.numbers.length) return []
    const running = computeRunning(current.question.numbers, stepIndex - 1)
    const next = current.question.numbers[stepIndex]
    return getRulesForProblem(running, next)
  }, [current, stepIndex])

  useEffect(() => {
    if (phase === 'retry' || phase === 'step') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(t)
    }
  }, [phase, stepIndex])

  if (!current && phase !== 'done') {
    return (
      <div className="h-full flex items-center justify-center">
        <button
          onClick={onExit}
          className="bg-magic-gold text-bg-navy font-bold rounded-btn px-6 py-3"
        >
          Back to home
        </button>
      </div>
    )
  }

  const goToNextAttempt = () => {
    setAnswer('')
    setStepIndex(1)
    setStepUserValue(null)
    setStepWasCorrect(false)
    setRetrySuccess(false)
    if (index + 1 >= totalAttempts) {
      setPhase('done')
    } else {
      setIndex(index + 1)
      setPhase('review')
    }
  }

  const startRetry = () => {
    setAnswer('')
    setPhase('retry')
  }

  const startStepByStep = () => {
    setAnswer('')
    setStepIndex(1)
    setPhase('step')
  }

  const submitRetry = () => {
    if (!current) return
    const v = parseInt(answer, 10)
    if (Number.isNaN(v) || answer.trim() === '') return
    if (v === current.question.answer) {
      setRetrySuccess(true)
      window.setTimeout(() => goToNextAttempt(), 1400)
    } else {
      startStepByStep()
    }
  }

  const submitStep = () => {
    if (!current) return
    const v = parseInt(answer, 10)
    if (Number.isNaN(v) || answer.trim() === '') return
    const expected = computeRunning(current.question.numbers, stepIndex)
    setStepUserValue(v)
    setStepWasCorrect(v === expected)
    setPhase('step-feedback')
  }

  const continueAfterStep = () => {
    if (!current) return
    const lastIdx = current.question.numbers.length - 1
    if (stepIndex >= lastIdx) {
      goToNextAttempt()
      return
    }
    setStepIndex(stepIndex + 1)
    setAnswer('')
    setStepUserValue(null)
    setStepWasCorrect(false)
    setPhase('step')
  }

  const redoCurrent = () => {
    setAnswer('')
    setStepIndex(1)
    setStepUserValue(null)
    setStepWasCorrect(false)
    setPhase('review')
  }

  // ---- DONE ----
  if (phase === 'done') {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm rounded-card bg-card-surface border border-card-border p-6 text-center">
          <div className="text-6xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold mb-2">Amazing work!</h1>
          <p className="text-white/90 mb-2">
            You worked through every question — that takes real effort.
          </p>
          <p className="text-text-muted mb-6">
            You're getting better and better!
          </p>
          <button
            onClick={onExit}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99]"
          >
            Back to Mode Select
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null
  const numbers = current.question.numbers

  // ---- REVIEW ----
  if (phase === 'review') {
    return (
      <div className="h-full overflow-y-auto flex flex-col px-5 py-6 max-w-md mx-auto w-full">
        <Header index={index} total={totalAttempts} onExit={onExit} />

        <div className="flex-1 flex flex-col items-center justify-center gap-4 my-4">
          <div className="text-baxi-blue font-bold text-center">
            Let's take another look — you've got this 🌟
          </div>
          <QuestionDisplay numbers={numbers} compact />

          {analysis && (
            <div className="w-full rounded-card bg-bg-navy border border-card-border p-4 text-left">
              <div className="text-xs uppercase tracking-wider text-magic-gold mb-1 font-bold">
                What might have happened
              </div>
              <div className="text-sm text-white/90 leading-snug mb-3">
                {analysis.likelyMistake}
              </div>

              {analysis.rulesInvolved.length > 0 && (
                <>
                  <div className="text-xs uppercase tracking-wider text-text-muted mb-1 font-semibold">
                    Rules in this question
                  </div>
                  <ul className="text-sm text-white/90 leading-snug">
                    {analysis.rulesInvolved.map((r) => (
                      <li key={r.id} className="mb-1">
                        <span className="font-semibold">{r.name}</span>
                        <span className="text-text-muted">
                          {' '}
                          — {r.beadMovement.callout}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          {current.userAnswer != null && (
            <div className="text-sm text-text-muted">
              Your answer was{' '}
              <span className="text-white font-bold tabular-nums">
                {current.userAnswer}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={startRetry}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99]"
          >
            Try this question again
          </button>
          <button
            onClick={startStepByStep}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-semibold text-base rounded-btn px-4 py-3 active:scale-[0.99]"
          >
            Walk through step by step
          </button>
          <button
            onClick={goToNextAttempt}
            className="w-full text-text-muted text-sm py-2 hover:text-white"
          >
            Skip — next question
          </button>
        </div>
      </div>
    )
  }

  // ---- RETRY ----
  if (phase === 'retry') {
    if (retrySuccess) {
      const phrase = pickPhrase(CORRECT_PHRASES, index)
      return (
        <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm rounded-card bg-level-green/15 border border-level-green/40 p-6 text-center">
            <div className="text-6xl text-level-green mb-2">✓</div>
            <h1 className="text-3xl font-bold text-level-green mb-1">
              {phrase}
            </h1>
            <p className="text-white/80">You got it this time.</p>
          </div>
        </div>
      )
    }

    return (
      <div className="h-full overflow-y-auto flex flex-col px-5 py-6 max-w-md mx-auto w-full">
        <Header index={index} total={totalAttempts} onExit={onExit} />

        <div className="flex-1 flex flex-col items-center justify-center gap-5 my-4">
          <div className="text-baxi-blue font-bold text-lg">
            Take your time — no timer 💪
          </div>
          <QuestionDisplay numbers={numbers} compact />
          <AnswerInput
            ref={inputRef}
            value={answer}
            onChange={setAnswer}
            onSubmit={submitRetry}
          />
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={submitRetry}
            disabled={answer.trim() === ''}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] disabled:opacity-40"
          >
            Check
          </button>
          <button
            onClick={redoCurrent}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-semibold text-base rounded-btn px-4 py-3"
          >
            Redo this question
          </button>
          <button
            onClick={goToNextAttempt}
            className="w-full text-text-muted text-sm py-2 hover:text-white"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  // ---- STEP (asking) ----
  if (phase === 'step') {
    const running = computeRunning(numbers, stepIndex - 1)
    const next = numbers[stepIndex]
    const opSymbol = next < 0 ? '−' : '+'
    const lastIdx = numbers.length - 1
    return (
      <div className="h-full overflow-y-auto flex flex-col px-5 py-6 max-w-md mx-auto w-full">
        <Header
          index={index}
          total={totalAttempts}
          onExit={onExit}
          subtitle={`Step ${stepIndex} of ${lastIdx}`}
        />

        <div className="flex-1 flex flex-col items-center justify-center gap-5 my-4">
          <div className="text-baxi-blue font-bold text-base">
            One number at a time — you've got this!
          </div>
          <div className="text-5xl font-mono font-bold tabular-nums text-center">
            {running} {opSymbol} {Math.abs(next)} = ?
          </div>
          <AnswerInput
            ref={inputRef}
            value={answer}
            onChange={setAnswer}
            onSubmit={submitStep}
          />
          {stepRules.length > 0 && (
            <div className="w-full text-xs text-text-muted text-center">
              Hint: this step uses{' '}
              <span className="text-white font-semibold">
                {stepRules.map((r) => r.rule.name).join(' + ')}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={submitStep}
            disabled={answer.trim() === ''}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] disabled:opacity-40"
          >
            Check this step
          </button>
          <button
            onClick={redoCurrent}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-semibold text-base rounded-btn px-4 py-3"
          >
            Redo this question
          </button>
          <button
            onClick={goToNextAttempt}
            className="w-full text-text-muted text-sm py-2 hover:text-white"
          >
            Skip
          </button>
        </div>
      </div>
    )
  }

  // ---- STEP FEEDBACK ----
  if (phase === 'step-feedback') {
    const running = computeRunning(numbers, stepIndex - 1)
    const next = numbers[stepIndex]
    const expected = running + next
    const correct = stepWasCorrect
    const opSymbol = next < 0 ? '−' : '+'

    const phrase = correct
      ? pickPhrase(CORRECT_PHRASES, index * 7 + stepIndex)
      : pickPhrase(ENCOURAGE_PHRASES, index * 7 + stepIndex)

    return (
      <div className="h-full overflow-y-auto flex flex-col px-5 py-6 max-w-md mx-auto w-full">
        <Header
          index={index}
          total={totalAttempts}
          onExit={onExit}
          subtitle={`Step ${stepIndex}`}
        />

        <div className="flex-1 flex flex-col items-center justify-center gap-4 my-4">
          <div
            className={`text-7xl font-black ${
              correct ? 'text-level-green' : 'text-quest-red'
            }`}
          >
            {correct ? '✓' : '✗'}
          </div>
          <div
            className={`text-2xl font-bold ${
              correct ? 'text-level-green' : 'text-baxi-blue'
            }`}
          >
            {phrase}
          </div>
          <div className="text-2xl font-mono font-bold tabular-nums text-center">
            {running} {opSymbol} {Math.abs(next)} = {expected}
          </div>
          {!correct && stepUserValue != null && (
            <div className="text-sm text-text-muted">
              You said{' '}
              <span className="text-white font-bold tabular-nums">
                {stepUserValue}
              </span>
              . The right answer is{' '}
              <span className="text-white font-bold tabular-nums">
                {expected}
              </span>
              .
            </div>
          )}

          {stepRules.length > 0 && (
            <div className="w-full rounded-card bg-bg-navy border border-card-border p-4 text-left">
              <div className="text-xs uppercase tracking-wider text-magic-gold mb-2 font-bold">
                On the abacus
              </div>
              {stepRules.map((r, i) => (
                <div
                  key={`${r.rod}-${i}`}
                  className={i > 0 ? 'mt-3 pt-3 border-t border-card-border' : ''}
                >
                  <div className="text-sm font-semibold text-white">
                    {capitalize(r.rod)} rod: {r.rule.name}
                  </div>
                  <div className="text-sm text-baxi-blue italic mt-1">
                    "{r.rule.beadMovement.callout}"
                  </div>
                  <ul className="text-xs text-white/80 mt-2 list-disc pl-5 leading-snug">
                    {r.rule.beadMovement.steps.map((s, j) => (
                      <li key={j}>{s}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={continueAfterStep}
            className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99]"
          >
            {stepIndex >= numbers.length - 1
              ? 'Done — next question'
              : 'Continue to next step'}
          </button>
          <button
            onClick={redoCurrent}
            className="w-full min-h-touch bg-card-surface text-white border border-card-border font-semibold text-base rounded-btn px-4 py-3"
          >
            Redo this question
          </button>
        </div>
      </div>
    )
  }

  return null
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function Header({
  index,
  total,
  onExit,
  subtitle,
}: {
  index: number
  total: number
  onExit: () => void
  subtitle?: string
}) {
  return (
    <div className="flex items-center justify-between mb-2 shrink-0">
      <div>
        <div className="text-xs text-magic-gold font-bold uppercase tracking-wider">
          Get Better Mode
        </div>
        <div className="text-sm text-text-muted">
          Question {index + 1} of {total}
          {subtitle && <span> · {subtitle}</span>}
        </div>
      </div>
      <button
        onClick={onExit}
        className="text-text-muted text-xs border border-card-border rounded-pill px-3 py-1 hover:text-white hover:border-white"
      >
        Exit
      </button>
    </div>
  )
}
