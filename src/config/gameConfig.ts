export const GAME_CONFIG = {
  correctInARowNeeded: 3,
  startNumberCount: 2,
  maxNumberCount: 15,
  questionsPerRound: 10,
  validClassCodes: ['BAXI2024'],
  // Each tap of the "+ time" button adds this many seconds to the current question.
  extraTimeBonusSeconds: 5,
  // How many times a child can extend the timer per question.
  extraTimeMaxUsesPerQuestion: 3,
} as const
