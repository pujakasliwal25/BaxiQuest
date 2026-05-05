import { useEffect } from 'react'
import { FeedbackOverlay } from './components/FeedbackOverlay'
import { useGameState } from './hooks/useGameState'
import { GetBetterScreen } from './screens/GetBetterScreen'
import { LevelInfoCard } from './screens/LevelInfoCard'
import { LoginScreen } from './screens/LoginScreen'
import { ModeSelectScreen } from './screens/ModeSelectScreen'
import { QuestionScreen } from './screens/QuestionScreen'
import { RoundSummary } from './screens/RoundSummary'

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
          onSubmit={(code, name) => actions.login(code, name)}
        />
      )}

      {state.screen === 'mode-select' && (
        <ModeSelectScreen
          name={state.name}
          progress={state.userRecord?.progress ?? {}}
          onPickDigitType={(dt) => actions.startGame(dt)}
        />
      )}

      {state.screen === 'level-info' && state.pendingLevelExample && (
        <LevelInfoCard
          newNumberCount={state.currentNumberCount}
          example={state.pendingLevelExample}
          onContinue={() => actions.continueFromLevelInfo()}
        />
      )}

      {state.screen === 'question' && state.question && (
        <QuestionScreen
          question={state.question}
          questionInRound={state.questionInRound}
          consecutiveCorrect={state.consecutiveCorrect}
          paused={state.feedback != null}
          onSubmit={(answer) => actions.submitAnswer(answer)}
          onTimeout={() => actions.submitAnswer(null)}
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
          onPlayAgain={() => actions.playAgain()}
          onChangeDigitLevel={() => actions.changeDigitLevel()}
          onGetBetter={() => actions.enterGetBetterMode()}
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
