/**
 * ============================================================================
 * BAXI QUEST — Soroban Rules Configuration
 * Brain-O-Magic Abacus Curriculum
 * ============================================================================
 *
 * This file defines every abacus rule used in the Brain-O-Magic curriculum.
 * It is used by:
 *   1. The question generator — to tag each question with which rule it tests
 *   2. Get Better Mode — to identify what the child did wrong and walk them
 *      through the correct bead movements step by step
 *   3. The AI (Claude API) — as context for generating explanations
 *   4. The progression system — to track which rules the child struggles with
 *
 * TERMINOLOGY (Brain-O-Magic specific — use these exact terms everywhere):
 *   - "One-hand helper"  = combinations that use 5 (Friends of 5)
 *   - "Two-hand helper"  = combinations that use 10 (Friends of 10)
 *   - "Combination"      = uses both a one-hand helper AND a two-hand helper
 *   - "Skipping"         = crossing 50 on a rod (e.g. 40→50)
 *   - "Jumping"          = crossing 100/1000 (carry to next rod)
 *   - "Reverse"          = the subtraction version of skip/jump
 *   - "Open the rod"     = set a rod to 0 (all beads away from center beam)
 *   - "Close the rod"    = same as open — clear the rod during reverse jump
 *
 * ABACUS STRUCTURE:
 *   - 1 bead on top of the center beam (value = 5, called the "5 bead")
 *   - 4 beads on bottom of the center beam (value = 1 each)
 *   - Beads count when they are touching the center beam
 *   - Center rod = ones (1s)
 *   - Moving left: tens (10s), hundreds (100s), thousands (1000s), ...
 *   - Moving right: tenths (0.1), hundredths (0.01), ...
 *   - Follows the decimal system
 *
 * SETTING NUMBERS:
 *   - 3 = three bottom beads pushed up to touch the beam
 *   - 5 = top bead pushed down to touch the beam
 *   - 6 = top bead down (5) + one bottom bead up (1)
 *   - 7 = top bead down (5) + two bottom beads up (2)
 *   - 9 = top bead down (5) + four bottom beads up (4)
 *   - 23 = 2 bottom beads up on tens rod + 3 bottom beads up on ones rod
 *   - 789 = (5+2) on hundreds rod + (5+3) on tens rod + (5+4) on ones rod
 *
 * CALCULATION ORDER:
 *   Always work LEFT to RIGHT (largest place value first).
 *   For 234 + 567: do hundreds first, then tens, then ones.
 *   Apply the appropriate rule to each rod independently.
 *
 * SPEECH/CALLOUT ORDER (important for teaching):
 *   - One-hand helpers (adding):  "5 down, [helper] down"  (5 first, then helper)
 *   - One-hand helpers (subtracting): "[helper] up, 5 up"  (helper first, then 5)
 *   - Two-hand helpers: just say the formula — "minus 1, plus 10" (no directions)
 *   - Combinations: one-hand part uses directions, two-hand part uses plus/minus
 *     e.g. "+9 combination" = "4 up, 5 up, plus 10"
 *
 *   NEVER say "1 down, 5 down" — always "5 down, 1 down"
 *   NEVER say "1 down, 10 up" — always "minus 1, plus 10"
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RuleCategory =
  | 'direct'
  | 'one-hand-helper'
  | 'two-hand-helper'
  | 'combination'
  | 'skipping'
  | 'reverse-skipping'
  | 'jumping'
  | 'reverse-jumping'

export type Operation = 'add' | 'subtract'

export interface BeadMovement {
  /** Human-readable description of the bead movement in Brain-O-Magic terminology */
  callout: string
  /** Step-by-step bead movements for teaching */
  steps: string[]
}

export interface SorobanRule {
  /** Unique identifier */
  id: string
  /** Display name for the UI */
  name: string
  /** The operation this rule handles: +1, +2, ..., -1, -2, etc. */
  operation: string
  /** Which category of helper is used */
  category: RuleCategory
  /** 'add' or 'subtract' */
  type: Operation
  /** The mathematical formula: e.g. "+5 -1" for adding 4 via one-hand helper */
  formula: string
  /** Bead movement description in Brain-O-Magic terminology */
  beadMovement: BeadMovement
  /** When this rule triggers — what conditions on the rod make direct impossible */
  trigger: string
  /** Worked example */
  example: {
    question: string
    startingValue: number
    endingValue: number
    working: string
  }
  /** Practice questions that specifically exercise this rule */
  practiceQuestions: string[]
  /** What the child commonly does wrong with this rule */
  commonErrors: string[]
}

// ============================================================================
// DIRECT OPERATIONS (no helper needed)
// ============================================================================

export const DIRECT_RULES: SorobanRule[] = [
  {
    id: 'direct-add',
    name: 'Direct Addition',
    operation: 'add (any)',
    category: 'direct',
    type: 'add',
    formula: 'Push beads up directly',
    beadMovement: {
      callout: 'Push the beads up',
      steps: ['Push the required number of bottom beads up to touch the center beam'],
    },
    trigger: 'There are enough bottom beads available below the center beam to push up',
    example: { question: '1 + 2', startingValue: 1, endingValue: 3, working: 'Push 2 more bottom beads up. 1 + 2 = 3.' },
    practiceQuestions: ['1+2', '2+1', '1+3', '3+1', '2+2', '1+1'],
    commonErrors: ['Moving too many beads', 'Forgetting to count the starting beads'],
  },
  {
    id: 'direct-sub',
    name: 'Direct Subtraction',
    operation: 'subtract (any)',
    category: 'direct',
    type: 'subtract',
    formula: 'Push beads down directly',
    beadMovement: {
      callout: 'Push the beads down',
      steps: ['Push the required number of bottom beads down away from the center beam'],
    },
    trigger: 'There are enough bottom beads touching the center beam to push down',
    example: { question: '3 - 2', startingValue: 3, endingValue: 1, working: 'Push 2 bottom beads down. 3 - 2 = 1.' },
    practiceQuestions: ['3-2', '3-1', '4-2', '4-3', '4-1', '2-1'],
    commonErrors: ['Pushing down the wrong number of beads'],
  },
]

// ============================================================================
// ONE-HAND HELPERS (combinations of 5)
// ============================================================================

export const ONE_HAND_HELPER_ADD_RULES: SorobanRule[] = [
  {
    id: 'one-hand-add-4',
    name: 'One-Hand Helper: +4',
    operation: '+4',
    category: 'one-hand-helper',
    type: 'add',
    formula: '+5 -1',
    beadMovement: {
      callout: '5 down, 1 down',
      steps: [
        'Push the 5 bead down to touch the center beam',
        'At the same time, push 1 bottom bead down away from the center beam',
      ],
    },
    trigger: 'Adding 4 but fewer than 4 bottom beads are available below the beam, and the 5 bead is up (available)',
    example: { question: '1 + 4', startingValue: 1, endingValue: 5, working: 'Cannot push 4 beads up (only 3 available). Use one-hand helper: 5 down, 1 down. Result: 5.' },
    practiceQuestions: ['1+4', '2+4', '3+4', '4+4'],
    commonErrors: ['Saying "1 down, 5 down" instead of "5 down, 1 down"', 'Forgetting to push the 1 down'],
  },
  {
    id: 'one-hand-add-3',
    name: 'One-Hand Helper: +3',
    operation: '+3',
    category: 'one-hand-helper',
    type: 'add',
    formula: '+5 -2',
    beadMovement: {
      callout: '5 down, 2 down',
      steps: [
        'Push the 5 bead down to touch the center beam',
        'At the same time, push 2 bottom beads down away from the center beam',
      ],
    },
    trigger: 'Adding 3 but fewer than 3 bottom beads are available below the beam, and the 5 bead is up (available)',
    example: { question: '3 + 3', startingValue: 3, endingValue: 6, working: 'Cannot push 3 beads up (only 1 available). Use one-hand helper: 5 down, 2 down. Result: 6.' },
    practiceQuestions: ['3+3', '4+3', '2+3'],
    commonErrors: ['Pushing down the wrong helper number', 'Using two-hand helper instead when one-hand is correct'],
  },
  {
    id: 'one-hand-add-2',
    name: 'One-Hand Helper: +2',
    operation: '+2',
    category: 'one-hand-helper',
    type: 'add',
    formula: '+5 -3',
    beadMovement: {
      callout: '5 down, 3 down',
      steps: [
        'Push the 5 bead down to touch the center beam',
        'At the same time, push 3 bottom beads down away from the center beam',
      ],
    },
    trigger: 'Adding 2 but fewer than 2 bottom beads are available below the beam, and the 5 bead is up (available)',
    example: { question: '4 + 2', startingValue: 4, endingValue: 6, working: 'Cannot push 2 beads up (0 available). Use one-hand helper: 5 down, 3 down. Result: 6.' },
    practiceQuestions: ['4+2', '3+2'],
    commonErrors: ['Confusing the helper (3) with the number being added (2)'],
  },
  {
    id: 'one-hand-add-1',
    name: 'One-Hand Helper: +1',
    operation: '+1',
    category: 'one-hand-helper',
    type: 'add',
    formula: '+5 -4',
    beadMovement: {
      callout: '5 down, 4 down',
      steps: [
        'Push the 5 bead down to touch the center beam',
        'At the same time, push 4 bottom beads down away from the center beam',
      ],
    },
    trigger: 'Adding 1 but no bottom beads are available below the beam, and the 5 bead is up (available)',
    example: { question: '4 + 1', startingValue: 4, endingValue: 5, working: 'Cannot push 1 bead up (0 available). Use one-hand helper: 5 down, 4 down. Result: 5.' },
    practiceQuestions: ['4+1'],
    commonErrors: ['Not recognizing this as a one-hand helper situation'],
  },
]

export const ONE_HAND_HELPER_SUB_RULES: SorobanRule[] = [
  {
    id: 'one-hand-sub-4',
    name: 'One-Hand Helper: -4',
    operation: '-4',
    category: 'one-hand-helper',
    type: 'subtract',
    formula: '-5 +1',
    beadMovement: {
      callout: '1 up, 5 up',
      steps: [
        'Push 1 bottom bead up to touch the center beam',
        'At the same time, push the 5 bead up away from the center beam',
      ],
    },
    trigger: 'Subtracting 4 but fewer than 4 bottom beads are touching the beam, and the 5 bead is down (in use)',
    example: { question: '6 - 4', startingValue: 6, endingValue: 2, working: 'Cannot push 4 beads down (only 1 touching beam). Use one-hand helper: 1 up, 5 up. Result: 2.' },
    practiceQuestions: ['6-4', '7-4', '8-4', '9-4'],
    commonErrors: ['Saying "5 up, 1 up" instead of "1 up, 5 up"'],
  },
  {
    id: 'one-hand-sub-3',
    name: 'One-Hand Helper: -3',
    operation: '-3',
    category: 'one-hand-helper',
    type: 'subtract',
    formula: '-5 +2',
    beadMovement: {
      callout: '2 up, 5 up',
      steps: [
        'Push 2 bottom beads up to touch the center beam',
        'At the same time, push the 5 bead up away from the center beam',
      ],
    },
    trigger: 'Subtracting 3 but fewer than 3 bottom beads are touching the beam, and the 5 bead is down',
    example: { question: '7 - 3', startingValue: 7, endingValue: 4, working: 'Cannot push 3 beads down (only 2 touching beam). Use one-hand helper: 2 up, 5 up. Result: 4.' },
    practiceQuestions: ['7-3', '6-3', '8-3'],
    commonErrors: ['Confusing helper (2) with number being subtracted (3)'],
  },
  {
    id: 'one-hand-sub-2',
    name: 'One-Hand Helper: -2',
    operation: '-2',
    category: 'one-hand-helper',
    type: 'subtract',
    formula: '-5 +3',
    beadMovement: {
      callout: '3 up, 5 up',
      steps: [
        'Push 3 bottom beads up to touch the center beam',
        'At the same time, push the 5 bead up away from the center beam',
      ],
    },
    trigger: 'Subtracting 2 but fewer than 2 bottom beads are touching the beam, and the 5 bead is down',
    example: { question: '6 - 2', startingValue: 6, endingValue: 4, working: 'Cannot push 2 beads down (only 1 touching beam). Use one-hand helper: 3 up, 5 up. Result: 4.' },
    practiceQuestions: ['6-2', '7-2'],
    commonErrors: ['Using the wrong helper number'],
  },
  {
    id: 'one-hand-sub-1',
    name: 'One-Hand Helper: -1',
    operation: '-1',
    category: 'one-hand-helper',
    type: 'subtract',
    formula: '-5 +4',
    beadMovement: {
      callout: '4 up, 5 up',
      steps: [
        'Push 4 bottom beads up to touch the center beam',
        'At the same time, push the 5 bead up away from the center beam',
      ],
    },
    trigger: 'Subtracting 1 but no bottom beads are touching the beam, and the 5 bead is down',
    example: { question: '5 - 1', startingValue: 5, endingValue: 4, working: 'Cannot push 1 bead down (0 touching beam). Use one-hand helper: 4 up, 5 up. Result: 4.' },
    practiceQuestions: ['5-1'],
    commonErrors: ['Not recognizing 5 as a one-hand helper situation'],
  },
]

// ============================================================================
// TWO-HAND HELPERS (combinations of 10)
// ============================================================================

export const TWO_HAND_HELPER_ADD_RULES: SorobanRule[] = [
  {
    id: 'two-hand-add-9',
    name: 'Two-Hand Helper: +9',
    operation: '+9',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-1 +10',
    beadMovement: {
      callout: 'Minus 1, plus 10',
      steps: [
        'Subtract 1 from the current rod (push 1 bottom bead down)',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 9 but the current rod cannot hold 9 more (value + 9 > 9), so we borrow from 10',
    example: { question: '4 + 9', startingValue: 4, endingValue: 13, working: 'Cannot fit 9 on the ones rod. Use two-hand helper: minus 1 on ones rod (4→3), plus 10 on tens rod (0→1). Result: 13.' },
    practiceQuestions: ['1+9', '2+9', '3+9', '4+9', '5+9', '6+9', '7+9', '8+9', '9+9'],
    commonErrors: ['Subtracting the wrong complement', 'Forgetting to add 1 to the tens rod'],
  },
  {
    id: 'two-hand-add-8',
    name: 'Two-Hand Helper: +8',
    operation: '+8',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-2 +10',
    beadMovement: {
      callout: 'Minus 2, plus 10',
      steps: [
        'Subtract 2 from the current rod',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 8 but value + 8 > 9 on the current rod',
    example: { question: '3 + 8', startingValue: 3, endingValue: 11, working: 'Two-hand helper: minus 2 on ones rod (3→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['2+8', '3+8', '4+8', '5+8', '6+8', '7+8', '8+8', '9+8'],
    commonErrors: ['Subtracting 8 instead of the complement (2)'],
  },
  {
    id: 'two-hand-add-7',
    name: 'Two-Hand Helper: +7',
    operation: '+7',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-3 +10',
    beadMovement: {
      callout: 'Minus 3, plus 10',
      steps: [
        'Subtract 3 from the current rod',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 7 but value + 7 > 9 on the current rod',
    example: { question: '4 + 7', startingValue: 4, endingValue: 11, working: 'Two-hand helper: minus 3 on ones rod (4→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['3+7', '4+7', '5+7', '6+7', '7+7', '8+7', '9+7'],
    commonErrors: ['Using complement of 5 instead of complement of 10'],
  },
  {
    id: 'two-hand-add-6',
    name: 'Two-Hand Helper: +6',
    operation: '+6',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-4 +10',
    beadMovement: {
      callout: 'Minus 4, plus 10',
      steps: [
        'Subtract 4 from the current rod',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 6 but value + 6 > 9 on the current rod',
    example: { question: '5 + 6', startingValue: 5, endingValue: 11, working: 'Two-hand helper: minus 4 on ones rod (5→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['4+6', '5+6', '6+6', '7+6', '8+6', '9+6'],
    commonErrors: ['Not recognizing that -4 requires a one-hand helper (→ combination rule)'],
  },
  {
    id: 'two-hand-add-5',
    name: 'Two-Hand Helper: +5',
    operation: '+5',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-5 +10',
    beadMovement: {
      callout: 'Minus 5, plus 10',
      steps: [
        'Subtract 5 from the current rod (push the 5 bead up)',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 5 but the 5 bead is already down and there are beads touching, so value + 5 > 9',
    example: { question: '5 + 5', startingValue: 5, endingValue: 10, working: 'Two-hand helper: minus 5 on ones rod (5→0), plus 10 on tens rod. Result: 10.' },
    practiceQuestions: ['5+5', '6+5', '7+5', '8+5', '9+5'],
    commonErrors: ['Trying to push the 5 bead down when it is already down'],
  },
  {
    id: 'two-hand-add-4',
    name: 'Two-Hand Helper: +4',
    operation: '+4',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-6 +10',
    beadMovement: {
      callout: 'Minus 6, plus 10',
      steps: [
        'Subtract 6 from the current rod',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 4 but value + 4 > 9 and the 5 bead is already down (one-hand helper also not possible)',
    example: { question: '7 + 4', startingValue: 7, endingValue: 11, working: 'Two-hand helper: minus 6 on ones rod (7→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['6+4', '7+4', '8+4', '9+4'],
    commonErrors: ['Confusing with one-hand helper +4 (5 down, 1 down)'],
  },
  {
    id: 'two-hand-add-3',
    name: 'Two-Hand Helper: +3',
    operation: '+3',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-7 +10',
    beadMovement: {
      callout: 'Minus 7, plus 10',
      steps: [
        'Subtract 7 from the current rod',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 3 but value + 3 > 9 and one-hand helper not possible',
    example: { question: '8 + 3', startingValue: 8, endingValue: 11, working: 'Two-hand helper: minus 7 on ones rod (8→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['7+3', '8+3', '9+3'],
    commonErrors: ['Using one-hand helper instead of two-hand'],
  },
  {
    id: 'two-hand-add-2',
    name: 'Two-Hand Helper: +2',
    operation: '+2',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-8 +10',
    beadMovement: {
      callout: 'Minus 8, plus 10',
      steps: [
        'Subtract 8 from the current rod',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 2 but value + 2 > 9 and one-hand helper not possible',
    example: { question: '9 + 2', startingValue: 9, endingValue: 11, working: 'Two-hand helper: minus 8 on ones rod (9→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['8+2', '9+2'],
    commonErrors: ['Subtracting the wrong complement from the rod'],
  },
  {
    id: 'two-hand-add-1',
    name: 'Two-Hand Helper: +1',
    operation: '+1',
    category: 'two-hand-helper',
    type: 'add',
    formula: '-9 +10',
    beadMovement: {
      callout: 'Minus 9, plus 10',
      steps: [
        'Subtract 9 from the current rod (clear the entire rod)',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 1 but rod is at 9 (full), one-hand helper not possible',
    example: { question: '9 + 1', startingValue: 9, endingValue: 10, working: 'Two-hand helper: minus 9 on ones rod (9→0), plus 10 on tens rod. Result: 10.' },
    practiceQuestions: ['9+1'],
    commonErrors: ['Not recognizing 9+1 as a two-hand helper situation'],
  },
]

export const TWO_HAND_HELPER_SUB_RULES: SorobanRule[] = [
  {
    id: 'two-hand-sub-9',
    name: 'Two-Hand Helper: -9',
    operation: '-9',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +1',
    beadMovement: {
      callout: 'Minus 10, plus 1',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 1 to the current rod (push 1 bottom bead up)',
      ],
    },
    trigger: 'Subtracting 9 but current rod value < 9, so borrow 10 from the rod to the left',
    example: { question: '11 - 9', startingValue: 11, endingValue: 2, working: 'Two-hand helper: minus 10 on tens rod (1→0), plus 1 on ones rod (1→2). Result: 2.' },
    practiceQuestions: ['10-9', '11-9', '12-9', '13-9', '14-9', '15-9'],
    commonErrors: ['Adding the wrong complement to the current rod'],
  },
  {
    id: 'two-hand-sub-8',
    name: 'Two-Hand Helper: -8',
    operation: '-8',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +2',
    beadMovement: {
      callout: 'Minus 10, plus 2',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 2 to the current rod',
      ],
    },
    trigger: 'Subtracting 8 but current rod value < 8',
    example: { question: '12 - 8', startingValue: 12, endingValue: 4, working: 'Two-hand helper: minus 10 on tens rod, plus 2 on ones rod (2→4). Result: 4.' },
    practiceQuestions: ['10-8', '11-8', '12-8', '13-8', '14-8'],
    commonErrors: ['Adding 8 instead of complement (2)'],
  },
  {
    id: 'two-hand-sub-7',
    name: 'Two-Hand Helper: -7',
    operation: '-7',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +3',
    beadMovement: {
      callout: 'Minus 10, plus 3',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 3 to the current rod',
      ],
    },
    trigger: 'Subtracting 7 but current rod value < 7',
    example: { question: '13 - 7', startingValue: 13, endingValue: 6, working: 'Two-hand helper: minus 10 on tens rod, plus 3 on ones rod (3→6). Result: 6.' },
    practiceQuestions: ['10-7', '11-7', '12-7', '13-7'],
    commonErrors: ['Confusing complement of 10 with complement of 5'],
  },
  {
    id: 'two-hand-sub-6',
    name: 'Two-Hand Helper: -6',
    operation: '-6',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +4',
    beadMovement: {
      callout: 'Minus 10, plus 4',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 4 to the current rod',
      ],
    },
    trigger: 'Subtracting 6 but current rod value < 6',
    example: { question: '14 - 6', startingValue: 14, endingValue: 8, working: 'Two-hand helper: minus 10 on tens rod, plus 4 on ones rod (4→8). Result: 8.' },
    practiceQuestions: ['10-6', '11-6', '12-6', '13-6', '14-6'],
    commonErrors: ['Not recognizing when +4 on the current rod itself needs a one-hand helper (→ combination)'],
  },
  {
    id: 'two-hand-sub-5',
    name: 'Two-Hand Helper: -5',
    operation: '-5',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +5',
    beadMovement: {
      callout: 'Minus 10, plus 5',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 5 to the current rod (push the 5 bead down)',
      ],
    },
    trigger: 'Subtracting 5 but the 5 bead is already up and not enough bottom beads, so current rod value < 5',
    example: { question: '10 - 5', startingValue: 10, endingValue: 5, working: 'Two-hand helper: minus 10 on tens rod (1→0), plus 5 on ones rod (5 bead down). Result: 5.' },
    practiceQuestions: ['10-5', '11-5', '12-5', '13-5', '14-5'],
    commonErrors: ['Trying to push 5 bead up when it is already up'],
  },
  {
    id: 'two-hand-sub-4',
    name: 'Two-Hand Helper: -4',
    operation: '-4',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +6',
    beadMovement: {
      callout: 'Minus 10, plus 6',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 6 to the current rod (push 5 bead down and 1 bottom bead up)',
      ],
    },
    trigger: 'Subtracting 4 but current rod value < 4 and one-hand helper not possible (5 bead is up)',
    example: { question: '10 - 4', startingValue: 10, endingValue: 6, working: 'Two-hand helper: minus 10 on tens rod, plus 6 on ones rod. Result: 6.' },
    practiceQuestions: ['10-4', '11-4', '12-4', '13-4'],
    commonErrors: ['Confusing with one-hand helper -4'],
  },
  {
    id: 'two-hand-sub-3',
    name: 'Two-Hand Helper: -3',
    operation: '-3',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +7',
    beadMovement: {
      callout: 'Minus 10, plus 7',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 7 to the current rod',
      ],
    },
    trigger: 'Subtracting 3 but current rod value < 3 and one-hand helper not possible',
    example: { question: '10 - 3', startingValue: 10, endingValue: 7, working: 'Two-hand helper: minus 10 on tens rod, plus 7 on ones rod. Result: 7.' },
    practiceQuestions: ['10-3', '11-3', '12-3'],
    commonErrors: ['Using complement of 5 instead of complement of 10'],
  },
  {
    id: 'two-hand-sub-2',
    name: 'Two-Hand Helper: -2',
    operation: '-2',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +8',
    beadMovement: {
      callout: 'Minus 10, plus 8',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 8 to the current rod',
      ],
    },
    trigger: 'Subtracting 2 but current rod value < 2 and one-hand helper not possible',
    example: { question: '10 - 2', startingValue: 10, endingValue: 8, working: 'Two-hand helper: minus 10 on tens rod, plus 8 on ones rod. Result: 8.' },
    practiceQuestions: ['10-2', '11-2'],
    commonErrors: ['Subtracting wrong value from tens rod'],
  },
  {
    id: 'two-hand-sub-1',
    name: 'Two-Hand Helper: -1',
    operation: '-1',
    category: 'two-hand-helper',
    type: 'subtract',
    formula: '-10 +9',
    beadMovement: {
      callout: 'Minus 10, plus 9',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Add 9 to the current rod (set the rod to 9: 5 bead down + 4 bottom beads up)',
      ],
    },
    trigger: 'Subtracting 1 but current rod is at 0, one-hand helper not possible',
    example: { question: '10 - 1', startingValue: 10, endingValue: 9, working: 'Two-hand helper: minus 10 on tens rod, plus 9 on ones rod. Result: 9.' },
    practiceQuestions: ['10-1', '20-1', '30-1'],
    commonErrors: ['Not setting the current rod to 9 correctly'],
  },
]

// ============================================================================
// COMBINATION HELPERS (one-hand + two-hand together)
// ============================================================================

export const COMBINATION_ADD_RULES: SorobanRule[] = [
  {
    id: 'combo-add-9',
    name: 'Combination: +9',
    operation: '+9',
    category: 'combination',
    type: 'add',
    formula: '+4 -5 +10',
    beadMovement: {
      callout: '4 up, 5 up, plus 10',
      steps: [
        'Push 4 bottom beads up to touch the center beam (one-hand helper part)',
        'Push the 5 bead up away from the center beam (one-hand helper part)',
        'Add 10 by pushing 1 bottom bead up on the rod to the left (two-hand helper part)',
      ],
    },
    trigger: 'Adding 9 when the rod is at 5, 6, 7, 8, or 9 — two-hand helper needs minus 1, but minus 1 itself needs a one-hand helper because no bottom beads are free',
    example: { question: '5 + 9', startingValue: 5, endingValue: 14, working: 'Combination +9: 4 up, 5 up on ones rod, then plus 10 on tens rod. Result: 14.' },
    practiceQuestions: ['5+9', '6+9', '7+9', '8+9'],
    commonErrors: ['Getting the one-hand helper sequence wrong', 'Forgetting the plus 10 step'],
  },
  {
    id: 'combo-add-8',
    name: 'Combination: +8',
    operation: '+8',
    category: 'combination',
    type: 'add',
    formula: '+3 -5 +10',
    beadMovement: {
      callout: '3 up, 5 up, plus 10',
      steps: [
        'Push 3 bottom beads up to touch the center beam',
        'Push the 5 bead up away from the center beam',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 8 when the rod cannot do the two-hand helper minus 2 directly (needs one-hand for the -2)',
    example: { question: '5 + 8', startingValue: 5, endingValue: 13, working: 'Combination: 3 up, 5 up on ones rod (5→3), plus 10 on tens rod. Result: 13.' },
    practiceQuestions: ['5+8', '6+8', '7+8'],
    commonErrors: ['Mixing up which beads to push up vs down'],
  },
  {
    id: 'combo-add-7',
    name: 'Combination: +7',
    operation: '+7',
    category: 'combination',
    type: 'add',
    formula: '+2 -5 +10',
    beadMovement: {
      callout: '2 up, 5 up, plus 10',
      steps: [
        'Push 2 bottom beads up to touch the center beam',
        'Push the 5 bead up away from the center beam',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 7 when the two-hand helper minus 3 needs a one-hand helper',
    example: { question: '5 + 7', startingValue: 5, endingValue: 12, working: 'Combination: 2 up, 5 up on ones rod (5→2), plus 10 on tens rod. Result: 12.' },
    practiceQuestions: ['5+7', '6+7'],
    commonErrors: ['Confusing with two-hand helper +7 (minus 3, plus 10) when combination is needed'],
  },
  {
    id: 'combo-add-6',
    name: 'Combination: +6',
    operation: '+6',
    category: 'combination',
    type: 'add',
    formula: '+1 -5 +10',
    beadMovement: {
      callout: '1 up, 5 up, plus 10',
      steps: [
        'Push 1 bottom bead up to touch the center beam',
        'Push the 5 bead up away from the center beam',
        'Add 10 by pushing 1 bottom bead up on the rod to the left',
      ],
    },
    trigger: 'Adding 6 when the two-hand helper minus 4 needs a one-hand helper',
    example: { question: '5 + 6', startingValue: 5, endingValue: 11, working: 'Combination: 1 up, 5 up on ones rod (5→1), plus 10 on tens rod. Result: 11.' },
    practiceQuestions: ['5+6'],
    commonErrors: ['Not recognizing this as a combination situation'],
  },
]

export const COMBINATION_SUB_RULES: SorobanRule[] = [
  {
    id: 'combo-sub-9',
    name: 'Combination: -9',
    operation: '-9',
    category: 'combination',
    type: 'subtract',
    formula: '-10 +5 -4',
    beadMovement: {
      callout: 'Minus 10, 5 down, 4 down',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left (two-hand part)',
        'Push the 5 bead down to touch the center beam (one-hand part)',
        'Push 4 bottom beads down away from the center beam (one-hand part)',
      ],
    },
    trigger: 'Subtracting 9 when the two-hand helper plus 1 needs a one-hand helper (rod value is 0–4 with 5 bead up)',
    example: { question: '14 - 9', startingValue: 14, endingValue: 5, working: 'Combination: minus 10 on tens rod (1→0), 5 down, 4 down on ones rod (4→5). Result: 5.' },
    practiceQuestions: ['10-9', '11-9', '12-9', '13-9', '14-9'],
    commonErrors: ['Getting the one-hand helper direction wrong for the +1 part'],
  },
  {
    id: 'combo-sub-8',
    name: 'Combination: -8',
    operation: '-8',
    category: 'combination',
    type: 'subtract',
    formula: '-10 +5 -3',
    beadMovement: {
      callout: 'Minus 10, 5 down, 3 down',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Push the 5 bead down to touch the center beam',
        'Push 3 bottom beads down away from the center beam',
      ],
    },
    trigger: 'Subtracting 8 when the two-hand helper plus 2 needs a one-hand helper',
    example: { question: '13 - 8', startingValue: 13, endingValue: 5, working: 'Combination: minus 10 on tens rod, 5 down, 3 down on ones rod (3→5). Result: 5.' },
    practiceQuestions: ['10-8', '11-8', '12-8', '13-8'],
    commonErrors: ['Confusing helper count for the subtraction part'],
  },
  {
    id: 'combo-sub-7',
    name: 'Combination: -7',
    operation: '-7',
    category: 'combination',
    type: 'subtract',
    formula: '-10 +5 -2',
    beadMovement: {
      callout: 'Minus 10, 5 down, 2 down',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Push the 5 bead down to touch the center beam',
        'Push 2 bottom beads down away from the center beam',
      ],
    },
    trigger: 'Subtracting 7 when the two-hand helper plus 3 needs a one-hand helper',
    example: { question: '12 - 7', startingValue: 12, endingValue: 5, working: 'Combination: minus 10 on tens rod, 5 down, 2 down on ones rod (2→5). Result: 5.' },
    practiceQuestions: ['10-7', '11-7', '12-7'],
    commonErrors: ['Pushing down the wrong number of bottom beads'],
  },
  {
    id: 'combo-sub-6',
    name: 'Combination: -6',
    operation: '-6',
    category: 'combination',
    type: 'subtract',
    formula: '-10 +5 -1',
    beadMovement: {
      callout: 'Minus 10, 5 down, 1 down',
      steps: [
        'Subtract 10 by pushing 1 bottom bead down on the rod to the left',
        'Push the 5 bead down to touch the center beam',
        'Push 1 bottom bead down away from the center beam',
      ],
    },
    trigger: 'Subtracting 6 when the two-hand helper plus 4 needs a one-hand helper',
    example: { question: '11 - 6', startingValue: 11, endingValue: 5, working: 'Combination: minus 10 on tens rod, 5 down, 1 down on ones rod (1→5). Result: 5.' },
    practiceQuestions: ['10-6', '11-6'],
    commonErrors: ['Not recognizing this as a combination'],
  },
]

// ============================================================================
// SKIPPING (crossing 50 on a rod)
// ============================================================================

export const SKIPPING_RULES: SorobanRule[] = [
  {
    id: 'skip-10',
    name: 'Skipping (crossing 50)',
    operation: 'skip',
    category: 'skipping',
    type: 'add',
    formula: 'minus [complement] on ones rod, then 5 down [helper] down on tens rod',
    beadMovement: {
      callout: 'Minus [complement], skip 10',
      steps: [
        'Subtract the complement of the number being added from the current (ones) rod',
        'On the tens rod: push the 5 bead down and push the appropriate bottom beads down (like a one-hand helper on the tens rod)',
      ],
    },
    trigger: 'Adding a number that causes the tens rod to cross from 4 to 5 (crossing 50)',
    example: { question: '41 + 9', startingValue: 41, endingValue: 50, working: 'Minus 1 on ones rod (1→0). Skip 10 on tens rod: 5 down, 4 down (4→5, i.e. 40→50). Result: 50.' },
    practiceQuestions: ['41+9', '42+8', '43+7', '44+6', '45+5', '46+4', '47+3', '48+2', '49+1'],
    commonErrors: ['Forgetting to apply the skip on the tens rod', 'Confusing skip with jump'],
  },
  {
    id: 'reverse-skip-10',
    name: 'Reverse Skipping (crossing back over 50)',
    operation: 'reverse skip',
    category: 'reverse-skipping',
    type: 'subtract',
    formula: 'reverse skip on tens rod ([helper] up, 5 up), then plus [complement] on ones rod',
    beadMovement: {
      callout: 'Reverse skip 10, plus [complement]',
      steps: [
        'On the tens rod: push bottom beads up and push the 5 bead up (like a reverse one-hand helper on tens rod)',
        'Add the complement to the ones rod',
      ],
    },
    trigger: 'Subtracting a number that causes the tens rod to cross from 5 back to 4 (crossing below 50)',
    example: { question: '51 - 9', startingValue: 51, endingValue: 42, working: 'Reverse skip on tens rod: 4 up, 5 up (50→40). Plus 1 on ones rod (1→2). Result: 42.' },
    practiceQuestions: ['51-9', '52-8', '53-7', '54-6', '55-5', '56-4', '57-3', '58-2', '59-1'],
    commonErrors: ['Confusing the direction of bead movement on the tens rod'],
  },
]

// ============================================================================
// JUMPING (crossing 100, 1000, etc.)
// ============================================================================

export const JUMPING_RULES: SorobanRule[] = [
  {
    id: 'jump-100',
    name: 'Jumping (crossing 100)',
    operation: 'jump 100',
    category: 'jumping',
    type: 'add',
    formula: 'minus [complement] on ones rod, plus 100 (add 1 to hundreds rod), open the tens rod',
    beadMovement: {
      callout: 'Minus [complement], jump 100',
      steps: [
        'Subtract the complement from the ones rod',
        'The tens rod overflows: add 1 to the hundreds rod',
        'Open (clear) the tens rod — all beads away from the center beam',
      ],
    },
    trigger: 'Adding a number that causes the total to cross a hundreds boundary (e.g. 90s→100s)',
    example: { question: '92 + 9', startingValue: 92, endingValue: 101, working: 'Minus 1 on ones rod (2→1). The +10 on the tens rod causes a jump because tens is at 9: add 1 to hundreds rod, open tens rod. Result: 101.' },
    practiceQuestions: ['91+9', '92+8', '93+7', '94+6', '95+5', '96+4', '97+3', '98+2', '99+1'],
    commonErrors: ['Forgetting to open the middle rod', 'Not carrying to the correct higher rod'],
  },
  {
    id: 'jump-1000',
    name: 'Jumping (crossing 1000)',
    operation: 'jump 1000',
    category: 'jumping',
    type: 'add',
    formula: 'minus [complement] on ones rod, plus 1000, open both middle rods',
    beadMovement: {
      callout: 'Minus [complement], jump 1000',
      steps: [
        'Subtract the complement from the ones rod',
        'The carry cascades through tens and hundreds: add 1 to thousands rod',
        'Open (clear) both the tens rod and the hundreds rod',
      ],
    },
    trigger: 'Adding a number that causes the total to cross a thousands boundary',
    example: { question: '991 + 9', startingValue: 991, endingValue: 1000, working: 'Minus 1 on ones rod. Carry cascades: open tens, open hundreds, plus 1 on thousands. Result: 1000.' },
    practiceQuestions: ['991+9', '992+8', '993+7', '999+1'],
    commonErrors: ['Not opening all the middle rods', 'Only carrying to the next rod instead of cascading'],
  },
  {
    id: 'reverse-jump-100',
    name: 'Reverse Jumping (crossing back over 100)',
    operation: 'reverse jump 100',
    category: 'reverse-jumping',
    type: 'subtract',
    formula: 'minus 100 (subtract 1 from hundreds rod), close the tens rod (set to 9), plus [complement] on ones rod',
    beadMovement: {
      callout: 'Reverse jump 100, plus [complement]',
      steps: [
        'Subtract 1 from the hundreds rod',
        'Close the tens rod — set it to 9 (5 bead down + 4 bottom beads up)',
        'Add the complement to the ones rod',
      ],
    },
    trigger: 'Subtracting a number that causes the total to cross below a hundreds boundary',
    example: { question: '101 - 9', startingValue: 101, endingValue: 92, working: 'Minus 1 on hundreds rod (1→0). Close tens rod (set to 9). Plus 1 on ones rod (1→2). Result: 92.' },
    practiceQuestions: ['101-9', '102-8', '103-7', '100-1', '100-9'],
    commonErrors: ['Forgetting to set the middle rod to 9', 'Setting the middle rod to 0 instead of 9'],
  },
  {
    id: 'reverse-jump-1000',
    name: 'Reverse Jumping (crossing back over 1000)',
    operation: 'reverse jump 1000',
    category: 'reverse-jumping',
    type: 'subtract',
    formula: 'minus 1000, close both middle rods (set to 9), plus [complement] on ones rod',
    beadMovement: {
      callout: 'Reverse jump 1000, plus [complement]',
      steps: [
        'Subtract 1 from the thousands rod',
        'Close the hundreds rod — set it to 9',
        'Close the tens rod — set it to 9',
        'Add the complement to the ones rod',
      ],
    },
    trigger: 'Subtracting a number that causes the total to cross below a thousands boundary',
    example: { question: '1001 - 9', startingValue: 1001, endingValue: 992, working: 'Minus 1 on thousands rod. Close hundreds (set to 9). Close tens (set to 9). Plus 1 on ones rod (1→2). Result: 992.' },
    practiceQuestions: ['1001-9', '1000-1', '1000-9'],
    commonErrors: ['Not closing all middle rods', 'Setting middle rods to 0 instead of 9'],
  },
]

// ============================================================================
// RULE LOOKUP UTILITIES
// ============================================================================

/** All rules in a single flat array for easy searching */
export const ALL_RULES: SorobanRule[] = [
  ...DIRECT_RULES,
  ...ONE_HAND_HELPER_ADD_RULES,
  ...ONE_HAND_HELPER_SUB_RULES,
  ...TWO_HAND_HELPER_ADD_RULES,
  ...TWO_HAND_HELPER_SUB_RULES,
  ...COMBINATION_ADD_RULES,
  ...COMBINATION_SUB_RULES,
  ...SKIPPING_RULES,
  ...JUMPING_RULES,
]

/**
 * Determine which rule applies for a single-digit operation on one rod.
 *
 * @param currentValue - Current value on the rod (0–9)
 * @param operand - The number to add (positive) or subtract (negative)
 * @returns The matching SorobanRule, or the direct rule if no helper needed
 */
export function getRuleForOperation(currentValue: number, operand: number): SorobanRule {
  const result = currentValue + operand

  // ---- ADDITION ----
  if (operand > 0) {
    const n = operand
    const freeBottom = 4 - (currentValue % 5) // bottom beads available to push up
    const fiveBeadIsUp = currentValue < 5 // 5 bead not yet used

    // Can we just push beads directly?
    if (currentValue + n <= 9 && freeBottom >= n) {
      return DIRECT_RULES[0] // direct-add
    }

    // One-hand helper: need 5 bead, and n ≤ 4
    if (fiveBeadIsUp && n <= 4 && freeBottom < n) {
      const rule = ONE_HAND_HELPER_ADD_RULES.find((r) => r.operation === `+${n}`)
      if (rule) return rule
    }

    // Two-hand helper: result > 9, need to carry to next rod
    if (result > 9) {
      // Combination applies for +6,+7,+8,+9 when 5 bead is already down
      if (!fiveBeadIsUp && n >= 6 && n <= 9) {
        const comboRule = COMBINATION_ADD_RULES.find((r) => r.operation === `+${n}`)
        if (comboRule) return comboRule
      }
      // Standard two-hand helper
      const twoHandRule = TWO_HAND_HELPER_ADD_RULES.find((r) => r.operation === `+${n}`)
      if (twoHandRule) return twoHandRule
    }

    // Fallback for cases like pushing 5 bead down directly (e.g., 0+5)
    if (fiveBeadIsUp && n === 5) {
      return DIRECT_RULES[0] // direct: just push the 5 bead down
    }
  }

  // ---- SUBTRACTION ----
  if (operand < 0) {
    const n = Math.abs(operand)
    const bottomBeadsTouching = currentValue % 5 // bottom beads currently touching beam
    const fiveBeadIsDown = currentValue >= 5 // 5 bead is in use

    // Can we just push beads down directly?
    if (currentValue >= n) {
      // Check if we can do it without helpers
      if (n <= bottomBeadsTouching) {
        return DIRECT_RULES[1] // direct-sub
      }
      // If n > bottomBeadsTouching but 5 bead is down, might need one-hand
      if (fiveBeadIsDown && n <= 4) {
        const rule = ONE_HAND_HELPER_SUB_RULES.find((r) => r.operation === `-${n}`)
        if (rule) return rule
      }
      // If subtracting n and result is still on same rod (≥0), it's direct
      if (currentValue >= n) {
        return DIRECT_RULES[1] // direct-sub (may involve moving 5 bead)
      }
    }

    // Two-hand helper: need to borrow from next rod
    if (currentValue < n) {
      // Combination for -6, -7, -8, -9 when the plus-complement step needs one-hand
      if (n >= 6 && n <= 9 && !fiveBeadIsDown) {
        const comboRule = COMBINATION_SUB_RULES.find((r) => r.operation === `-${n}`)
        if (comboRule) return comboRule
      }
      // Standard two-hand helper
      const twoHandRule = TWO_HAND_HELPER_SUB_RULES.find((r) => r.operation === `-${n}`)
      if (twoHandRule) return twoHandRule
    }
  }

  // Fallback
  return operand > 0 ? DIRECT_RULES[0] : DIRECT_RULES[1]
}

export interface RodRule {
  /** 'ones', 'tens', 'hundreds', 'thousands' */
  rod: string
  /** Signed digit op applied on this rod */
  digitOperation: number
  /** The matching rule */
  rule: SorobanRule
  /** Current value on the rod before the operation */
  currentRodValue: number
}

/**
 * For a multi-digit addition/subtraction problem, return the sequence of
 * rules applied per rod, working left to right.
 */
export function getRulesForProblem(startingNumber: number, operand: number): RodRule[] {
  const rodNames = ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands']
  const result: RodRule[] = []

  const absOperand = Math.abs(operand)
  const maxDigits = Math.max(
    startingNumber.toString().length,
    absOperand.toString().length,
  )

  // Work left to right (largest place value first) — Brain-O-Magic rule
  for (let i = maxDigits - 1; i >= 0; i--) {
    const divisor = Math.pow(10, i)
    const currentDigit = Math.floor(startingNumber / divisor) % 10
    const operandDigit = Math.floor(absOperand / divisor) % 10

    if (operandDigit === 0) continue // nothing to do on this rod

    const digitOp = operand > 0 ? operandDigit : -operandDigit
    const rule = getRuleForOperation(currentDigit, digitOp)

    result.push({
      rod: rodNames[i] || `10^${i}`,
      digitOperation: digitOp,
      rule,
      currentRodValue: currentDigit,
    })
  }

  return result
}

// ============================================================================
// GET BETTER MODE: ERROR ANALYSIS
// ============================================================================

export interface ErrorAnalysis {
  rulesInvolved: SorobanRule[]
  likelyMistake: string
  correctionSteps: string[]
  practiceQuestions: string[]
}

/**
 * Given a question the child got wrong, analyze what rule they likely
 * misapplied and generate a corrective explanation.
 */
export function analyzeError(
  numbers: number[],
  childAnswer: number,
  correctAnswer: number,
): ErrorAnalysis {
  let running = 0
  const rulesUsed: SorobanRule[] = []
  const correctionSteps: string[] = []

  for (let idx = 0; idx < numbers.length; idx++) {
    const num = numbers[idx]
    if (idx === 0) {
      running = num
      correctionSteps.push(`Set ${num} on the abacus.`)
      continue
    }
    const rules = getRulesForProblem(running, num)
    rulesUsed.push(...rules.map((r) => r.rule))
    for (const r of rules) {
      correctionSteps.push(
        `On the ${r.rod} rod: ${r.rule.beadMovement.callout} (${r.rule.name})`,
      )
    }
    running += num
  }
  correctionSteps.push(`The answer is ${correctAnswer}.`)

  // Deduplicate rules
  const uniqueRules = rulesUsed.filter(
    (rule, idx, arr) => arr.findIndex((r) => r.id === rule.id) === idx,
  )

  // Determine likely mistake based on the difference
  const diff = childAnswer - correctAnswer
  let likelyMistake = 'The answer was incorrect.'

  if (Math.abs(diff) === 5) {
    likelyMistake =
      'It looks like you may have forgotten to move the 5 bead, or moved it when you should not have. Check your one-hand helpers!'
  } else if (Math.abs(diff) === 10) {
    likelyMistake =
      'It looks like you may have forgotten to carry to the tens rod, or carried when you should not have. Check your two-hand helpers!'
  } else if (Math.abs(diff) === 1) {
    likelyMistake = 'You were very close! You may have pushed one too many or one too few beads.'
  } else if (diff > 0) {
    likelyMistake = `Your answer was ${diff} too high. Check if you forgot to subtract the complement when using a helper.`
  } else {
    likelyMistake = `Your answer was ${Math.abs(diff)} too low. Check if you forgot to add the complement when using a helper.`
  }

  // Gather practice questions from the rules involved
  const practiceQuestions = uniqueRules
    .flatMap((r) => r.practiceQuestions)
    .filter((q, i, arr) => arr.indexOf(q) === i)
    .slice(0, 5)

  return {
    rulesInvolved: uniqueRules,
    likelyMistake,
    correctionSteps,
    practiceQuestions,
  }
}
