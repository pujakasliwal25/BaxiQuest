import { QuestionDisplay } from '../components/QuestionDisplay'
import type { Question } from '../utils/questionGenerator'

interface LevelInfoCardProps {
  newNumberCount: number
  example: Question
  onContinue: () => void
}

export function LevelInfoCard({ newNumberCount, example, onContinue }: LevelInfoCardProps) {
  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm rounded-card bg-card-surface border border-card-border p-6 text-center">
        <div className="inline-block bg-magic-gold text-bg-navy font-bold rounded-pill px-3 py-1 text-xs uppercase tracking-wider mb-3">
          Next level unlocked!
        </div>
        <h1 className="text-3xl font-bold mb-3">
          Now adding {newNumberCount} numbers at a time
        </h1>

        <div className="my-6 rounded-card bg-bg-navy border border-card-border p-4 flex flex-col items-center">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-3">
            Example
          </div>
          <QuestionDisplay numbers={example.numbers} compact />
        </div>

        <p className="text-text-muted mb-6">
          You'll have <span className="text-white font-semibold">{example.timerSeconds}</span> seconds per question.
        </p>

        <button
          onClick={onContinue}
          className="w-full min-h-touch bg-magic-gold text-bg-navy font-bold text-lg rounded-btn px-4 py-3 active:scale-[0.99] transition-transform"
        >
          Let's go!
        </button>
      </div>
    </div>
  )
}
