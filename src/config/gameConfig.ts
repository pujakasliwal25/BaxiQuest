export const GAME_CONFIG = {
  correctInARowNeeded: 3,
  startNumberCount: 2,
  maxNumberCount: 15,
  questionsPerRound: 10,
  validClassCodes: ['BAXI2024'],
  // Extra-time presets shown at the start of each level. The chosen value
  // is added to the base timer for every question at that level.
  extraTimeOptions: [0, 5, 10, 15] as readonly number[],
} as const
