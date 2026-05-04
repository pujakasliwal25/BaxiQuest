import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import {
  buildUserKey,
  recordUser,
  saveProgress,
  type UserRecord,
} from '../services/progressStore'
import {
  type DigitType,
  type Question,
  generateQuestion,
} from '../utils/questionGenerator'

export type Screen =
  | 'login'
  | 'mode-select'
  | 'level-info'
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
  pendingLevelExample: Question | null
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
  pendingLevelExample: null,
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
    async (classCode: string, name: string): Promise<boolean> => {
      const normalized = classCode.trim().toUpperCase()
      const valid = GAME_CONFIG.validClassCodes
        .map((c) => c.toUpperCase())
        .includes(normalized)
      if (!valid) return false

      const trimmedName = name.trim()
      const userKey = buildUserKey(normalized, trimmedName)

      let userRecord: UserRecord
      try {
        userRecord = await recordUser(userKey, trimmedName, normalized)
      } catch (err) {
        console.warn('[useGameState] login persistence failed:', err)
        userRecord = {
          userKey,
          name: trimmedName,
          classCode: normalized,
          progress: {},
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

  const startGame = useCallback((digitType: DigitType) => {
    setState((s) => {
      const numberCount = startCountFor(s.userRecord, digitType)
      const question = generateQuestion(digitType, numberCount)
      return {
        ...s,
        digitType,
        currentNumberCount: numberCount,
        consecutiveCorrect: 0,
        questionInRound: 1,
        correctInRound: 0,
        question,
        feedback: null,
        pendingLevelExample: null,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        screen: 'question',
      }
    })
  }, [])

  const submitAnswer = useCallback((userAnswer: number | null) => {
    setState((s) => {
      if (!s.question || !s.digitType) return s
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
  }, [])

  const advanceAfterFeedback = useCallback(() => {
    clearFeedbackTimer()
    setState((s) => {
      if (!s.digitType) return s

      const justLeveledUp = s.feedback?.leveledUp === true
      const finishedRound = s.questionInRound >= GAME_CONFIG.questionsPerRound

      if (finishedRound) {
        return {
          ...s,
          feedback: null,
          screen: 'round-summary',
        }
      }

      if (justLeveledUp) {
        const example = generateQuestion(s.digitType, s.currentNumberCount)
        return {
          ...s,
          feedback: null,
          pendingLevelExample: example,
          screen: 'level-info',
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

  const continueFromLevelInfo = useCallback(() => {
    setState((s) => {
      if (!s.digitType) return s
      const nextQuestion = generateQuestion(s.digitType, s.currentNumberCount)
      return {
        ...s,
        pendingLevelExample: null,
        question: nextQuestion,
        questionInRound: s.questionInRound + 1,
        screen: 'question',
      }
    })
  }, [])

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
    setState((s) => ({
      ...s,
      digitType: null,
      currentNumberCount: GAME_CONFIG.startNumberCount,
      consecutiveCorrect: 0,
      questionInRound: 0,
      correctInRound: 0,
      question: null,
      feedback: null,
      pendingLevelExample: null,
      wrongAttemptsThisRound: [],
      leveledUpThisRound: false,
      screen: 'mode-select',
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
      pendingLevelExample: null,
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
      submitAnswer,
      scheduleAdvance,
      advanceAfterFeedback,
      continueFromLevelInfo,
      playAgain,
      enterGetBetterMode,
      exitGetBetterMode,
      changeDigitLevel,
      logout,
    }),
    [
      login,
      startGame,
      submitAnswer,
      scheduleAdvance,
      advanceAfterFeedback,
      continueFromLevelInfo,
      playAgain,
      enterGetBetterMode,
      exitGetBetterMode,
      changeDigitLevel,
      logout,
    ],
  )

  return { state, actions }
}
