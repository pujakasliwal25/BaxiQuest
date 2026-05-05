// 14 Brain-O-Magic curriculum levels in ascending difficulty.
// F1 < F2 < F3 < F4 (foundation) < L1 < L2 < ... < L10.
export const CURRICULUM_LEVELS = [
  'F1',
  'F2',
  'F3',
  'F4',
  'L1',
  'L2',
  'L3',
  'L4',
  'L5',
  'L6',
  'L7',
  'L8',
  'L9',
  'L10',
] as const

export type CurriculumLevel = (typeof CURRICULUM_LEVELS)[number]

export function isCurriculumLevel(v: unknown): v is CurriculumLevel {
  return (
    typeof v === 'string' &&
    (CURRICULUM_LEVELS as readonly string[]).includes(v)
  )
}
