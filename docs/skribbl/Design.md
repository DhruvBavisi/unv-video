# SKRIBBL / DRAW & GUESS — Design

## Status
Implemented playable online mode.

## Design Direction
Cheerful, premium and playful. Do not use Undercover's black/gold investigation visual language.

## Core Layout
Prioritize:
1. drawing canvas
2. word/hint information
3. tools/colors
4. players/scores
5. chat and guess input

No horizontal overflow on mobile.

## Lobby
Support room creation/join, player roster, host configuration, room sharing, start and explicit leave.

## Drawing
Support touch/mouse drawing, synchronized strokes, canvas clearing between drawers, implemented palette/tools/fill behavior, and reconnect preservation during an active turn.

## Word Choice
The drawer gets private word choices. The word-choice timer is server-authoritative.

## Hints
Hints reveal characters progressively and must remain synchronized and private.

## Guess / Chat
Provide a clear mobile-visible input, readable history and correct-guess feedback. The input must remain visible above the virtual keyboard.

## Scores
Scores are server-authoritative. Round/result rankings are descending; dense lists may use compact columns.

## Results
Show word/reveal state, round points, final ranking and available next actions.

## Network Status Indicator
- Always-visible indicator across all Skribbl views (entry, lobby, gameplay phases).
- Three explicit connection states: `Connected` (mint/green), `Connecting` (pulsing amber/yellow), and `Disconnected` (coral).
- Styled as a compact status pill using `--sk-*` design variables with safe-area notch awareness, non-blocking click behavior (`pointer-events: none`), and responsive mobile collapse during active gameplay.

## Settings Panel — Room Sharing
- In-game Settings dialog displays a compact room code row above action buttons.
- Features a quick copy button with temporary visible confirmation (`COPIED!`) and graceful fallback.
- Features a QR button triggering `QRModal` with origin-flyout animations originating from the button rect, positioned strictly above the settings overlay.

## Accessibility
Keyboard-accessible controls, visible focus, >=16px form text, reduced motion and no color-only meaning.