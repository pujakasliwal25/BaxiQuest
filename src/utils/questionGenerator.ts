export type DigitType =
  | '1-digit'
  | '2-digit'
  | '3-digit'
  | '4-digit'
  | '1-2-mixed'
  | '2-3-mixed'
  | '1-2-3-mixed'

export interface Question {
  // Signed numbers — negatives represent subtraction. The first element is
  // always positive (it's the starting value, no operator before it).
  numbers: number[]
  answer: number
  display: string
  timerSeconds: number
}

export const DIGIT_TYPE_LABELS: Record<DigitType, string> = {
  '1-digit': '1-digit',
  '2-digit': '2-digit',
  '3-digit': '3-digit',
  '4-digit': '4-digit',
  '1-2-mixed': '1 & 2-digit mixed',
  '2-3-mixed': '2 & 3-digit mixed',
  '1-2-3-mixed': '1, 2 & 3-digit mixed',
}

export const ALL_DIGIT_TYPES: DigitType[] = [
  '1-digit',
  '2-digit',
  '3-digit',
  '4-digit',
  '1-2-mixed',
  '2-3-mixed',
  '1-2-3-mixed',
]

const SUBTRACT_PROBABILITY = 0.5

function randomInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/**
 * Pick a random integer in [min, max] preferring values not in `exclude`.
 * If every value in the range is excluded, falls back to a free pick from
 * the full range so generation never deadlocks.
 */
function randomInRangeAvoiding(
  min: number,
  max: number,
  exclude: Set<number>,
): number {
  if (max < min) return min
  // Build list of allowed values. For wide ranges this is cheap because
  // `exclude` is small (capped by numberCount).
  const allowed: number[] = []
  for (let v = min; v <= max; v++) {
    if (!exclude.has(v)) allowed.push(v)
  }
  if (allowed.length === 0) return randomInRange(min, max)
  return allowed[Math.floor(Math.random() * allowed.length)]
}

function pickRange(digitType: DigitType): [number, number] {
  switch (digitType) {
    case '1-digit':
      return [1, 9]
    case '2-digit':
      return [10, 99]
    case '3-digit':
      return [100, 999]
    case '4-digit':
      return [1000, 9999]
    case '1-2-mixed': {
      const opts: [number, number][] = [
        [1, 9],
        [10, 99],
      ]
      return opts[Math.floor(Math.random() * opts.length)]
    }
    case '2-3-mixed': {
      const opts: [number, number][] = [
        [10, 99],
        [100, 999],
      ]
      return opts[Math.floor(Math.random() * opts.length)]
    }
    case '1-2-3-mixed': {
      const opts: [number, number][] = [
        [1, 9],
        [10, 99],
        [100, 999],
      ]
      return opts[Math.floor(Math.random() * opts.length)]
    }
  }
}

export function generateQuestion(
  digitType: DigitType,
  numberCount: number,
): Question {
  const signed: number[] = []
  let runningTotal = 0

  // Track magnitudes already used as adds vs subtracts so we never have
  // both +N and -N in the same question (e.g. avoid +2 ... -2 pairs).
  const usedAsAdd = new Set<number>()
  const usedAsSub = new Set<number>()

  // First number: always positive — it's the starting value.
  const [firstMin, firstMax] = pickRange(digitType)
  const first = randomInRange(firstMin, firstMax)
  signed.push(first)
  runningTotal = first
  usedAsAdd.add(first)

  for (let i = 1; i < numberCount; i++) {
    const [min, max] = pickRange(digitType)
    const wantSubtract = Math.random() < SUBTRACT_PROBABILITY

    // Subtract is only feasible if a value in [min, max] can fit under the
    // running total without taking it negative.
    const canSubtract = runningTotal >= min
    let didSubtract = false

    if (wantSubtract && canSubtract) {
      const cap = Math.min(max, runningTotal)
      // Only subtract if there's a non-conflicting magnitude available.
      // Otherwise fall through to the add branch so we don't introduce
      // a +N / -N pair via the avoidance fallback.
      let hasNonConflict = false
      for (let v = min; v <= cap; v++) {
        if (!usedAsAdd.has(v)) {
          hasNonConflict = true
          break
        }
      }
      if (hasNonConflict) {
        const mag = randomInRangeAvoiding(min, cap, usedAsAdd)
        signed.push(-mag)
        runningTotal -= mag
        usedAsSub.add(mag)
        didSubtract = true
      }
    }

    if (!didSubtract) {
      // Avoid magnitudes already used as negative in this question.
      const mag = randomInRangeAvoiding(min, max, usedAsSub)
      signed.push(mag)
      runningTotal += mag
      usedAsAdd.add(mag)
    }
  }

  const answer = runningTotal
  const display =
    signed
      .map((n, i) => {
        if (i === 0) return `${n}`
        return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`
      })
      .join(' ') + ' = ?'
  // Timer counts digits of the magnitudes only — the operator isn't a digit.
  const timerSeconds = signed.reduce(
    (sum, n) => sum + Math.abs(n).toString().length,
    0,
  )

  return { numbers: signed, answer, display, timerSeconds }
}
