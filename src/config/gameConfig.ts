export const GAME_CONFIG = {
  correctInARowNeeded: 3,
  startNumberCount: 2,
  maxNumberCount: 15,
  questionsPerRound: 10,
  validClassCodes: ['BAXI2024'],
  // Special class codes that route to the admin screen instead of a
  // student session. Same trust model as validClassCodes for now — there's
  // no real auth yet.
  adminClassCodes: ['BAXIADMIN'] as readonly string[],
  // Extra-time presets shown at the start of each level. The chosen value
  // is added to the base timer for every question at that level.
  extraTimeOptions: [0, 5, 10, 15] as readonly number[],
  // ── Coin economy ──
  // Per-correct payout = (base + speedBonus) × timerMultiplier, then rounded.
  // Wrong answers and timeouts pay nothing — coins are pure positive
  // reinforcement. A 3-in-a-row triggers an extra streak bonus on top.
  coinBasePerCorrect: 10,
  // Maximum bonus when the answer is essentially instant. Decays linearly
  // toward 0 as elapsed approaches the question's base timer.
  coinMaxSpeedBonus: 20,
  coinThreeInARowBonus: 50,
  // Multiplier applied to the per-correct payout based on the chosen extra
  // time. Default (no extra) pays the most; harder challenge → higher
  // reward. The "no timer" mode is a separate, lower multiplier.
  coinMultiplierByExtraSeconds: {
    0: 1.0,
    5: 0.85,
    10: 0.7,
    15: 0.55,
  } as Record<number, number>,
  coinMultiplierNoTimer: 0.4,
} as const
