import { GAME_CONFIG } from '../config/gameConfig'

export interface CoinPayout {
  // Total coins earned for this answer (includes the streak bonus when set).
  total: number
  // Just the per-correct portion (base + speed) × multiplier — useful for
  // showing a regular "+N coins" caption distinct from the streak burst.
  perCorrect: number
  // The streak bonus, if this answer just completed a 3-in-a-row.
  streakBonus: number
}

interface PayoutInput {
  correct: boolean
  // Wall-clock-ish elapsed at decision time (Type/Speak press), in ms.
  elapsedMs: number
  // The question's base timer in seconds (digit count of the operands).
  baseTimerSeconds: number
  // Per-level timer settings — drive the multiplier.
  levelExtraSeconds: number
  levelNoTimer: boolean
  // True if this answer just completed a 3-in-a-row.
  threeInARow: boolean
}

function timerMultiplier(extra: number, noTimer: boolean): number {
  if (noTimer) return GAME_CONFIG.coinMultiplierNoTimer
  const m = GAME_CONFIG.coinMultiplierByExtraSeconds[extra]
  return m ?? 1.0
}

// Linear decay from coinMaxSpeedBonus (instant) to 0 (used the full base
// timer). Going past the base timer (still legal under +Xs / no-timer) just
// clamps to 0.
function speedBonus(elapsedMs: number, baseTimerSeconds: number): number {
  if (baseTimerSeconds <= 0) return 0
  const elapsedSec = Math.max(0, elapsedMs / 1000)
  const ratio = Math.max(0, 1 - elapsedSec / baseTimerSeconds)
  return GAME_CONFIG.coinMaxSpeedBonus * ratio
}

export function computeCoinPayout(input: PayoutInput): CoinPayout {
  if (!input.correct) {
    return { total: 0, perCorrect: 0, streakBonus: 0 }
  }
  const raw =
    GAME_CONFIG.coinBasePerCorrect +
    speedBonus(input.elapsedMs, input.baseTimerSeconds)
  const mult = timerMultiplier(input.levelExtraSeconds, input.levelNoTimer)
  const perCorrect = Math.max(1, Math.round(raw * mult))
  const streakBonus = input.threeInARow ? GAME_CONFIG.coinThreeInARowBonus : 0
  return {
    total: perCorrect + streakBonus,
    perCorrect,
    streakBonus,
  }
}
