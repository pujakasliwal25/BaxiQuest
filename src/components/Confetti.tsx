interface ConfettiProps {
  // Re-mount key — bump to retrigger.
  tick: number
  // How many pieces. 24 looks dense but stays cheap.
  count?: number
}

const COLORS = ['#FFD000', '#29B6E8', '#E8192C', '#7CFFC8', '#FFFFFF']

// Falling confetti rain. Designed to overlay the full-screen success
// feedback during a streak burst. Each piece has a random horizontal start,
// horizontal drift, color, and size; the keyframe handles the fall + spin.
export function Confetti({ tick, count = 24 }: ConfettiProps) {
  // Generate piece configs once per `tick` so they re-randomize each fire.
  const pieces = Array.from({ length: count }, (_, i) => {
    // Deterministic-ish randomness from index + tick — avoids needing a ref
    // and keeps SSR-style stability across renders within the same tick.
    const seed = (i + 1) * 9301 + tick * 49297
    const r1 = ((seed % 233280) / 233280)
    const r2 = (((seed * 1103) % 233280) / 233280)
    const r3 = (((seed * 12345) % 233280) / 233280)
    const startLeft = r1 * 100 // %
    const drift = (r2 - 0.5) * 120 // px sideways drift
    const delay = r3 * 300 // ms stagger
    const size = 6 + Math.floor(r2 * 8) // 6–13px
    const color = COLORS[i % COLORS.length]
    return { startLeft, drift, delay, size, color }
  })
  return (
    <div
      key={tick}
      className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden z-10"
      aria-hidden
    >
      {pieces.map((p, i) => (
        <span
          key={i}
          className="absolute top-0 animate-confetti"
          style={{
            left: `${p.startLeft}%`,
            width: p.size,
            height: p.size * 1.4,
            backgroundColor: p.color,
            borderRadius: 2,
            animationDelay: `${p.delay}ms`,
            // CSS variable consumed by the keyframe for sideways drift.
            ['--cx' as string]: `${p.drift}px`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  )
}
