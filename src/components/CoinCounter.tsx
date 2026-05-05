import { useEffect, useRef, useState } from 'react'

interface CoinCounterProps {
  coins: number
  // Compact mode shrinks the badge for tight headers.
  compact?: boolean
}

// Tweens the displayed value from old → new whenever `coins` changes,
// triggers a brief pop animation each time, and renders a stylized gold
// coin chip. Designed so a child can't miss when the number goes up.
export function CoinCounter({ coins, compact = false }: CoinCounterProps) {
  const [display, setDisplay] = useState(coins)
  const prevRef = useRef(coins)
  const [popKey, setPopKey] = useState(0)

  useEffect(() => {
    const start = prevRef.current
    const end = coins
    if (start === end) return
    setPopKey((k) => k + 1)

    const duration = 600
    const startedAt = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration)
      // Ease-out quad — fast at first, settles smoothly.
      const eased = 1 - (1 - t) * (1 - t)
      const value = Math.round(start + (end - start) * eased)
      setDisplay(value)
      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setDisplay(end)
        prevRef.current = end
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [coins])

  return (
    <span
      key={`pop-${popKey}`}
      className={`inline-flex items-center gap-1.5 rounded-pill bg-magic-gold/15 border border-magic-gold/60 text-magic-gold font-bold tabular-nums animate-coin-pop ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-base'
      }`}
      aria-label={`${coins} coins`}
    >
      <CoinSvg size={compact ? 14 : 18} />
      <span>{display}</span>
    </span>
  )
}

export function CoinSvg({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="#FFD000"
        stroke="#B58800"
        strokeWidth="1.5"
      />
      <circle
        cx="12"
        cy="12"
        r="6.5"
        fill="none"
        stroke="#B58800"
        strokeWidth="1.2"
      />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fontWeight="800"
        fill="#0A1628"
        fontFamily="ui-sans-serif, system-ui, -apple-system"
      >
        ¢
      </text>
    </svg>
  )
}
