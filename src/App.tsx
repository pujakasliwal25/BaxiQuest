import { useEffect } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { FeedbackOverlay } from './components/FeedbackOverlay'
import { useGameState } from './hooks/useGameState'
import { AdminScreen } from './screens/AdminScreen'
import { GetBetterScreen } from './screens/GetBetterScreen'
import { JoinClassScreen } from './screens/JoinClassScreen'
import { LevelStartScreen } from './screens/LevelStartScreen'
import { ModeSelectScreen } from './screens/ModeSelectScreen'
import { QuestionScreen } from './screens/QuestionScreen'
import { RedoCompleteScreen } from './screens/RedoCompleteScreen'
import { RoundSummary } from './screens/RoundSummary'
import { SignInScreen } from './screens/SignInScreen'
import { SignUpScreen } from './screens/SignUpScreen'
import { StatsScreen } from './screens/StatsScreen'

const FEEDBACK_DURATION_MS = 1500

type GameActions = ReturnType<typeof useGameState>['actions']
type GameStateValue = ReturnType<typeof useGameState>['state']

export default function App() {
  const { state, actions } = useGameState()

  // Auto-advance after the green/red feedback overlay finishes its window.
  useEffect(() => {
    if (state.feedback) {
      actions.scheduleAdvance(FEEDBACK_DURATION_MS)
    }
  }, [state.feedback, actions])

  // Hold the splash while Firebase Auth is resolving the persisted session
  // so we don't flash login → home → wherever the user actually was.
  if (state.authStatus === 'loading') {
    return <div className="h-dvh bg-bg-navy" />
  }

  return (
    <div className="h-dvh bg-bg-navy text-white">
      <Routes>
        <Route path="/" element={<RootRedirect state={state} />} />
        <Route path="/signin" element={<SignInRoute state={state} />} />
        <Route path="/signup" element={<SignUpRoute state={state} />} />
        <Route
          path="/join-class"
          element={<JoinClassRoute state={state} actions={actions} />}
        />
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

// `/` — figure out where the user actually belongs and bounce them there.
// This is the only place the auth → route mapping lives so it stays in
// one head-readable spot.
function RootRedirect({ state }: { state: GameStateValue }) {
  if (state.authStatus !== 'signed-in') return <Navigate to="/signin" replace />
  if (state.authIdentity?.role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  if (!state.userRecord?.classId) {
    return <Navigate to="/join-class" replace />
  }
  return <Navigate to="/game" replace />
}

function SignInRoute({ state }: { state: GameStateValue }) {
  const navigate = useNavigate()
  if (state.authStatus === 'signed-in') return <Navigate to="/" replace />
  return <SignInScreen onSuccess={() => navigate('/', { replace: true })} />
}

function SignUpRoute({ state }: { state: GameStateValue }) {
  const navigate = useNavigate()
  if (state.authStatus === 'signed-in') return <Navigate to="/" replace />
  return <SignUpScreen onSuccess={() => navigate('/', { replace: true })} />
}

// `/join-class` — required between sign-up and play for students. Admins
// would never land here; they bounce to /admin from RootRedirect.
function JoinClassRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (state.authStatus !== 'signed-in') return <Navigate to="/signin" replace />
  if (state.authIdentity?.role === 'admin') return <Navigate to="/admin" replace />
  if (state.userRecord?.classId) return <Navigate to="/game" replace />
  return (
    <JoinClassScreen
      onJoin={async (code) => {
        const result = await actions.linkClass(code)
        if (result) navigate('/game', { replace: true })
        return result
      }}
      onSignOut={() => {
        actions.signOut()
        navigate('/signin', { replace: true })
      }}
    />
  )
}

// `/game` — student game flow. Renders one of mode-select / level-start /
// question / round-summary / redo-complete / get-better based on
// state.screen. Stays at this URL across sub-states so back-button doesn't
// interrupt a round mid-question.
function GameRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (state.authStatus !== 'signed-in') return <Navigate to="/signin" replace />
  if (state.authIdentity?.role === 'admin') return <Navigate to="/admin" replace />
  if (!state.userRecord) return <Navigate to="/" replace />
  if (!state.userRecord.classId) return <Navigate to="/join-class" replace />

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

  return (
    <ModeSelectScreen
      name={state.userRecord.name}
      progress={state.userRecord.progress ?? {}}
      userRecord={state.userRecord}
      onPickDigitType={(dt) => actions.startGame(dt)}
      onShowStats={() => navigate('/game/stats')}
    />
  )
}

function StatsRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (state.authStatus !== 'signed-in') return <Navigate to="/signin" replace />
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

function AdminRoute({ state, actions }: RouteProps) {
  const navigate = useNavigate()
  if (state.authStatus !== 'signed-in') return <Navigate to="/signin" replace />
  if (state.authIdentity?.role !== 'admin') return <Navigate to="/" replace />
  return (
    <AdminScreen
      adminUid={state.authIdentity?.uid ?? ''}
      onLogout={() => {
        actions.signOut()
        navigate('/signin', { replace: true })
      }}
    />
  )
}
