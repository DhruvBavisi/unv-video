# SKRIBBL / DRAW & GUESS — Architecture

## 1. Architectural Principle

The web app is one application containing multiple game modes.

The architectural boundary is:

> Shared platform infrastructure + isolated game engines.

Do not merge the Draw & Guess state machine into UNDERCOVER merely because both games use Socket.IO, rooms, players, timers, or a common UI.

```text
                         WEB APP
                            │
                     ┌──────▼──────┐
                     │  Mode Select │
                     └──────┬──────┘
                            │
               ┌────────────┴────────────┐
               │                         │
        ┌──────▼──────┐          ┌──────▼──────┐
        │  UNDERCOVER │          │ DRAW & GUESS│
        └──────┬──────┘          └──────┬──────┘
               │                         │
       Undercover State          Draw State
       Undercover Phases         Draw Phases
       Existing events           draw:* events
               │                         │
               └──────────┬──────────────┘
                          │
                 Shared Infrastructure
```

## 2. Client Structure

The existing source structure may vary. Preserve the current project conventions.

Recommended logical structure:

```text
src/
├── game/                         # existing UNDERCOVER
│   ├── gamePhases.*
│   ├── gameState.*
│   ├── roomState.*
│   └── components/
│
├── drawgame/                     # DRAW & GUESS
│   ├── gamePhases.*
│   ├── gameState.*
│   ├── roomState.*
│   ├── drawEvents.*
│   ├── scoring.*
│   └── components/
│
├── shared/
│   ├── socket.*
│   ├── room/
│   ├── moderation/
│   ├── audio/
│   ├── animation/
│   └── ui/
│
└── App.*
```

Do not create duplicate copies of genuinely shared utilities.

## 3. App-Level State

The application needs a mode-aware view boundary.

Conceptually:

```ts
type GameView =
  | "landing"
  | "mode-select"
  | "undercover"
  | "drawguess";
```

The actual implementation may use React Router, a state store, or the existing `gameView` approach.

Do not replace the existing navigation architecture unless required.

## 4. Server Isolation

Use separate active-room stores:

```text
rooms       → UNDERCOVER
drawRooms   → DRAW & GUESS
```

The stores have different lifecycles and state schemas.

Example:

```ts
const rooms = new Map<string, UndercoverRoom>();
const drawRooms = new Map<string, DrawRoom>();
```

Never insert Draw & Guess fields into the UNDERCOVER room type merely to share a Map.

## 5. Socket Isolation

The existing socket connection may be reused.

Draw & Guess events must use a `draw:` prefix.

Examples:

```text
draw:create-room
draw:join-room
draw:ready
draw:start
draw:word-choices
draw:choose-word
draw:phase
draw:stroke-start
draw:stroke-point
draw:stroke-end
draw:fill
draw:undo
draw:clear
draw:chat
draw:guess-result
draw:correct
draw:hint
draw:round-result
draw:game-result
draw:play-again
draw:reconnect
```

Do not reuse ambiguous events such as:

```text
submit-clue
vote
game:start
game:state
```

unless the existing architecture explicitly provides a typed, namespaced abstraction that guarantees mode isolation.

## 6. Room Identity

A room ID may remain the same application-level concept.

However, a room must have an explicit mode:

```ts
type GameMode = "undercover" | "drawguess";
```

A Draw & Guess join request must never accidentally resolve against an UNDERCOVER room with the same identifier.

If room IDs are globally unique, this is naturally safe. If IDs are scoped, mode must be included in the lookup.

## 7. Draw Room State

Recommended state:

```ts
interface DrawRoom {
  id: string;
  hostId: string;
  config: DrawRoomConfig;
  players: DrawPlayer[];
  phase: DrawPhase;
  round: number;
  turnOrder: string[];
  turnIndex: number;
  currentDrawerId: string | null;
  currentWord: string | null;
  revealedMask: boolean[];
  wordChoices: string[];
  strokes: DrawStroke[];
  guessedOrder: string[];
  roundStartAt: number | null;
  roundEndAt: number | null;
}
```

Private information should not live in the broadcast/public state object.

Prefer a private server-side representation:

```ts
interface DrawPrivateState {
  drawerId: string;
  currentWord: string;
  wordChoices: string[];
}
```

## 8. Player State

```ts
interface DrawPlayer {
  id: string;
  name: string;
  score: number;
  hasDrawnThisRound: boolean;
  guessedThisRound: boolean;
  guessTimestamp: number | null;
  connected: boolean;
  spectator: boolean;
}
```

Never send `currentWord` as part of this object.

## 9. Phase Machine

```text
LOBBY
 ↓
WORD_CHOICE
 ↓
DRAWING
 ↓
ROUND_REVEAL
 ↓
NEXT_DRAWER
 ├── more players → WORD_CHOICE
 └── all players → NEXT_ROUND
                     ├── more rounds → WORD_CHOICE
                     └── final round → GAME_RESULT
                                      ↓
                                  PLAY_AGAIN
```

The server owns phase transitions.

Clients render the state and request valid actions.

## 10. Word Privacy

The server selects the choice list.

Only the drawer receives:

```ts
{
  choices: string[]
}
```

The public room state receives neither the choices nor the current answer.

After the round ends, the answer can become public.

## 11. Canvas Synchronization

The drawer sends drawing operations.

The server:

1. Validates that the sender is the current drawer.
2. Validates basic payload shape and coordinate limits.
3. Appends the event to the current stroke log where applicable.
4. Broadcasts the valid event to other clients.

The server does not render or inspect pixels.

### Replay

A reconnecting client receives:

```text
draw:canvas-replay
```

containing the current round's stroke operations in order.

The client replays them locally.

## 12. Coordinate Contract

Use a normalized canvas coordinate system where practical:

```text
x: 0..1
y: 0..1
```

The client maps normalized coordinates to its actual canvas dimensions.

This prevents desktop/mobile canvas dimensions from corrupting replay behavior.

## 13. Guess Pipeline

```text
CLIENT
  │
  │ message
  ▼
SERVER
  │ normalize
  │ validate player/phase
  │ compare current word
  ├───────────────┐
  │               │
incorrect       correct
  │               │
  ▼               ▼
broadcast       system event
chat            + private success
```

The client must never determine correctness.

## 14. Timer Authority

Server stores timestamps:

```ts
roundStartAt
roundEndAt
wordChoiceDeadline
```

Clients display countdowns derived from server timestamps.

Do not make the game dependent on a client-side `setInterval` being perfectly synchronized.

When a client reconnects, it should calculate the remaining time from the server state.

## 15. Hint Authority

The server determines reveal timing and letter selection.

Clients receive only the updated public mask.

Example:

```text
_ _ _ _ _ _
      ↓
_ A _ _ _ _
```

Never send the unrevealed answer in a hidden client field.

## 16. Scoring Authority

Scoring is calculated only on the server.

The server records:

```text
guessTimestamp
guessedOrder
timeRemaining
```

and computes points using the centralized v1 scoring constants.

Clients receive awarded points as results.

## 17. Persistence

MongoDB should not be used as a high-frequency drawing event bus.

Recommended:

```text
Active Draw Game
     ↓
In-memory authoritative state
     ↓
Optional persistence for room/game metadata
```

The architecture should leave room for Redis/shared active-state storage later.

If game history is eventually persisted, store compact results rather than every drawing point by default.

## 18. Reconnect

A reconnecting player is identified through the existing application session/reconnect mechanism.

On reconnect:

1. Verify room membership.
2. Determine current phase.
3. Send public room state.
4. Send player-specific private state if authorized.
5. If currently viewing an active canvas, send stroke replay.
6. Do not resend another player's word choices.

## 19. Moderation Boundary

Shared moderation infrastructure may be reused, but all Draw & Guess actions must verify:

```text
room mode === drawguess
```

before mutating a Draw room.

## 20. Security Requirements

Validate:

- Room membership.
- Host privileges.
- Drawer privileges.
- Phase validity.
- Player status.
- Message length.
- Coordinate range.
- Stroke size range.
- Color format.
- Tool name.
- Rate limits for drawing events.
- Rate limits for chat/guess events.

Do not trust client timers, scores, roles, answers, or authorization claims.

## 21. Architectural Non-Goals

Do not:

- Put Draw & Guess fields into Undercover state.
- Reuse Undercover phase constants for Draw & Guess.
- Broadcast the current word to the room.
- Use polling for drawing.
- Send full canvas screenshots repeatedly.
- Rewrite the existing socket connection solely for Draw & Guess.
- Redesign the Undercover game to accommodate the new mode.

## 22. Integration Rule

If a change is needed by both games, first determine whether it is genuinely shared infrastructure.

If it is game-specific, keep it inside the appropriate mode.

```text
Shared because the concept is shared.
Separate because the rules are separate.
```
