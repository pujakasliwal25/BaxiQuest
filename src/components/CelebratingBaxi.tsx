import { useEffect, useState } from 'react'
import { Baxi } from './Baxi'

interface CelebratingBaxiProps {
  size?: number
  // Set to a fresh tick whenever Baxi should celebrate. The `kind`
  // determines which animation plays:
  //   'hop'   → quick happy bounce (regular correct answer)
  //   'cheer' → bigger, longer celebration (3-in-a-row streak)
  //   null    → idle (no animation)
  trigger: { tick: number; kind: 'hop' | 'cheer' } | null
}

export function CelebratingBaxi({
  size = 100,
  trigger,
}: CelebratingBaxiProps) {
  // We re-key the wrapper div on each new trigger so the CSS animation
  // restarts cleanly even when `kind` is the same.
  const [animKey, setAnimKey] = useState(0)
  const [animKind, setAnimKind] = useState<'hop' | 'cheer' | null>(null)

  useEffect(() => {
    if (!trigger) return
    setAnimKey((k) => k + 1)
    setAnimKind(trigger.kind)
    // Clear after the animation duration so Baxi returns to idle.
    const ms = trigger.kind === 'cheer' ? 1100 : 700
    const t = window.setTimeout(() => setAnimKind(null), ms + 50)
    return () => window.clearTimeout(t)
  }, [trigger?.tick, trigger?.kind, trigger])

  return (
    <div
      key={animKey}
      className={
        animKind === 'cheer'
          ? 'animate-baxi-cheer inline-block'
          : animKind === 'hop'
            ? 'animate-baxi-hop inline-block'
            : 'inline-block'
      }
    >
      <Baxi size={size} />
    </div>
  )
}
