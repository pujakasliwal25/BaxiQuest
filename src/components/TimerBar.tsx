import { useEffect, useRef, useState } from 'react'

interface TimerBarProps {
  baseSeconds: number
  // Extra seconds added on top of the base for this question's timer.
  // Picked once per level on the level-start screen.
  extraSeconds: number
  // When true, the timer is disabled — no countdown, no expiry. The bar
  // renders a "no timer" indicator instead.
  noTimer?: boolean
  // Identifier that changes when a new question starts so the bar resets.
  resetKey: string | number
  onExpire: () => void
  paused?: boolean
}

export function TimerBar({
  baseSeconds,
  extraSeconds,
  noTimer = false,
  resetKey,
  onExpire,
  paused = false,
}: TimerBarProps) {
  const [elapsed, setElapsed] = useState(0)
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire
  const totalSeconds = baseSeconds + extraSeconds
  const totalRef = useRef(totalSeconds)
  totalRef.current = totalSeconds

  // Tracks how much time has already accumulated when entering a paused state.
  // On resume, the timer continues from this value so progress isn't lost.
  const elapsedAtPauseRef = useRef(0)
  // Updated each animation frame so we can capture the live value when pausing.
  const liveElapsedRef = useRef(0)

  // Reset state on new question (resetKey or baseSeconds change).
  useEffect(() => {
    setElapsed(0)
    elapsedAtPauseRef.current = 0
    liveElapsedRef.current = 0
  }, [resetKey, baseSeconds])

  // Run/pause the timer.
  useEffect(() => {
    if (noTimer) return
    if (paused) {
      // Capture how far we got so resume picks up here.
      elapsedAtPauseRef.current = liveElapsedRef.current
      return
    }

    const startedAt = performance.now() - elapsedAtPauseRef.current * 1000
    let raf = 0
    let fired = false

    const tick = () => {
      const e = (performance.now() - startedAt) / 1000
      const total = totalRef.current
      if (e >= total) {
        liveElapsedRef.current = total
        setElapsed(total)
        if (!fired) {
          fired = true
          onExpireRef.current()
        }
        return
      }
      liveElapsedRef.current = e
      setElapsed(e)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [paused, baseSeconds, resetKey, noTimer])

  const remainingRatio = Math.max(0, 1 - elapsed / totalSeconds)
  const remainingSeconds = Math.max(0, totalSeconds - elapsed)

  // green → yellow → red
  let color = '#1B8A4C'
  if (remainingRatio < 0.33) color = '#E8192C'
  else if (remainingRatio < 0.66) color = '#FFD000'

  if (noTimer) {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between text-sm text-text-muted mb-1">
          <span>Time</span>
          <span className="text-baxi-blue font-semibold">No timer</span>
        </div>
        <div className="h-3 w-full rounded-pill bg-card-surface overflow-hidden border border-card-border">
          <div
            className="h-full rounded-pill bg-baxi-blue/40"
            style={{ width: '100%' }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-sm text-text-muted mb-1">
        <span>
          Time
          {extraSeconds > 0 && (
            <span className="ml-2 text-magic-gold font-semibold">
              +{extraSeconds}s
            </span>
          )}
          {paused && (
            <span className="ml-2 text-baxi-blue font-semibold">paused</span>
          )}
        </span>
        <span className="tabular-nums">{remainingSeconds.toFixed(1)}s</span>
      </div>
      <div className="h-3 w-full rounded-pill bg-card-surface overflow-hidden border border-card-border">
        <div
          className="h-full rounded-pill"
          style={{
            width: `${remainingRatio * 100}%`,
            backgroundColor: color,
            transition: 'background-color 200ms linear',
          }}
        />
      </div>
    </div>
  )
}
