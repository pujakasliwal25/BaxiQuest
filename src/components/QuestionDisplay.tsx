interface QuestionDisplayProps {
  // Signed numbers — negative means subtraction. First entry is the starting
  // value (always positive); remaining entries carry the operator via sign.
  numbers: number[]
  // Compact mode shrinks sizing for previews (e.g., LevelInfoCard).
  compact?: boolean
}

export function QuestionDisplay({ numbers, compact = false }: QuestionDisplayProps) {
  const maxAbsDigits = numbers.reduce(
    (m, n) => Math.max(m, Math.abs(n).toString().length),
    1,
  )

  const lineCount = numbers.length + 2 // numbers + divider + answer row

  // Width-based ceiling: keeps wide numbers from being absurdly large on
  // narrow screens. Compact mode is for previews, so a tighter ceiling.
  let widthCap: number
  if (compact) {
    widthCap = maxAbsDigits <= 1 ? 36 : maxAbsDigits <= 2 ? 32 : maxAbsDigits <= 3 ? 28 : 24
  } else {
    widthCap = maxAbsDigits <= 1 ? 64 : maxAbsDigits <= 2 ? 56 : maxAbsDigits <= 3 ? 48 : 40
  }

  // For the question screen, scale to viewport height: the column area gets
  // ~55vh, divided by the number of lines, so 15-number questions still fit
  // without scrolling. Floor at 20px so digits stay readable.
  const heightVh = compact ? 0 : 55
  const fontStyle = compact
    ? { fontSize: widthCap }
    : {
        fontSize: `clamp(20px, calc(${heightVh}vh / ${lineCount}), ${widthCap}px)`,
      }

  const opColWidth = '1.4ch'
  const numColWidth = `${maxAbsDigits}ch`

  const Row = ({
    op,
    children,
  }: {
    op: '-' | '+' | ''
    children: React.ReactNode
  }) => (
    <div className="flex items-baseline">
      <span
        className="text-quest-red text-left"
        style={{ width: opColWidth, display: 'inline-block' }}
        aria-hidden={op !== '-'}
      >
        {op === '-' ? '−' : ' '}
      </span>
      <span
        className="text-right"
        style={{ width: numColWidth, display: 'inline-block' }}
      >
        {children}
      </span>
    </div>
  )

  return (
    <div
      className="font-mono tabular-nums font-bold leading-tight mx-auto select-none"
      style={fontStyle}
    >
      {numbers.map((n, i) => (
        <Row key={i} op={i === 0 ? '' : n < 0 ? '-' : ''}>
          {Math.abs(n)}
        </Row>
      ))}
      <div className="flex items-baseline">
        <span style={{ width: opColWidth, display: 'inline-block' }}>
          {' '}
        </span>
        <div
          className="border-t-4 border-white"
          style={{
            width: numColWidth,
            display: 'inline-block',
            marginTop: '0.15em',
            marginBottom: '0.1em',
          }}
        />
      </div>
      <Row op="">
        <span className="text-magic-gold">?</span>
      </Row>
    </div>
  )
}
