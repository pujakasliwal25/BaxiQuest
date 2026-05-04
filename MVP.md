Here it is — copy everything below this line:

---

> # Baxi Quest MVP — Claude Code Brief
> **by Brain-O-Magic**
>
> Build a web app using **React 18 + TypeScript + Vite + Tailwind CSS**. This is an MVP to test today with real children ages 5–13. Structure everything so Firebase, additional levels, and an admin panel can be added later without refactoring. Use clean component separation from the start. No backend required for this MVP.
>
> ---
>
> ## What NOT to build
> Do not build any of these — they come in later phases:
> - Firebase or any database
> - Real user accounts or authentication
> - Leaderboard
> - Coin store or rewards
> - Get Better Mode / AI correction
> - Admin UI panel
> - Multiply or Divide modes
> - Baxi animations (static Baxi SVG only for now)
> - Vertical or Callout question formats
>
> ---
>
> ## Folder Structure
> ```
> src/
>   components/
>     Baxi.tsx
>     TimerBar.tsx
>     QuestionDisplay.tsx
>     AnswerInput.tsx
>     FeedbackOverlay.tsx
>   screens/
>     LoginScreen.tsx
>     ModeSelectScreen.tsx
>     LevelInfoCard.tsx
>     QuestionScreen.tsx
>     RoundSummary.tsx
>   config/
>     gameConfig.ts
>   hooks/
>     useGameState.ts
>     useSpeechInput.ts
>   utils/
>     questionGenerator.ts
>   App.tsx
> ```
>
> **Critical rule:** All game progression logic lives in `useGameState.ts`. All question generation lives in `questionGenerator.ts`. Screen components only render and call hooks — zero logic in screen files. This makes Firebase integration straightforward later.
>
> ---
>
> ## Config File: `src/config/gameConfig.ts`
> ```ts
> export const GAME_CONFIG = {
>   correctInARowNeeded: 3,      // hardcoded now, admin-configurable later
>   startNumberCount: 3,          // start with 3 numbers per question
>   maxNumberCount: 15,           // go up to 15 numbers per question
>   questionsPerRound: 10,        // show round summary every 10 questions
>   validClassCodes: ['BAXI2024'],
> }
> ```
>
> ---
>
> ## Timer Rule
> **Timer is computed per question based on the actual digits of the numbers generated, not a fixed formula.**
>
> ```ts
> // In questionGenerator.ts, after generating the numbers array:
> const timerSeconds = numbers.reduce(
>   (sum, n) => sum + n.toString().length,
>   0
> )
> ```
>
> Examples:
> - `1 + 23 + 394` → 1+2+3 = **6 seconds**
> - `7 + 8 + 4` → 1+1+1 = **3 seconds**
> - `12 + 45 + 67` → 2+2+2 = **6 seconds**
> - `5 + 23 + 4 + 156 + 8` → 1+2+1+3+1 = **8 seconds**
>
> This applies to all digit types including mixed. Always use the actual numbers generated, never an estimate.
>
> ---
>
> ## Progression Logic
> ```ts
> // State managed in useGameState.ts
> consecutiveCorrect = 0
> currentNumberCount = GAME_CONFIG.startNumberCount  // starts at 3
>
> // On correct answer:
> consecutiveCorrect++
> if (consecutiveCorrect >= GAME_CONFIG.correctInARowNeeded) {
>   consecutiveCorrect = 0
>   if (currentNumberCount < GAME_CONFIG.maxNumberCount) {
>     currentNumberCount++
>     // show LevelInfoCard for new count before next question
>   }
> }
>
> // On wrong answer:
> consecutiveCorrect = 0
> // stay on same currentNumberCount, continue
> ```
>
> ---
>
> ## Digit Types
> The child selects one of 7 digit types on the Mode Select screen. This controls what numbers are generated per question.
>
> | Digit Type | Range per number |
> |---|---|
> | 1-digit | 1–9 |
> | 2-digit | 10–99 |
> | 3-digit | 100–999 |
> | 4-digit | 1000–9999 |
> | 1 & 2-digit mixed | randomly 1–9 or 10–99 per number |
> | 2 & 3-digit mixed | randomly 10–99 or 100–999 per number |
> | 1, 2 & 3-digit mixed | randomly 1–9, 10–99, or 100–999 per number |
>
> For mixed types, each number in the question independently picks its digit range at random.
>
> ---
>
> ## Question Generator: `src/utils/questionGenerator.ts`
> ```ts
> export type DigitType =
>   | '1-digit'
>   | '2-digit'
>   | '3-digit'
>   | '4-digit'
>   | '1-2-mixed'
>   | '2-3-mixed'
>   | '1-2-3-mixed'
>
> export interface Question {
>   numbers: number[]       // e.g. [5, 23, 394]
>   answer: number          // sum of all numbers
>   display: string         // e.g. "5 + 23 + 394 = ?"
>   timerSeconds: number    // sum of digit counts of all numbers
> }
>
> function randomInRange(min: number, max: number): number {
>   return Math.floor(Math.random() * (max - min + 1)) + min
> }
>
> function generateNumber(digitType: DigitType): number {
>   const ranges = {
>     '1-digit':    [1, 9],
>     '2-digit':    [10, 99],
>     '3-digit':    [100, 999],
>     '4-digit':    [1000, 9999],
>     '1-2-mixed':  [[1,9],[10,99]][Math.floor(Math.random()*2)],
>     '2-3-mixed':  [[10,99],[100,999]][Math.floor(Math.random()*2)],
>     '1-2-3-mixed':[[1,9],[10,99],[100,999]][Math.floor(Math.random()*3)],
>   }
>   const [min, max] = ranges[digitType]
>   return randomInRange(min, max)
> }
>
> export function generateQuestion(
>   digitType: DigitType,
>   numberCount: number
> ): Question {
>   const numbers = Array.from({ length: numberCount }, () =>
>     generateNumber(digitType)
>   )
>   const answer = numbers.reduce((sum, n) => sum + n, 0)
>   const display = numbers.join(' + ') + ' = ?'
>   const timerSeconds = numbers.reduce(
>     (sum, n) => sum + n.toString().length, 0
>   )
>   return { numbers, answer, display, timerSeconds }
> }
> ```
>
> ---
>
> ## Screen 1 — Login Screen
> - Dark navy background `#0A1628`
> - Centered layout with Baxi SVG at top
> - Gold pill label "BAXI QUEST" above Baxi
> - Subtitle: "by Brain-O-Magic" in muted white
> - Two inputs: Class Code and First Name
> - Button: "Let's Go!" — gold background `#FFD000`, dark text, full width, rounded
> - Validation: class code must match one in `GAME_CONFIG.validClassCodes` (case-insensitive)
> - On success: store name in React state, navigate to Mode Select
> - On failure: show inline error "Oops! Check your class code"
>
> ---
>
> ## Screen 2 — Mode Select Screen
> - Greeting: "Hi [name]! Ready to quest?" in large white bold text
> - Baxi SVG shown smaller, to the right of the greeting
> - Section: "Choose your mode" — one card: **Add & Subtract** (red `#E8192C`)
> - Section below: "Choose your digit level" — 7 pill buttons in a grid:
>   - 1-digit, 2-digit, 3-digit, 4-digit
>   - 1 & 2-digit mixed, 2 & 3-digit mixed, 1, 2 & 3-digit mixed
> - Tapping a digit pill immediately starts the game with that digit type
> - Selected digit pill highlights in gold `#FFD000` with dark text
>
> ---
>
> ## Screen 3 — Level Info Card
> Shown before the first question whenever `currentNumberCount` increases.
> - Title: "Next level unlocked!"
> - Body: "Now adding [N] numbers at a time"
> - Show an example question with the current digit type and new count (generated but not scored)
> - Timer preview: "You'll have [X] seconds per question"
> - Button: "Let's go!" — starts the next question
>
> ---
>
> ## Screen 4 — Question Screen
> - Top: progress indicator — "Question [X] of [questionsPerRound]" and consecutive correct counter "✓ [N] in a row"
> - Timer bar below that: full width, shrinks left to right, color transitions green → yellow → red
> - When timer hits 0: mark as wrong, show feedback, move on
> - Large question display, **right-aligned**:
>   ```
>   5 + 23 + 394 = ?
>   ```
>   Font size large enough for a 5-year-old — minimum 32px, scale up for short questions
> - Answer box below question: right-aligned, large, bordered in `#0057A8`, supports up to 15 digits, placeholder "your answer"
> - Two buttons at bottom, full width, stacked:
>   - **Speak** (background `#E8192C`, white text, microphone icon)
>     - Uses Web Speech API
>     - On tap: start listening, show "Listening…" state
>     - On result: populate answer box with recognized number
>     - Child taps Speak again or Check to confirm
>   - **Type** (dark background, muted border)
>     - On tap: focus the answer input, trigger native keyboard
>     - Child types and taps Done on keyboard or a Check button that appears
> - Check / submit logic: compare child's answer (as integer) to `question.answer`
>
> ---
>
> ## Screen 5 — Feedback Overlay
> Full-screen overlay, auto-dismisses after 1.5 seconds then loads next question.
>
> **Correct:**
> - Green overlay `#1B8A4C`
> - Large checkmark
> - "+ streak [N] in a row!" if consecutiveCorrect > 1
> - "Level up! Now [N] numbers!" if just advanced
>
> **Wrong:**
> - Red overlay `#E8192C`
> - Correct answer shown large: "The answer was [X]"
> - Consecutive streak resets to 0
>
> ---
>
> ## Screen 6 — Round Summary
> Shown after every `questionsPerRound` questions.
>
> - Score: "[X] correct out of [questionsPerRound]"
> - Current level: "You're on [N]-number questions!"
> - Consecutive correct carried over (streak does not reset between rounds)
> - Two buttons:
>   - **Play Again** — continues with same digit type and current number count
>   - **Change Digit Level** — goes back to Mode Select, resets number count to 3
>
> ---
>
> ## Baxi SVG Component: `src/components/Baxi.tsx`
> Pure stick figure. Accept a `size` prop (default 100). Scale all coordinates proportionally.
>
> Draw exactly:
> - **Abacus frame**: outline-only rectangle, no fill, stroke `#29B6E8`, stroke-width 3, rounded corners rx=6
> - **4 vertical rods**: thin lines `#29B6E8` inside the frame, evenly spaced
> - **Divider bar**: horizontal line `#FFD000` across the middle of the frame, stroke-width 2.5
> - **Top beads**: small filled circles `#FFD000` on each rod above the divider
> - **Bottom beads**: small filled circles `#E8192C` on each rod below the divider
> - **Left arm**: thick line `#29B6E8` stroke-width 4, extending left from frame, stroke-linecap round
> - **Right arm**: thick line `#29B6E8` stroke-width 4, extending right from frame, stroke-linecap round
> - **Left leg**: thick line `#29B6E8` stroke-width 4, extending down-left from bottom of frame
> - **Right leg**: thick line `#29B6E8` stroke-width 4, extending down-right from bottom of frame
> - **Feet**: short horizontal lines at end of each leg, stroke-linecap round
> - **No face, no separate head**
>
> ---
>
> ## Design System
> ```
> Background:    #0A1628  (all screens)
> Baxi Blue:     #29B6E8  (Baxi character)
> Deep Blue:     #0057A8  (input borders, accents)
> Magic Gold:    #FFD000  (primary CTA, coins, badges)
> Quest Red:     #E8192C  (Add & Subtract, wrong feedback, Speak button)
> Level Green:   #1B8A4C  (correct feedback, level up)
> Text primary:  #FFFFFF
> Text muted:    rgba(255,255,255,0.45)
> Card surface:  rgba(255,255,255,0.06)
> Card border:   rgba(255,255,255,0.10)
> Border radius: 14px for cards, 10px for buttons, 20px for pills
> ```
>
> All text minimum 16px. Question display minimum 32px. Buttons minimum 52px tall (touch-friendly for small fingers).
>
> ---
>
> ## Web Speech API: `src/hooks/useSpeechInput.ts`
> ```ts
> // Wrap SpeechRecognition in a hook
> // Return: { isListening, transcript, startListening, stopListening, supported }
> // Set recognition.lang = 'en-US'
> // Set recognition.interimResults = false
> // Set recognition.maxAlternatives = 1
> // Parse result as integer using parseInt(transcript.trim())
> // Handle not-supported gracefully: if unsupported, hide Speak button entirely
> ```
>
> ---
>
> ## What to hardcode for now (make easy to change later)
> - Class code: `BAXI2024`
> - Correct in a row needed: `3`
> - Questions per round: `10`
> - Start number count: `3`
> - Max number count: `15`
> - All of these live only in `src/config/gameConfig.ts` — never hardcoded inline in components
>
> ---
>
> ## After building, run and verify:
> 1. Login with code `BAXI2024` and any name
> 2. Select 1-digit, confirm 3 numbers appear in first question
> 3. Answer 3 correctly in a row — confirm Level Info Card appears saying "4 numbers"
> 4. Answer one wrong — confirm streak resets to 0, number count stays at 4
> 5. Check timer on `1 + 23 + 394` = 6 seconds exactly
> 6. Check timer on `7 + 8 + 4` = 3 seconds exactly
> 7. Test Speak button in Chrome — confirm it populates the answer box
> 8. After 10 questions, confirm Round Summary appears
