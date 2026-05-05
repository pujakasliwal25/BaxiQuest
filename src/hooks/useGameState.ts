import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import {
  buildUserKey,
  recordTime,
  recordUser,
  saveProgress,
  type UserRecord,
} from '../services/progressStore'
import type { CurriculumLevel } from '../utils/curriculumLevel'
import {
  type DigitType,
  type Question,
  generateQuestion,
} from '../utils/questionGenerator'

export type Screen =
  | 'login'
  | 'mode-select'
  | 'level-start'
  | 'question'
  | 'round-summary'
  | 'get-better'

export interface FeedbackState {
  kind: 'correct' | 'wrong'
  correctAnswer: number
  streak: number
  leveledUp: boolean
  newNumberCount?: number
}

export interface WrongAttempt {
  question: Question
  userAnswer: number | null
}

export interface GameState {
  screen: Screen
  name: string
  userRecord: UserRecord | null
  digitType: DigitType | null
  currentNumberCount: number
  consecutiveCorrect: number
  questionInRound: number
  correctInRound: number
  question: Question | null
  feedback: FeedbackState | null
  // Per-level timer settings, chosen on the level-start screen and applied to
  // every question of that level. Reset on each new level (initial pick OR
  // level-up).
  levelExtraTimeSeconds: number
  levelNoTimer: boolean
  // Set of wrong attempts within the current round; used to feed Get Better Mode.
  wrongAttemptsThisRound: WrongAttempt[]
  // Whether the child reached a new level during the current round.
  leveledUpThisRound: boolean
}

const INITIAL_STATE: GameState = {
  screen: 'login',
  name: '',
  userRecord: null,
  digitType: null,
  currentNumberCount: GAME_CONFIG.startNumberCount,
  consecutiveCorrect: 0,
  questionInRound: 0,
  correctInRound: 0,
  question: null,
  feedback: null,
  levelExtraTimeSeconds: 0,
  levelNoTimer: false,
  wrongAttemptsThisRound: [],
  leveledUpThisRound: false,
}

function startCountFor(rec: UserRecord | null, dt: DigitType): number {
  const stored = rec?.progress[dt] ?? 0
  return Math.max(GAME_CONFIG.startNumberCount, stored)
}

export function useGameState() {
  const [state, setState] = useState<GameState>(INITIAL_STATE)
  const feedbackTimerRef = useRef<number | null>(null)

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current != null) {
      window.clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
  }

  const login = useCallback(
    async (
      classCode: string,
      name: string,
      curriculumLevel: CurriculumLevel,
    ): Promise<boolean> => {
      const normalized = classCode.trim().toUpperCase()
      const valid = GAME_CONFIG.validClassCodes
        .map((c) => c.toUpperCase())
        .includes(normalized)
      if (!valid) return false

      const trimmedName = name.trim()
      const userKey = buildUserKey(normalized, trimmedName)

      let userRecord: UserRecord
      try {
        userRecord = await recordUser(
          userKey,
          trimmedName,
          normalized,
          curriculumLevel,
        )
      } catch (err) {
        console.warn('[useGameState] login persistence failed:', err)
        userRecord = {
          userKey,
          name: trimmedName,
          classCode: normalized,
          curriculumLevel,
          progress: {},
          timeStats: {},
        }
      }

      setState((s) => ({
        ...s,
        name: trimmedName,
        userRecord,
        screen: 'mode-select',
      }))
      return true
    },
    [],
  )

  // Picking a digit type lands on the level-start screen so the child can
  // choose timer options before the first question. The level state (number
  // count, streak, round counters) is initialized here so confirmLevelStart
  // only needs to commit the timer choice and generate the first question.
  const startGame = useCallback((digitType: DigitType) => {
    setState((s) => {
      const numberCount = startCountFor(s.userRecord, digitType)
      return {
        ...s,
        digitType,
        currentNumberCount: numberCount,
        consecutiveCorrect: 0,
        questionInRound: 0,
        correctInRound: 0,
        question: null,
        feedback: null,
        levelExtraTimeSeconds: 0,
        levelNoTimer: false,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        screen: 'level-start',
      }
    })
  }, [])

  // Commit the timer choice from the level-start screen and start the round.
  const confirmLevelStart = useCallback(
    (extraSeconds: number, noTimer: boolean) => {
      setState((s) => {
        if (!s.digitType) return s
        const question = generateQuestion(s.digitType, s.currentNumberCount)
        return {
          ...s,
          levelExtraTimeSeconds: extraSeconds,
          levelNoTimer: noTimer,
          questionInRound: 1,
          correctInRound: 0,
          question,
          feedback: null,
          wrongAttemptsThisRound: [],
          leveledUpThisRound: false,
          screen: 'question',
        }
      })
    },
    [],
  )

  // After a level-up round summary, "Next level" sends the child back to the
  // level-start screen so they can re-pick timer options for the new level.
  const startNextLevel = useCallback(() => {
    setState((s) => {
      if (!s.digitType) return s
      return {
        ...s,
        questionInRound: 0,
        correctInRound: 0,
        question: null,
        feedback: null,
        levelExtraTimeSeconds: 0,
        levelNoTimer: false,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        screen: 'level-start',
      }
    })
  }, [])

  // `elapsedMs` is wall-clock time the child spent on this question. Used to
  // build a per-(digitType, numberCount) average displayed on Mode Select.
  // Pass null when the elapsed time is unreliable (e.g., a programmatic
  // timeout where the child wasn't actively engaged).
  const submitAnswer = useCallback(
    (userAnswer: number | null, elapsedMs: number | null = null) => {
    // Captured inside the updater so the outer post-setState side effect can
    // fire exactly once even under React strict-mode's double-invocation.
    let timeStatRecord: {
      rec: UserRecord
      digitType: DigitType
      numberCount: number
      elapsedMs: number
    } | null = null
    setState((s) => {
      if (!s.question || !s.digitType) return s
      // Capture digit type + number count BEFORE potentially leveling up so
      // we record the stat against the level the question was actually asked
      // at, not the new level.
      const statDigitType = s.digitType
      const statNumberCount = s.currentNumberCount
      const isCorrect = userAnswer != null && userAnswer === s.question.answer
      let consecutiveCorrect = isCorrect ? s.consecutiveCorrect + 1 : 0
      let currentNumberCount = s.currentNumberCount
      let leveledUp = false
      let newNumberCount: number | undefined

      if (
        isCorrect &&
        consecutiveCorrect >= GAME_CONFIG.correctInARowNeeded &&
        currentNumberCount < GAME_CONFIG.maxNumberCount
      ) {
        consecutiveCorrect = 0
        currentNumberCount = currentNumberCount + 1
        leveledUp = true
        newNumberCount = currentNumberCount
      } else if (
        isCorrect &&
        consecutiveCorrect >= GAME_CONFIG.correctInARowNeeded &&
        currentNumberCount >= GAME_CONFIG.maxNumberCount
      ) {
        // Cap reached: keep streak rolling without resetting (already at max).
        consecutiveCorrect = 0
      }

      const correctInRound = isCorrect ? s.correctInRound + 1 : s.correctInRound

      const wrongAttemptsThisRound = isCorrect
        ? s.wrongAttemptsThisRound
        : [
            ...s.wrongAttemptsThisRound,
            { question: s.question, userAnswer },
          ]

      const leveledUpThisRound = leveledUp || s.leveledUpThisRound

      const feedback: FeedbackState = {
        kind: isCorrect ? 'correct' : 'wrong',
        correctAnswer: s.question.answer,
        streak: consecutiveCorrect,
        leveledUp,
        newNumberCount,
      }

      if (elapsedMs != null && s.userRecord) {
        timeStatRecord = {
          rec: s.userRecord,
          digitType: statDigitType,
          numberCount: statNumberCount,
          elapsedMs,
        }
      }

      return {
        ...s,
        consecutiveCorrect,
        currentNumberCount,
        correctInRound,
        wrongAttemptsThisRound,
        leveledUpThisRound,
        feedback,
      }
    })
    if (timeStatRecord) {
      const r: {
        rec: UserRecord
        digitType: DigitType
        numberCount: number
        elapsedMs: number
      } = timeStatRecord
      void recordTime(r.rec, r.digitType, r.numberCount, r.elapsedMs).then(
        (updated) => {
          setState((cur) =>
            cur.userRecord?.userKey === updated.userKey
              ? { ...cur, userRecord: updated }
              : cur,
          )
        },
      )
    }
  },
  [],
  )

  const advanceAfterFeedback = useCallback(() => {
    clearFeedbackTimer()
    setState((s) => {
      if (!s.digitType) return s

      const justLeveledUp = s.feedback?.leveledUp === true
      const finishedRound = s.questionInRound >= GAME_CONFIG.questionsPerRound

      // Level-up ends the current round immediately, no matter where we are
      // in it. The wrongs we collected belong to the OLD level — round-summary
      // offers Get Better Mode for them, then "Next level" starts a fresh
      // round at the new number count.
      if (justLeveledUp || finishedRound) {
        return {
          ...s,
          feedback: null,
          screen: 'round-summary',
        }
      }

      const nextQuestion = generateQuestion(s.digitType, s.currentNumberCount)
      return {
        ...s,
        feedback: null,
        question: nextQuestion,
        questionInRound: s.questionInRound + 1,
      }
    })
  }, [])

  const scheduleAdvance = useCallback(
    (ms: number) => {
      clearFeedbackTimer()
      feedbackTimerRef.current = window.setTimeout(() => {
        advanceAfterFeedback()
      }, ms)
    },
    [advanceAfterFeedback],
  )

  const playAgain = useCallback(() => {
    setState((s) => {
      if (!s.digitType) return s
      const nextQuestion = generateQuestion(s.digitType, s.currentNumberCount)
      return {
        ...s,
        questionInRound: 1,
        correctInRound: 0,
        question: nextQuestion,
        feedback: null,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        screen: 'question',
      }
    })
  }, [])

  const enterGetBetterMode = useCallback(() => {
    setState((s) =>
      s.wrongAttemptsThisRound.length === 0
        ? s
        : { ...s, screen: 'get-better' },
    )
  }, [])

  const exitGetBetterMode = useCallback(() => {
    // After review, return to round-summary so the child can pick "Next level"
    // or "Change Digit Level". Preserves wrongs so they can revisit if they
    // want; round-summary buttons (playAgain / startNextLevel / changeDigit)
    // do the appropriate cleanup when the child commits to a next step.
    setState((s) => ({
      ...s,
      screen: s.digitType ? 'round-summary' : 'mode-select',
    }))
  }, [])

  const changeDigitLevel = useCallback(() => {
    setState((s) => ({
      ...s,
      digitType: null,
      currentNumberCount: GAME_CONFIG.startNumberCount,
      consecutiveCorrect: 0,
      questionInRound: 0,
      correctInRound: 0,
      question: null,
      feedback: null,
      levelExtraTimeSeconds: 0,
      levelNoTimer: false,
      wrongAttemptsThisRound: [],
      leveledUpThisRound: false,
      screen: 'mode-select',
    }))
  }, [])

  const logout = useCallback(() => {
    clearFeedbackTimer()
    setState(INITIAL_STATE)
  }, [])

  // Persist progress whenever the child reaches a new high in the current digit
  // type. Runs after the level-up state is committed.
  useEffect(() => {
    const rec = state.userRecord
    const dt = state.digitType
    if (!rec || !dt) return
    const stored = rec.progress[dt] ?? 0
    if (state.currentNumberCount <= stored) return

    saveProgress(rec, dt, state.currentNumberCount).then((updated) => {
      setState((s) =>
        s.userRecord?.userKey === updated.userKey
          ? { ...s, userRecord: updated }
          : s,
      )
    })
  }, [state.userRecord, state.digitType, state.currentNumberCount])

  const actions = useMemo(
    () => ({
      login,
      startGame,
      confirmLevelStart,
      startNextLevel,
      submitAnswer,
      scheduleAdvance,
      advanceAfterFeedback,
      playAgain,
      enterGetBetterMode,
      exitGetBetterMode,
      changeDigitLevel,
      logout,
    }),
    [
      login,
      startGame,
      confirmLevelStart,
      startNextLevel,
      submitAnswer,
      scheduleAdvance,
      advanceAfterFeedback,
      playAgain,
      enterGetBetterMode,
      exitGetBetterMode,
      changeDigitLevel,
      logout,
    ],
  )

  return { state, actions }
}
