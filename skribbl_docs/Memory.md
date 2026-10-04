# SKRIBBL / DRAW & GUESS — Project Memory

> Living project state for AI coding agents.
> Read this before making significant Draw & Guess changes.
> Update after meaningful implementation or architectural decisions.
> Do not invent completed work.

## 0. Global Mobile UX Polish
A cross-game mobile input fix (`useMobileKeyboardFocus`) has been successfully integrated. All user text inputs (Create Room Name, Join Room Code, Join Name, and Drawing Guess inputs) are now guaranteed to scroll into the active visual viewport upon focus, ensuring players on iOS do not have their inputs hidden beneath the virtual keyboard.

## 1. Product Relationship

The application contains two separate game modes:

```text
UNDERCOVER
DRAW & GUESS
```

They are part of the same web application and share platform infrastructure.

They are NOT one combined game engine.

The primary architectural rule is:

> Shared infrastructure, isolated game state.

## 2. Existing Undercover Boundary

UNDERCOVER already has its own:

- game state,
- phase machine,
- room lifecycle,
- socket event semantics,
- rules,
- gameplay UI,
- moderation behavior.

Do not modify these simply to accommodate Draw & Guess.

Before changing shared code, verify that the code is genuinely mode-agnostic.

## 3. Draw & Guess Boundary

Recommended module:

```text
src/drawgame/
```

Server state:

```text
drawRooms
```

Socket events:

```text
draw:*
```

Do not reuse ambiguous Undercover events.

## 4. Application Navigation

Conceptual application views:

```text
landing
mode-select
undercover
drawguess
```

The exact implementation should follow the existing application architecture.

## 5. Draw Phases

```text
LOBBY
→ WORD_CHOICE
→ DRAWING
→ ROUND_REVEAL
→ NEXT DRAWER
→ NEXT ROUND
→ GAME_RESULT
→ PLAY_AGAIN
```

The server is authoritative.

## 6. Room Configuration

```ts
players
drawTimeSec
rounds
wordCount
hints
gameMode
customWords
useCustomOnly
```

Modes:

```text
normal
hidden
combination
```

## 7. Player State

```text
id
name
score
hasDrawnThisRound
guessedThisRound
guessTimestamp
connected
spectator
```

## 8. Word Privacy

The drawer alone receives:

```text
wordChoices
currentWord
```

The current word must not be included in public state before round reveal.

The server validates guesses.

## 9. Word Rules

- Choices are server-selected.
- Choices are private to the drawer.
- Selected words cannot repeat within a game.
- Word choice timeout is approximately 15 seconds.
- Timeout automatically selects a presented word.
- `hidden` mode has no letter reveals.
- `normal` and `combination` may reveal configured hints.

## 10. Drawing

Drawer is the sole source of drawing input.

Events:

```text
draw:stroke-start
draw:stroke-point
draw:stroke-end
draw:fill
draw:undo
draw:clear
```

The server validates authorization and payload shape, then relays valid events.

The server does not judge art.

## 11. Canvas Recovery

Current canvas is represented by a stroke/event log.

Reconnect behavior:

```text
receive current public state
→ receive permitted private state
→ receive current canvas event log
→ replay locally
```

Do not use continuous raster snapshots as the synchronization mechanism.

## 12. Guessing

All guesses go through the server.

Normalization:

```text
trim
lowercase
```

Incorrect guess:

```text
normal chat
```

Correct guess:

```text
system announcement
+
private success event
```

Never broadcast the actual correct message.

## 13. Scoring

Initial formula:

```text
round(500 * timeRemaining / drawTimeSec) * multiplier
```

Multipliers:

```text
1st = 1.00
2nd = 0.80
3rd = 0.65
4th+ = 0.50
```

Minimum positive award:

```text
50
```

Drawer:

```text
round(sum(guesserPoints) * 0.5)
```

If nobody guesses:

```text
0 for everyone
```

Keep scoring constants centralized for later playtesting.

## 14. Turn Rules

Every eligible player draws exactly once per round.

Turn order is server-shuffled per round.

No duplicate player turns within a round.

## 15. Reconnect / Late Join

Use the existing application's proven spectator-until-next-round pattern.

Mid-game joiners:

- do not alter the current turn order,
- do not receive the current private word,
- become eligible at the next valid round.

Reconnect must not restart the current timer or turn.

## 16. Moderation

Reuse existing host-authority infrastructure where safe.

Draw-specific event names remain namespaced:

```text
draw:kick
draw:mute
draw:report
draw:votekick
```

## 17. Visual Direction

Draw & Guess must feel like the same product as Undercover.

Preserve:

- existing cards,
- existing transitions,
- typography,
- tactile controls,
- animation language,
- sound architecture,
- theme,
- responsive behavior.

Do not redesign Undercover to make the Draw mode fit.

Draw-specific additions:

- canvas,
- drawing toolbar,
- colors,
- brush size,
- eraser,
- drawing-focused score layout.

## 18. Current Implementation State

Initial documentation state:

```text
Draw & Guess implementation: NOT STARTED
Documentation: DEFINED
Undercover integration boundary: DEFINED
```

Do not mark phases complete until verified in the actual repository.

## 19. Agent Workflow

Before a significant change:

1. Read this file.
2. Read `PRD.md`.
3. Read `Architecture.md`.
4. Read `Rules.md`.
5. Read `Phases.md`.
6. Read `Design.md`.
7. Inspect the existing implementation.
8. Make the smallest correct change.
9. Test the new behavior.
10. Regression-test Undercover.
11. Update this file.

## 20. Never Do

- Do not expose current words to unauthorized clients.
- Do not trust client scoring.
- Do not trust client answer validation.
- Do not mix Draw rooms with Undercover rooms.
- Do not remove the `draw:` event boundary.
- Do not use polling for canvas synchronization.
- Do not rewrite the existing socket layer unnecessarily.
- Do not break existing Undercover UI.
- Do not replace proven shared infrastructure with duplicate implementations without a reason.
- Do not claim an implementation phase is complete without verification.

## 21. Agent Log

### 2026-09-29

**Completed**
- Phase 7 — Canvas Foundation (Brush, Eraser, Clear, Undo, Color, Size).
- Integrated `globalCompositeOperation` for eraser support.
- Centralized tool state in DrawingPhase.
- Phase 9 — Game Flow & Scoring (Hints + early round completion + delayed score reveal).
- Added `isComplete` flag to stream partial updates efficiently while ensuring accurate full-stroke recovery.

**Decisions**
- Configured hints via `updateRoomHintString` and `room.hintTimer` with intervals correctly calculated based on `room.configuration.hints` and `drawTimeSec`.
- Early turn completion implemented directly inside `draw:guess` by clearing timeouts and calling `endDrawRound` if all eligible guessers succeed.
- Scores decoupled: calculations run immediately but `player.score` mutation and display happen explicitly at `ROUND_REVEAL`.

**Problems**
- Fixed a Socket.IO serialization crash when the drawer selected a word. `room.turnTimeout` and `room.hintTimer` were inadvertently broadcasted to clients because `getSafeStateForPlayer()` used `...room`. These timer handles are server-only and must never be included in the client room state.

**Tests**
- Undercover tests failed due to unrelated known Phase 27 base game assertions. Draw tests 62/62 passed.
- Vite build completes cleanly.

**Next**
- Phase 10 — Polish & Leaderboard

### 2026-09-30

**Completed**
- Added centralized, adjustable height layout variables (`CANVAS_FLEX` and `INFO_PANEL_FLEX`) for the drawing screen, allowing an automatic inverse height relationship without modifying CSS structure.
- Refactored the `ROUND_REVEAL` score list to use CSS column layout (`columnCount: 2`, `columnWidth`) enabling a responsive two-column score layout.
- Round-reveal points list is now ordered by `turnScores` in a descending manner (stable sorting to preserve ties) without affecting the total game score leaderboards.
- Fixed stale hint bug: Explicitly reset `room.hint` and `room.hintRevealed` when transitioning to `ROUND_REVEAL` and when initiating the next `WORD_CHOICE` turn to prevent hints from leaking across game states.
