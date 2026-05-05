import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import {
  buildUserKey,
  recordCellAnswer,
  recordCellAttemptStart,
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
  | 'stats'
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
  // Rolling window of elapsed times for the current consecutive-correct
  // streak. Resets on a wrong answer. When this reaches 3, we have a
  // "3-in-a-row" sample that may update bestThreeInARowAvgMs at the cell.
  streakCorrectMs: number[]
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
  // True while the child is replaying a previously-cleared cell from the
  // scorecard. Auto-leveling is suppressed in this mode so progress is
  // preserved (they can't accidentally bump their currentNumberCount up
  // by getting 3-in-a-row at a level they already cleared).
  inRedo: boolean
}

const INITIAL_STATE: GameState = {
  screen: 'login',
  name: '',
  userRecord: null,
  digitType: null,
  currentNumberCount: GAME_CONFIG.startNumberCount,
  consecutiveCorrect: 0,
  streakCorrectMs: [],
  questionInRound: 0,
  correctInRound: 0,
  question: null,
  feedback: null,
  levelExtraTimeSeconds: 0,
  levelNoTimer: false,
  wrongAttemptsThisRound: [],
  leveledUpThisRound: false,
  inRedo: false,
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
          cellStats: {},
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
        streakCorrectMs: [],
        questionInRound: 0,
        correctInRound: 0,
        question: null,
        feedback: null,
        levelExtraTimeSeconds: 0,
        levelNoTimer: false,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        inRedo: false,
        screen: 'level-start',
      }
    })
  }, [])

  // Commit the timer choice from the level-start screen and start the round.
  const confirmLevelStart = useCallback(
    (extraSeconds: number, noTimer: boolean) => {
      let pendingAttempt: {
        rec: UserRecord
        digitType: DigitType
        numberCount: number
      } | null = null
      setState((s) => {
        if (!s.digitType) return s
        const question = generateQuestion(s.digitType, s.currentNumberCount)
        if (s.userRecord) {
          pendingAttempt = {
            rec: s.userRecord,
            digitType: s.digitType,
            numberCount: s.currentNumberCount,
          }
        }
        return {
          ...s,
          levelExtraTimeSeconds: extraSeconds,
          levelNoTimer: noTimer,
          consecutiveCorrect: 0,
          streakCorrectMs: [],
          questionInRound: 1,
          correctInRound: 0,
          question,
          feedback: null,
          wrongAttemptsThisRound: [],
          leveledUpThisRound: false,
          screen: 'question',
        }
      })
      if (pendingAttempt) {
        const a: {
          rec: UserRecord
          digitType: DigitType
          numberCount: number
        } = pendingAttempt
        void recordCellAttemptStart(a.rec, a.digitType, a.numberCount).then(
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

  // After a level-up round summary, "Next level" sends the child back to the
  // level-start screen so they can re-pick timer options for the new level.
  const startNextLevel = useCallback(() => {
    setState((s) => {
      if (!s.digitType) return s
      return {
        ...s,
        consecutiveCorrect: 0,
        streakCorrectMs: [],
        questionInRound: 0,
        correctInRound: 0,
        question: null,
        feedback: null,
        levelExtraTimeSeconds: 0,
        levelNoTimer: false,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        inRedo: false,
        screen: 'level-start',
      }
    })
  }, [])

  // `elapsedMs` is wall-clock time the child spent on this question. Drives
  // the per-cell stats (correct/wrong counts, top-10 fastest, best 3-in-a-row
  // avg, last-10 buffer). Pass null only when the elapsed time is genuinely
  // unknown — every real submit/timeout should pass a number.
  const submitAnswer = useCallback(
    (userAnswer: number | null, elapsedMs: number | null = null) => {
    // Captured inside the updater so the outer post-setState side effect can
    // fire exactly once even under React strict-mode's double-invocation.
    let pendingPersist: {
      rec: UserRecord
      digitType: DigitType
      numberCount: number
      elapsedMs: number
      correct: boolean
      threeInARowAvgMs?: number
      triggeredLevelUp: boolean
    } | null = null
    setState((s) => {
      if (!s.question || !s.digitType) return s
      // Capture digit type + number count BEFORE potentially leveling up so
      // stats are recorded against the cell the question was actually asked
      // at, not the next one.
      const statDigitType = s.digitType
      const statNumberCount = s.currentNumberCount
      const isCorrect = userAnswer != null && userAnswer === s.question.answer

      // Roll the per-streak elapsed buffer in lockstep with consecutiveCorrect
      // so we can emit a 3-in-a-row sample at the same moment the streak
      // counter resets.
      let nextStreakMs = isCorrect && elapsedMs != null
        ? [...s.streakCorrectMs, elapsedMs]
        : []
      if (nextStreakMs.length > GAME_CONFIG.correctInARowNeeded) {
        nextStreakMs = nextStreakMs.slice(-GAME_CONFIG.correctInARowNeeded)
      }

      let consecutiveCorrect = isCorrect ? s.consecutiveCorrect + 1 : 0
      let currentNumberCount = s.currentNumberCount
      let leveledUp = false
      let newNumberCount: number | undefined
      let threeInARowAvgMs: number | undefined

      const hitThreeInARow =
        isCorrect && consecutiveCorrect >= GAME_CONFIG.correctInARowNeeded
      if (hitThreeInARow && nextStreakMs.length === 3) {
        threeInARowAvgMs =
          (nextStreakMs[0] + nextStreakMs[1] + nextStreakMs[2]) / 3
      }
      if (
        hitThreeInARow &&
        !s.inRedo &&
        currentNumberCount < GAME_CONFIG.maxNumberCount
      ) {
        consecutiveCorrect = 0
        currentNumberCount = currentNumberCount + 1
        leveledUp = true
        newNumberCount = currentNumberCount
        nextStreakMs = []
      } else if (hitThreeInARow) {
        // Either we're at the digit cap, or we're in redo mode at a cell the
        // child already cleared. Either way: reset the streak so subsequent
        // 3-in-a-rows count as separate samples, but don't advance.
        consecutiveCorrect = 0
        nextStreakMs = []
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
        pendingPersist = {
          rec: s.userRecord,
          digitType: statDigitType,
          numberCount: statNumberCount,
          elapsedMs,
          correct: isCorrect,
          threeInARowAvgMs,
          triggeredLevelUp: leveledUp,
        }
      }

      return {
        ...s,
        consecutiveCorrect,
        streakCorrectMs: nextStreakMs,
        currentNumberCount,
        correctInRound,
        wrongAttemptsThisRound,
        leveledUpThisRound,
        feedback,
      }
    })
    if (pendingPersist) {
      const r: {
        rec: UserRecord
        digitType: DigitType
        numberCount: number
        elapsedMs: number
        correct: boolean
        threeInARowAvgMs?: number
        triggeredLevelUp: boolean
      } = pendingPersist
      void recordCellAnswer(r.rec, r.digitType, r.numberCount, {
        correct: r.correct,
        elapsedMs: r.elapsedMs,
        threeInARowAvgMs: r.threeInARowAvgMs,
        triggeredLevelUp: r.triggeredLevelUp,
      }).then((updated) => {
        setState((cur) =>
          cur.userRecord?.userKey === updated.userKey
            ? { ...cur, userRecord: updated }
            : cur,
        )
      })
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
    let pendingAttempt: {
      rec: UserRecord
      digitType: DigitType
      numberCount: number
    } | null = null
    setState((s) => {
      if (!s.digitType) return s
      const nextQuestion = generateQuestion(s.digitType, s.currentNumberCount)
      if (s.userRecord) {
        pendingAttempt = {
          rec: s.userRecord,
          digitType: s.digitType,
          numberCount: s.currentNumberCount,
        }
      }
      return {
        ...s,
        consecutiveCorrect: 0,
        streakCorrectMs: [],
        questionInRound: 1,
        correctInRound: 0,
        question: nextQuestion,
        feedback: null,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        screen: 'question',
      }
    })
    if (pendingAttempt) {
      const a: {
        rec: UserRecord
        digitType: DigitType
        numberCount: number
      } = pendingAttempt
      void recordCellAttemptStart(a.rec, a.digitType, a.numberCount).then(
        (updated) => {
          setState((cur) =>
            cur.userRecord?.userKey === updated.userKey
              ? { ...cur, userRecord: updated }
              : cur,
          )
        },
      )
    }
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

  const showStats = useCallback(() => {
    setState((s) => ({ ...s, screen: 'stats' }))
  }, [])

  const hideStats = useCallback(() => {
    setState((s) => ({ ...s, screen: 'mode-select' }))
  }, [])

  // Replays a previously-cleared cell so the child can improve their avg
  // time. inRedo flips on so submitAnswer suppresses the level-up branch —
  // the child's overall progress (UserRecord.progress[digitType]) is left
  // untouched. The cell's stats (avg, top-10, attempts) still update.
  const redoLevel = useCallback(
    (digitType: DigitType, numberCount: number) => {
      setState((s) => ({
        ...s,
        digitType,
        currentNumberCount: numberCount,
        consecutiveCorrect: 0,
        streakCorrectMs: [],
        questionInRound: 0,
        correctInRound: 0,
        question: null,
        feedback: null,
        levelExtraTimeSeconds: 0,
        levelNoTimer: false,
        wrongAttemptsThisRound: [],
        leveledUpThisRound: false,
        inRedo: true,
        screen: 'level-start',
      }))
    },
    [],
  )

  const changeDigitLevel = useCallback(() => {
    setState((s) => ({
      ...s,
      digitType: null,
      currentNumberCount: GAME_CONFIG.startNumberCount,
      consecutiveCorrect: 0,
      streakCorrectMs: [],
      questionInRound: 0,
      correctInRound: 0,
      question: null,
      feedback: null,
      levelExtraTimeSeconds: 0,
      levelNoTimer: false,
      wrongAttemptsThisRound: [],
      leveledUpThisRound: false,
      inRedo: false,
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
      showStats,
      hideStats,
      redoLevel,
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
      showStats,
      hideStats,
      redoLevel,
      logout,
    ],
  )

  return { state, actions }
}
