import { useEffect } from 'react'
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

export default function App() {
  const { state, actions } = useGameState()

  // After a feedback overlay appears, auto-advance after FEEDBACK_DURATION_MS.
  useEffect(() => {
    if (state.feedback) {
      actions.scheduleAdvance(FEEDBACK_DURATION_MS)
    }
  }, [state.feedback, actions])

  return (
    <div className="h-dvh bg-bg-navy text-white">
      {state.screen === 'login' && (
        <LoginScreen
          onSubmit={(code, name, level) => actions.login(code, name, level)}
        />
      )}

      {state.screen === 'admin' && (
        <AdminScreen onLogout={() => actions.logout()} />
      )}

      {state.screen === 'mode-select' && (
        <ModeSelectScreen
          name={state.name}
          progress={state.userRecord?.progress ?? {}}
          userRecord={state.userRecord}
          onPickDigitType={(dt) => actions.startGame(dt)}
          onShowStats={() => actions.showStats()}
        />
      )}

      {state.screen === 'stats' && (
        <StatsScreen
          userRecord={state.userRecord}
          onBack={() => actions.hideStats()}
          onRedo={(dt, nc) => actions.redoLevel(dt, nc)}
        />
      )}

      {state.screen === 'level-start' && state.digitType && (
        <LevelStartScreen
          digitType={state.digitType}
          numberCount={state.currentNumberCount}
          onConfirm={(extra, noTimer) =>
            actions.confirmLevelStart(extra, noTimer)
          }
          onChangeDigitLevel={() => actions.changeDigitLevel()}
        />
      )}

      {state.screen === 'question' && state.question && (
        <QuestionScreen
          question={state.question}
          questionInRound={state.questionInRound}
          consecutiveCorrect={state.consecutiveCorrect}
          coins={state.userRecord?.coins ?? 0}
          coinsThisRound={state.coinsThisRound}
          paused={state.feedback != null}
          extraSeconds={state.levelExtraTimeSeconds}
          noTimer={state.levelNoTimer}
          onSubmit={(answer, elapsedMs) =>
            actions.submitAnswer(answer, elapsedMs)
          }
          onTimeout={(elapsedMs) => actions.submitAnswer(null, elapsedMs)}
          onExit={() => actions.changeDigitLevel()}
        />
      )}

      {state.screen === 'round-summary' && (
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
      )}

      {state.screen === 'redo-complete' && state.redoCompletion && (
        <RedoCompleteScreen
          digitType={state.redoCompletion.digitType}
          numberCount={state.redoCompletion.numberCount}
          avgMs={state.redoCompletion.avgMs}
          previousBestMs={state.redoCompletion.previousBestMs}
          onTryAgain={() =>
            state.redoCompletion &&
            actions.redoLevel(
              state.redoCompletion.digitType,
              state.redoCompletion.numberCount,
            )
          }
          onBackToScorecard={() => actions.showStats()}
        />
      )}

      {state.screen === 'get-better' && (
        <GetBetterScreen
          attempts={state.wrongAttemptsThisRound}
          onExit={() => actions.exitGetBetterMode()}
        />
      )}

      {state.feedback && <FeedbackOverlay feedback={state.feedback} />}
    </div>
  )
}
