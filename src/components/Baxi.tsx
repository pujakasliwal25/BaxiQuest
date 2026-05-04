interface BaxiProps {
  size?: number
}

// Pure stick figure abacus character. All coordinates are defined in a 100x140
// viewBox and scale via the SVG width/height props.
export function Baxi({ size = 100 }: BaxiProps) {
  const VB_W = 100
  const VB_H = 140
  const blue = '#29B6E8'
  const gold = '#FFD000'
  const red = '#E8192C'

  // Frame
  const frame = { x: 25, y: 30, w: 50, h: 50, rx: 6 }
  // 4 vertical rods evenly spaced inside frame
  const rodCount = 4
  const rodXs = Array.from({ length: rodCount }, (_, i) => {
    const step = frame.w / (rodCount + 1)
    return frame.x + step * (i + 1)
  })
  // Divider in the middle
  const dividerY = frame.y + frame.h / 2

  return (
    <svg
      width={size}
      height={(size * VB_H) / VB_W}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Baxi abacus character"
    >
      {/* Left arm */}
      <line
        x1={frame.x}
        y1={frame.y + frame.h * 0.35}
        x2={frame.x - 18}
        y2={frame.y + frame.h * 0.55}
        stroke={blue}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Right arm */}
      <line
        x1={frame.x + frame.w}
        y1={frame.y + frame.h * 0.35}
        x2={frame.x + frame.w + 18}
        y2={frame.y + frame.h * 0.55}
        stroke={blue}
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* Abacus frame */}
      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        rx={frame.rx}
        ry={frame.rx}
        fill="none"
        stroke={blue}
        strokeWidth={3}
      />

      {/* Vertical rods */}
      {rodXs.map((x) => (
        <line
          key={`rod-${x}`}
          x1={x}
          y1={frame.y + 2}
          x2={x}
          y2={frame.y + frame.h - 2}
          stroke={blue}
          strokeWidth={1.5}
        />
      ))}

      {/* Divider bar */}
      <line
        x1={frame.x + 2}
        y1={dividerY}
        x2={frame.x + frame.w - 2}
        y2={dividerY}
        stroke={gold}
        strokeWidth={2.5}
      />

      {/* Top beads (gold) — one per rod above divider */}
      {rodXs.map((x) => (
        <circle key={`top-${x}`} cx={x} cy={dividerY - 7} r={2.6} fill={gold} />
      ))}

      {/* Bottom beads (red) — one per rod below divider */}
      {rodXs.map((x) => (
        <circle key={`bot-${x}`} cx={x} cy={dividerY + 7} r={2.6} fill={red} />
      ))}

      {/* Left leg */}
      <line
        x1={frame.x + frame.w * 0.35}
        y1={frame.y + frame.h}
        x2={frame.x + frame.w * 0.2}
        y2={frame.y + frame.h + 28}
        stroke={blue}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Left foot */}
      <line
        x1={frame.x + frame.w * 0.2 - 4}
        y1={frame.y + frame.h + 28}
        x2={frame.x + frame.w * 0.2 + 5}
        y2={frame.y + frame.h + 28}
        stroke={blue}
        strokeWidth={4}
        strokeLinecap="round"
      />

      {/* Right leg */}
      <line
        x1={frame.x + frame.w * 0.65}
        y1={frame.y + frame.h}
        x2={frame.x + frame.w * 0.8}
        y2={frame.y + frame.h + 28}
        stroke={blue}
        strokeWidth={4}
        strokeLinecap="round"
      />
      {/* Right foot */}
      <line
        x1={frame.x + frame.w * 0.8 - 5}
        y1={frame.y + frame.h + 28}
        x2={frame.x + frame.w * 0.8 + 4}
        y2={frame.y + frame.h + 28}
        stroke={blue}
        strokeWidth={4}
        strokeLinecap="round"
      />
    </svg>
  )
}
