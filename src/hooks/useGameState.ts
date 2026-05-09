import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GAME_CONFIG } from '../config/gameConfig'
import {
  buildEntry,
  recordLeaderboardEntry,
} from '../services/leaderboardStore'
import {
  addCoins,
  buildUserKey,
  cellKey,
  clearLastUser,
  getLastUser,
  loadUserRecord,
  recordCellAnswer,
  recordCellAttemptStart,
  recordUser,
  saveProgress,
  setLastUser,
  type UserRecord,
} from '../services/progressStore'
import { type CoinPayout, computeCoinPayout } from '../utils/coins'
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
  | 'redo-complete'
  | 'get-better'
  | 'admin'

export interface FeedbackState {
  kind: 'correct' | 'wrong'
  correctAnswer: number
  streak: number
  leveledUp: boolean
  newNumberCount?: number
  // Coin payout for the answer that just produced this feedback. UI uses
  // it to drive the floating "+N coins!" caption and the streak burst.
  coins: CoinPayout
  // Monotonically incremented each time feedback is set so animations can
  // re-fire when the same payout shape repeats.
  tick: number
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
  // Coins earned just within the current round. Round-summary surfaces
  // this as "Earned X coins this round". Resets on every round start.
  coinsThisRound: number
  // True while the child is replaying a previously-cleared cell from the
  // scorecard. Auto-leveling is suppressed in this mode so progress is
  // preserved (they can't accidentally bump their currentNumberCount up
  // by getting 3-in-a-row at a level they already cleared).
  inRedo: boolean
  // Set when a redo run produces a 3-in-a-row. Drives the redo-complete
  // celebration screen and ends the round early. Cleared when the child
  // exits or starts a new redo.
  redoCompletion: {
    avgMs: number
    // The previous best at this cell *before* this run. Lets the
    // celebration screen show "X faster than your last best" or
    // "🎉 new best!" when applicable.
    previousBestMs: number | null
    digitType: DigitType
    numberCount: number
  } | null
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
  coinsThisRound: 0,
  inRedo: false,
  redoCompletion: null,
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
    ): Promise<'admin' | 'student' | null> => {
      const normalized = classCode.trim().toUpperCase()
      const isAdminCode = GAME_CONFIG.adminClassCodes
        .map((c) => c.toUpperCase())
        .includes(normalized)
      if (isAdminCode) {
        // Admin sign-in skips the user-record flow — admins don't have
        // their own stats or progress. We just route to the admin screen.
        const adminName = name.trim() || 'Admin'
        setLastUser({
          userKey: `admin:${normalized}`,
          role: 'admin',
          name: adminName,
          classCode: normalized,
        })
        setState((s) => ({
          ...s,
          name: adminName,
          screen: 'admin',
        }))
        return 'admin'
      }
      const valid = GAME_CONFIG.validClassCodes
        .map((c) => c.toUpperCase())
        .includes(normalized)
      if (!valid) return null

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
          coins: 0,
        }
      }

      setLastUser({
        userKey,
        role: 'student',
        name: trimmedName,
        classCode: normalized,
      })
      setState((s) => ({
        ...s,
        name: trimmedName,
        userRecord,
        screen: 'mode-select',
      }))
      return 'student'
    },
    [],
  )

  // Tries to rehydrate a previous session from localStorage so the child
  // (or admin) doesn't have to re-enter their class code on every reload.
  // Returns the role that was restored, or null if there's nothing to
  // restore. Idempotent — safe to call multiple times.
  const restoreSession = useCallback(async (): Promise<
    'student' | 'admin' | null
  > => {
    const last = getLastUser()
    if (!last) return null
    if (last.role === 'admin') {
      setState((s) => ({
        ...s,
        name: last.name || 'Admin',
        screen: 'admin',
      }))
      return 'admin'
    }
    const rec = await loadUserRecord(last.userKey)
    if (!rec) {
      // Stored pointer references a record we can't find anywhere — clear
      // it so we don't loop on every load.
      clearLastUser()
      return null
    }
    setState((s) => ({
      ...s,
      name: rec.name,
      userRecord: rec,
      screen: 'mode-select',
    }))
    return 'student'
  }, [])

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
      coinsThisRound: 0,
        inRedo: false,
        redoCompletion: null,
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
      coinsThisRound: 0,
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
      coinsThisRound: 0,
        inRedo: false,
        redoCompletion: null,
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
      coinsAwarded: number
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

      // Coin payout for this answer. Wrong answers/timeouts pay 0; correct
      // answers earn (base + speed-decayed bonus) × timer multiplier, with
      // a fixed bonus on top whenever this answer just completed a
      // 3-in-a-row.
      const payout =
        elapsedMs != null
          ? computeCoinPayout({
              correct: isCorrect,
              elapsedMs,
              baseTimerSeconds: s.question.timerSeconds,
              levelExtraSeconds: s.levelExtraTimeSeconds,
              levelNoTimer: s.levelNoTimer,
              threeInARow: hitThreeInARow,
            })
          : { total: 0, perCorrect: 0, streakBonus: 0 }

      const feedback: FeedbackState = {
        kind: isCorrect ? 'correct' : 'wrong',
        correctAnswer: s.question.answer,
        streak: consecutiveCorrect,
        leveledUp,
        newNumberCount,
        coins: payout,
        tick: (s.feedback?.tick ?? 0) + 1,
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
          coinsAwarded: payout.total,
        }
      }

      // Redo mode: a 3-in-a-row signals the child has succeeded at this
      // run. Capture the avg + their previous best so the celebration
      // screen can compare them, and end the round on the next advance.
      let redoCompletion = s.redoCompletion
      if (
        hitThreeInARow &&
        s.inRedo &&
        threeInARowAvgMs != null &&
        s.userRecord
      ) {
        const cell =
          s.userRecord.cellStats[cellKey(statDigitType, statNumberCount)]
        redoCompletion = {
          avgMs: threeInARowAvgMs,
          previousBestMs: cell?.bestThreeInARowAvgMs ?? null,
          digitType: statDigitType,
          numberCount: statNumberCount,
        }
      }

      // Optimistic coin bump on the userRecord so the UI counter ticks up
      // immediately. The async addCoins() call below will land on the same
      // value (it uses the pre-bump rec captured in pendingPersist.rec, not
      // this optimistic one) so there's no double-counting.
      const userRecord =
        payout.total > 0 && s.userRecord
          ? { ...s.userRecord, coins: s.userRecord.coins + payout.total }
          : s.userRecord

      return {
        ...s,
        consecutiveCorrect,
        streakCorrectMs: nextStreakMs,
        currentNumberCount,
        correctInRound,
        wrongAttemptsThisRound,
        leveledUpThisRound,
        coinsThisRound: s.coinsThisRound + payout.total,
        feedback,
        redoCompletion,
        userRecord,
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
        coinsAwarded: number
      } = pendingPersist
      const cellId = cellKey(r.digitType, r.numberCount)
      const prevBest =
        r.rec.cellStats[cellId]?.bestThreeInARowAvgMs ?? null
      void recordCellAnswer(r.rec, r.digitType, r.numberCount, {
        correct: r.correct,
        elapsedMs: r.elapsedMs,
        threeInARowAvgMs: r.threeInARowAvgMs,
        triggeredLevelUp: r.triggeredLevelUp,
      })
        .then(async (afterCells) => {
          // Layer the coin total on top of the cell-stats write. addCoins
          // returns the same record with the coin bump applied; if there
          // were no coins to award (wrong answer / timeout) it short-
          // circuits and just returns the record unchanged.
          const updated =
            r.coinsAwarded > 0
              ? await addCoins(afterCells, r.coinsAwarded)
              : afterCells
          setState((cur) =>
            cur.userRecord?.userKey === updated.userKey
              ? { ...cur, userRecord: updated }
              : cur,
          )
          const newBest =
            updated.cellStats[cellId]?.bestThreeInARowAvgMs ?? null
          if (newBest != null && (prevBest == null || newBest < prevBest)) {
            void recordLeaderboardEntry(
              buildEntry({
                digitType: r.digitType,
                numberCount: r.numberCount,
                userKey: updated.userKey,
                name: updated.name,
                curriculumLevel: updated.curriculumLevel,
                avgMs: newBest,
              }),
            )
          }
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

      // Redo run with a 3-in-a-row: end the round on the celebration screen.
      // No round-summary, no Get Better Mode — the run "ends" the moment the
      // child hits their goal.
      if (s.inRedo && s.redoCompletion != null) {
        return {
          ...s,
          feedback: null,
          screen: 'redo-complete',
        }
      }

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
      coinsThisRound: 0,
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

  // Replays a cell from the scorecard. Two flavors based on the cell's
  // cleared state:
  //   • Cleared → inRedo=true. Auto-leveling is suppressed so the child's
  //     progress isn't bumped by getting 3-in-a-row at a level they already
  //     passed. Stats (avg, top-10, attempts) still update.
  //   • Not yet cleared (their current frontier) → inRedo=false. Normal
  //     play; getting 3-in-a-row clears it and advances them.
  const redoLevel = useCallback(
    (digitType: DigitType, numberCount: number) => {
      setState((s) => {
        const wasCleared =
          s.userRecord?.cellStats[cellKey(digitType, numberCount)]?.cleared ??
          false
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
      coinsThisRound: 0,
          inRedo: wasCleared,
          redoCompletion: null,
          screen: 'level-start',
        }
      })
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
      coinsThisRound: 0,
      inRedo: false,
      redoCompletion: null,
      screen: 'mode-select',
    }))
  }, [])

  const logout = useCallback(() => {
    clearFeedbackTimer()
    clearLastUser()
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
      restoreSession,
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
      restoreSession,
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
