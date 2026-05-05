interface SparklesProps {
  // Re-mount key — caller bumps this to retrigger the animation.
  tick: number
  // Color of the sparkle dots. Defaults to gold.
  color?: string
}

// Ring of 8 sparkle dots that pop around whatever they're positioned over.
// Designed to wrap a celebrating Baxi: place inside a `relative` container
// and it fills the parent with absolutely-positioned sparkle dots.
export function Sparkles({ tick, color = '#FFEFA1' }: SparklesProps) {
  // 8 dots arranged in a rough circle. (top%, left%, sizePx, delayMs)
  const dots: Array<[number, number, number, number]> = [
    [10, 50, 10, 0],
    [22, 80, 8, 80],
    [50, 92, 12, 160],
    [78, 80, 9, 220],
    [90, 50, 11, 100],
    [78, 18, 8, 180],
    [50, 6, 12, 60],
    [22, 18, 9, 140],
  ]
  return (
    <div
      key={tick}
      className="pointer-events-none absolute inset-0"
      aria-hidden
    >
      {dots.map(([top, left, size, delay], i) => (
        <span
          key={i}
          className="absolute animate-sparkle"
          style={{
            top: `${top}%`,
            left: `${left}%`,
            width: size,
            height: size,
            animationDelay: `${delay}ms`,
          }}
        >
          <SparkleDot size={size} color={color} />
        </span>
      ))}
    </div>
  )
}

function SparkleDot({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill={color}
      aria-hidden
    >
      <path d="M10 0 L12 8 L20 10 L12 12 L10 20 L8 12 L0 10 L8 8 Z" />
    </svg>
  )
}
