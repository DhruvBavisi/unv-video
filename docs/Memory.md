# UNDERCOVER — Project Memory

> Living project state. Update this file during development.
> This is not the original requirements document.

## Current Phase
**Phase 11 — Core Game Rules, Roles & Word-Pair Data / Online Mode architecture planning**

The landing cinematic is treated as complete enough to begin the actual playable game. The existing landing implementation must remain isolated from gameplay state.

## Landing Project Status
The cinematic renders a **300-frame JPEG sequence** extracted across the 10-second timeline (`investigation-room-30fps`, frames 1–300). The source MP4 is genuinely 10.0 s / 24 fps / 240 frames (despite the "30fps" filename); the 300 frames are a 30 fps re-sample of the same 10 s visual timeline (frame n ↔ t = (n−1)/30 s).

Primary mapping:
`frameIndex = round(progress * (frameCount − 1)) + 1`

Character timing (authoritative 10 s visual timeline):
- 0.00–3.00s: establishing room; no labels.
- Civilian: focus 3.00–4.75s; label in ~3.35–3.45s, desc ~3.45s; text clears ~4.75s.
- Undercover: focus 4.75–7.25s; label in ~4.95–5.10s, desc ~5.10s; text clears ~7.27s.
- Mr. White: focus 7.25–8.90s; label in ~7.50–7.65s, desc ~7.65s; text clears ~8.90s.
- 8.90–10.00s: pull back to the wide room; no text.

Scroll sync: one weighted non-linear curve (`cinematicTimeline.js` `CHARACTER_SEGMENTS`); each character's label/description window sits inside its own scroll slow zone (2.4×/2.4×/2.2×); label and description reveal as two staggered elements (label → description → joint exit), driven purely by scroll progress — no timers.

The landing page uses one cinematic ScrollTrigger. MP4 is fallback only. No autoplay, timers, Lenis, wheel hijacking, or scroll interception.

## Existing Completed Landing & Responsive UI Work
- Phase 0: React + Vite scaffold, dependencies, structure, build/dev verification.
- Phase 1: assets verified.
- Phase 2: visual foundation.
- Phase 3: scroll-pinned cinematic.
- Phase 3H: 480-frame JPEG primary renderer, exact video-time mapping, fallback architecture, responsive base.
- Phase 4: character reveals driven by the same cinematic progress.
- Investigation presentation/evidence section exists as a non-gameplay presentation layer.
- Responsive Lobby UI Polish:
  - Fixed mobile player card clipping (`.online-player`) so "READY" status and badges remain fully visible on small screens.
  - Reduced player slider thumb size on smaller viewports (`max-width: 760px`/`480px`/`380px`) for sleek mobile handling.
  - Styled Word Category `<select>` input as a sharp rectangle (`border-radius: 0; appearance: none;`) on smaller screens to match Noir theme.
  - Replaced text button with custom responsive, accessible `Reveal Roles` toggle switch with gold accent track and smooth sliding knob.
  - Full-Screen Mobile Viewport & Top Extension: Maintained `viewport-fit=cover` in `index.html` and configured `.hero` with `min-height: 100dvh` so the Hero section seamlessly fills 100% of the mobile viewport height from top edge to bottom edge without shifting hero content/fonts upward or leaving a bottom gap.
  - Navbar & Hero Responsive Polish: Applied `padding-top: max(8px, env(safe-area-inset-top))` to `.nav`, hid text links on narrow mobile viewports (< 760px), and styled full-width stacked action buttons and proportional typography for `.hero` so the home page is 100% responsive and clean.

## New Game Design — Authoritative Rules

### Role shorthand
- `ci` = Civilian
- `uc` = Undercover
- `mw` = Mr. White

### Roles
Civilian receives the Civilian word.
Undercover receives a similar word.
Mr. White receives no word.


### Role visibility
- The host has a `Reveal Roles` setting in the lobby.
- Default is OFF to preserve a hidden role state for Civilian and Undercover.
- When ON, a local Civilian/Undercover may see their own role name, role-specific presentation, and role-specific avatar.
- When OFF, Civilian and Undercover are still assigned their actual roles but are intentionally not told what their role is.
- When OFF, hide the local role name, role description, role-specific color, and role-specific avatar; use a neutral presentation.
- The assigned Civilian/Undercover secret word remains available when roles are hidden.
- The actual role remains authoritative for role counting, clue/turn rules, elimination, Mr. White behavior, and win conditions.
- `Reveal Roles` is host-controlled and locks when the investigation starts.
- Public player state never reveals another player's role or role-specific avatar.
- Reconnection must restore the same role-visibility behavior.

### Role distribution
| Players | ci | uc | mw |
|---:|---:|---:|---:|
| 3 | 2 | 1 | 0 |
| 4 | 3 | 1 | 0 |
| 5 | 3 | 1 | 1 |
| 6 | 4 | 1 | 1 |
| 7 | 4 | 2 | 1 |
| 8 | 5 | 2 | 1 |
| 9 | 5 | 3 | 1 |
| 10 | 6 | 3 | 1 |
| 11 | 6 | 3 | 2 |
| 12 | 7 | 3 | 2 |
| 13 | 7 | 4 | 2 |
| 14 | 8 | 4 | 2 |
| 15 | 8 | 5 | 2 |
| 16 | 9 | 5 | 2 |
| 17 | 9 | 5 | 3 |
| 18 | 10 | 5 | 3 |
| 19 | 10 | 6 | 3 |
| 20 | 11 | 4 | 3 |

### Word pairs
A predefined generated list of similar word pairs will be supplied by the product owner and can be modified. The selected pair determines Civilian and Undercover words.

## Online Mode Flow (Updated)
`Name → Room/Lobby → Host Configuration → Start Investigation → Clue/Investigation Phase`
No separate role-reveal screen exists. Roles are assigned at investigation start and presented inside the existing CluePhase UI according to the locked `Reveal Roles` setting.

### Clues
- maximum 3 words
- duplicates prohibited for the entire investigation
- visible to everyone
- previous rounds preserved until investigation ends
- strict randomized sequence
- Round 1: Mr. White cannot be first
- Round 2+: Mr. White can be first

### Voting
- everyone active votes
- self-voting prohibited
- tied highest vote = no elimination + revote
- continue until unique highest-voted player

### Mr. White
Eliminated Mr. White gets an immediate free-text guess of Civilian word.
Correct = immediate Mr. White victory.
Incorrect = game continues.
Multiple Mr. Whites each receive their own applicable opportunity.
Mr. White surviving to a Civilian victory wins jointly with Civilians.

### Win Conditions
Undercover wins only when:
`UC > CI`
(strictly greater than among remaining active players).

Civilians win when all Undercover players are eliminated and no surviving Mr. White can change the outcome through a successful guess.

## Spectator / Join / Reconnect Rules
- eliminated players remain in room as spectators
- mid-game joiners become spectators
- mid-game joiners do not receive current role/word or current-round actions
- at next round boundary they automatically enter the room lobby/eligible pool
- player count updates automatically
- disconnected players can reconnect using the same Room ID and recover authoritative state
- stale/duplicate actions must be rejected

## Same Room Play Again
At Game Over, Play Again uses the same Room ID.
Players choosing Play Again return to the lobby.
Previous game state resets.
New roles and words are assigned.
No new Room ID is required.

## CSS Constraints
- Never set input/select/textarea/button font-size below 16px (iOS auto-zoom on tap)

## Development Phases — Gameplay
- Phase 11: Core rules, role distribution, word-pair data, authoritative state model.
- Phase 12: Online room/lobby and host controls.
- Phase 13: private role/word assignment.
- Phase 14: clues + chat.
- Phase 15: randomized clue order and round execution.
- Phase 16: voting, ties, elimination.
- Phase 17: Mr. White guess.
- Phase 18: spectators, mid-game joins, reconnect.
- Phase 19: win conditions and round loop.
- Phase 20: results and same-room Play Again.
- Phase 21: error handling and recovery.
- Phase 22: online gameplay UX/polish.
- Phase 23: online QA.
- Phase 24: Pass & Play (deferred until separately defined).

## Current Implementation Principle
Build Online Mode incrementally. First establish authoritative game rules/state and room lifecycle, then add each phase. Do not build Pass & Play yet.
