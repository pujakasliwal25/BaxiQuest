import { CoinSvg } from './CoinCounter'

interface CoinBurstProps {
  // Coins earned for the per-correct portion (base + speed × multiplier).
  perCorrect: number
  // Streak bonus, if any (the +50 from a 3-in-a-row).
  streakBonus: number
  // Increments each time a fresh feedback fires so the same payout shape
  // re-mounts and re-plays its animation.
  tick: number
}

// Floating caption that pops up when a child gets a correct answer.
// Renders in two flavors: a regular "+N coins!" float, and a bigger,
// bolder streak burst when the answer also completed a 3-in-a-row.
export function CoinBurst({ perCorrect, streakBonus, tick }: CoinBurstProps) {
  if (perCorrect <= 0 && streakBonus <= 0) return null
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-center"
      aria-hidden
    >
      {perCorrect > 0 && (
        <div
          key={`coin-${tick}`}
          className="absolute left-1/2 top-2 animate-coin-float"
        >
          <span className="inline-flex items-center gap-1 rounded-pill bg-magic-gold text-bg-navy font-extrabold text-base px-3 py-1 shadow-lg">
            <CoinSvg size={16} />+{perCorrect}
          </span>
        </div>
      )}
      {streakBonus > 0 && (
        <div
          key={`streak-${tick}`}
          className="absolute left-1/2 top-10 animate-streak-burst"
        >
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-gradient-to-br from-magic-gold to-quest-red text-bg-navy font-black text-lg px-4 py-1.5 shadow-2xl border-2 border-white/50">
            ✦ STREAK +{streakBonus}
          </span>
        </div>
      )}
    </div>
  )
}
