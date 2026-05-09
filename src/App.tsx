import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { FeedbackOverlay } from './components/FeedbackOverlay'
import { useGameState } from './hooks/useGameState'
import { AdminScreen } from './screens/AdminScreen'
import { GetBetterScreen } from './screens/GetBetterScreen'
import { LevelStartScreen } from './screens/LevelStartScreen'
import { LoginScreen } from './screens/LoginScreen'
import { ModeSelectScreen } from './screens/ModeSelectScreen'
import { QuestionScreen } from './screens/QuestionScreen'
import { RedoCompleteScreen } from './screens/RedoCompleteScreen'
import { RoundSummary } from './screens/RoundSummary'
import { StatsScreen } from './screens/StatsScreen'

const FEEDBACK_DURATION_MS = 1500

type GameActions = ReturnType<typeof useGameState>['actions']
type GameStateValue = ReturnType<typeof useGameState>['state']

export default function App() {
  const { state, actions } = useGameState()
  const navigate = useNavigate()
  // We have to wait until restoreSession resolves before rendering routes —
  // otherwise the user's first paint flickers from /game (logged in) to /
  // (not yet hydrated) and back.
  const [bootstrapped, setBootstrapped] = useState(false)

  useEffect(() => {
    let cancelled = false
    actions.restoreSession().then((role) => {
      if (cancelled) return
      // Send the user to wherever their role lives if they landed at the
      // root. Deep-links to /game/stats etc. are preserved.
      const path = window.location.pathname
      if (role === 'admin' && (path === '/' || path === '/login')) {
        navigate('/admin', { replace: true })
      } else if (role === 'student' && (path === '/' || path === '/login')) {
        navigate('/game', { replace: true })
      }
      setBootstrapped(true)
    })
    return () => {
      cancelled = true
    }
    // restoreSession is stable; we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-advance after the green/red feedback overlay finishes its window.
  useEffect(() => {
    if (state.feedback) {
      actions.scheduleAdvance(FEEDBACK_DURATION_MS)
    }
  }, [state.feedback, actions])

  if (!bootstrapped) {
    return <div className="h-dvh bg-bg-navy" />
  }

  return (
    <div className="h-dvh bg-bg-navy text-white">
      <Routes>
        <Route path="/" element={<LoginRoute state={state} actions={actions} />} />
        <Route
          path="/game"
          element={<GameRoute state={state} actions={actions} />}
        />
        <Route
          path="/game/stats"
          element={<StatsRoute state={state} actions={actions} />}
        />
        <Route
          path="/admin"
          element={<AdminRoute state={state} actions={actions} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {state.feedback && <FeedbackOverlay feedback={state.feedback} />}
    </div>
  )
}

interface RouteProps {
  state: GameStateValue
  actions: GameActions
}

// `/` — login form. If the user is already logged in (record present, or
// admin screen state set), bounce them to their home.
function LoginRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (state.userRecord) return <Navigate to="/game" replace />
  if (state.screen === 'admin') return <Navigate to="/admin" replace />
  return (
    <LoginScreen
      onSubmit={async (code, name, level) => {
        const role = await actions.login(code, name, level)
        if (role === 'admin') navigate('/admin', { replace: true })
        else if (role === 'student') navigate('/game', { replace: true })
        return role
      }}
    />
  )
}

// `/game` — the active student flow. Renders one of mode-select / level-start
// / question / round-summary / redo-complete / get-better based on
// state.screen, all under the same URL so back-button doesn't interrupt a
// round mid-question.
function GameRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (!state.userRecord) return <Navigate to="/" replace />

  if (state.screen === 'level-start' && state.digitType) {
    return (
      <LevelStartScreen
        digitType={state.digitType}
        numberCount={state.currentNumberCount}
        onConfirm={(extra, noTimer) => actions.confirmLevelStart(extra, noTimer)}
        onChangeDigitLevel={() => actions.changeDigitLevel()}
      />
    )
  }

  if (state.screen === 'question' && state.question) {
    return (
      <QuestionScreen
        question={state.question}
        questionInRound={state.questionInRound}
        consecutiveCorrect={state.consecutiveCorrect}
        coins={state.userRecord.coins ?? 0}
        coinsThisRound={state.coinsThisRound}
        paused={state.feedback != null}
        extraSeconds={state.levelExtraTimeSeconds}
        noTimer={state.levelNoTimer}
        onSubmit={(answer, elapsedMs) => actions.submitAnswer(answer, elapsedMs)}
        onTimeout={(elapsedMs) => actions.submitAnswer(null, elapsedMs)}
        onExit={() => actions.changeDigitLevel()}
      />
    )
  }

  if (state.screen === 'round-summary') {
    return (
      <RoundSummary
        correct={state.correctInRound}
        attempted={state.questionInRound}
        currentNumberCount={state.currentNumberCount}
        consecutiveCorrect={state.consecutiveCorrect}
        leveledUpThisRound={state.leveledUpThisRound}
        wrongCount={state.wrongAttemptsThisRound.length}
        coinsThisRound={state.coinsThisRound}
        onPlayAgain={() => actions.playAgain()}
        onStartNextLevel={() => actions.startNextLevel()}
        onChangeDigitLevel={() => actions.changeDigitLevel()}
        onGetBetter={() => actions.enterGetBetterMode()}
      />
    )
  }

  if (state.screen === 'redo-complete' && state.redoCompletion) {
    const completion = state.redoCompletion
    return (
      <RedoCompleteScreen
        digitType={completion.digitType}
        numberCount={completion.numberCount}
        avgMs={completion.avgMs}
        previousBestMs={completion.previousBestMs}
        onTryAgain={() =>
          actions.redoLevel(completion.digitType, completion.numberCount)
        }
        onBackToScorecard={() => navigate('/game/stats')}
      />
    )
  }

  if (state.screen === 'get-better') {
    return (
      <GetBetterScreen
        attempts={state.wrongAttemptsThisRound}
        onExit={() => actions.exitGetBetterMode()}
      />
    )
  }

  // Default — mode-select home page for /game.
  return (
    <ModeSelectScreen
      name={state.name}
      progress={state.userRecord.progress ?? {}}
      userRecord={state.userRecord}
      onPickDigitType={(dt) => actions.startGame(dt)}
      onShowStats={() => navigate('/game/stats')}
    />
  )
}

// `/game/stats` — child's own scorecard + leaderboard. Back arrow returns
// to /game (browser-native).
function StatsRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (!state.userRecord) return <Navigate to="/" replace />
  return (
    <StatsScreen
      userRecord={state.userRecord}
      onBack={() => navigate('/game')}
      onRedo={(dt, nc) => {
        actions.redoLevel(dt, nc)
        navigate('/game')
      }}
    />
  )
}

// `/admin` — admin view. Logout returns to /.
function AdminRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (state.screen !== 'admin') return <Navigate to="/" replace />
  return (
    <AdminScreen
      onLogout={() => {
        actions.logout()
        navigate('/', { replace: true })
      }}
    />
  )
}
