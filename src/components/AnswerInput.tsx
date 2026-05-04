import { forwardRef } from 'react'

interface AnswerInputProps {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  disabled?: boolean
}

export const AnswerInput = forwardRef<HTMLInputElement, AnswerInputProps>(
  function AnswerInput({ value, onChange, onSubmit, disabled }, ref) {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        maxLength={15}
        placeholder="your answer"
        disabled={disabled}
        value={value}
        onChange={(e) => {
          // Strip everything but digits, cap at 15 digits
          const cleaned = e.target.value.replace(/[^0-9]/g, '').slice(0, 15)
          onChange(cleaned)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onSubmit()
          }
        }}
        className="w-full text-right text-4xl md:text-5xl font-bold tabular-nums bg-card-surface text-white placeholder:text-text-muted px-5 py-4 rounded-card border-2 border-deep-blue focus:outline-none focus:ring-4 focus:ring-deep-blue/40 disabled:opacity-60"
      />
    )
  },
)
