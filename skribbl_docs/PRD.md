# SKRIBBL / DRAW & GUESS — Product Requirements Document

## 1. Product

SKRIBBL / DRAW & GUESS is a second multiplayer game mode integrated into the existing UNDERCOVER web application.

The web app remains one product and one deployment. Users enter the same landing experience, select a game mode, and then enter the corresponding gameplay state machine:

```text
LANDING
   ↓
MODE SELECT
   ├── UNDERCOVER
   └── DRAW & GUESS
```

UNDERCOVER and DRAW & GUESS are separate games with separate gameplay state, rules, phases, and server room stores. They share application infrastructure where that infrastructure is genuinely mode-agnostic.

## 2. Product Goal

Add a polished drawing-and-guessing multiplayer game without destabilizing or redesigning the existing UNDERCOVER game.

The experience should feel like a natural second mode of the same game platform rather than a separate website.

Primary goals:

- Fast room creation and joining.
- Anonymous guest play.
- 2–20 players by default, subject to server-safe limits.
- Server-authoritative game progression.
- Private word choices for the active drawer.
- Smooth real-time drawing synchronization.
- Server-authoritative answer validation.
- Clear, responsive scoring.
- Reliable reconnect and late-join behavior.
- Same-room Play Again flow.
- Shared visual language with UNDERCOVER.
- Mobile-friendly controls without sacrificing desktop drawing quality.

## 3. Existing Application Integration

Do not replace the existing UNDERCOVER architecture.

The application gains a mode-selection boundary:

```text
App.jsx
├── landing
├── mode-select
├── undercover
└── drawguess
```

The exact implementation may use an existing routing/state mechanism if one is already present. Do not introduce a second routing architecture unnecessarily.

Shared infrastructure may include:

- Socket connection.
- Connection/reconnect handling.
- Room-code / URL / QR join mechanisms.
- Host identity infrastructure.
- Moderation infrastructure.
- Common player identity handling.
- Shared UI primitives.
- Shared animation utilities.
- Shared audio service.
- Shared theme/design tokens.

Draw & Guess must own:

- Draw room state.
- Draw game phases.
- Draw scoring.
- Word choice.
- Drawing event semantics.
- Guess validation.
- Drawing timers.
- Hint/reveal logic.
- Draw-specific moderation actions where event names are mode-specific.

## 4. Core Game Configuration

A room configuration contains:

```ts
interface DrawRoomConfig {
  players: number;
  drawTimeSec: number;
  rounds: number;
  wordCount: number;
  hints: number;
  gameMode: "normal" | "hidden" | "combination";
  customWords: string[];
  useCustomOnly: boolean;
}
```

Recommended initial safe ranges:

| Setting | Initial range |
|---|---:|
| Players | 2–20 |
| Draw time | 30–180 sec |
| Rounds | 1–10 |
| Word choices | 1–5 |
| Hints | 0–5 |
| Custom words | server-configured safe maximum |

The server validates all configuration values.

## 5. Word Modes

### Normal

Letters are progressively revealed during the drawing timer.

### Hidden

No scheduled letter reveal occurs.

Players see only the word length and preserved spaces.

### Combination

Words may come from both the default word list and the configured custom word list.

If `useCustomOnly` is true, selection must come exclusively from custom words.

## 6. Game Flow

```text
LOBBY
  ↓
WORD_CHOICE
  ↓
DRAWING
  ↓
ROUND_REVEAL
  ↓
NEXT DRAWER
  ↓
...
  ↓
NEXT ROUND
  ↓
...
  ↓
GAME_RESULT
  ↓
PLAY_AGAIN
```

Every player draws exactly once per round.

The server creates a turn order for each round. A player does not receive a second turn in the same round unless the product rules are explicitly changed later.

## 7. Word Choice

At the start of a drawer's turn:

1. Server selects `wordCount` unique eligible words.
2. Server sends the choices only to the drawer.
3. Other clients never receive the choice list.
4. Drawer selects one word.
5. Unselected words are discarded.
6. The selected word becomes authoritative server state.
7. The selected word is removed from the game's reusable word pool.

If the drawer does not choose before the approximately 15-second selection timeout:

- Server automatically chooses one of the presented choices.
- Drawing begins.
- The room must never remain stalled because the drawer did not respond.

## 8. Drawing

The drawer is the sole source of drawing input.

The server does not interpret pixels or attempt to judge artistic correctness.

The server validates event authorization and relays valid drawing events.

Supported event types:

```text
draw:stroke-start
draw:stroke-point
draw:stroke-end
draw:fill
draw:undo
draw:clear
```

A stroke event includes only the data required to reproduce the canvas:

```ts
{
  tool,
  color,
  size,
  x,
  y
}
```

Points contain normalized or agreed-upon canvas coordinates.

The server retains the stroke log for the active round so reconnecting/late-viewing clients can replay the current canvas.

## 9. Guessing

There is one combined chat channel.

Every submitted message is sent to the server and normalized:

```text
trim()
toLowerCase()
```

The server compares the normalized answer against the authoritative current word.

Never trust a client-provided `correct: true` flag.

### Incorrect Guess

Broadcast normally as a chat message.

### Correct Guess

Do not broadcast the actual message.

Broadcast a system event such as:

```text
PlayerName guessed the word!
```

Send a private success event to the correct player:

```text
✓ Correct!
```

The drawer and players who already guessed correctly cannot continue scoring guesses for the current word.

Their later messages may be treated as normal chat.

## 10. Optional Close-Guess Feature

Not required for v1.

A future version may privately indicate that a guess is close when Levenshtein distance is ≤2.

This must never reveal the answer or expose distance information to other players.

## 11. Hint System

For `normal` and `combination` modes:

```text
drawTimeSec / (hints + 1)
```

defines the reveal windows.

At each reveal boundary:

- Reveal one random still-hidden letter.
- Preserve spaces.
- Do not reveal an already visible letter.
- Avoid repeatedly selecting the first/last position where practical.
- Never reveal more letters than the configured hint count.

`hidden` mode skips the reveal schedule entirely.

## 12. Scoring

The initial v1 scoring proposal is:

```text
guesserPoints =
  round(500 * (timeRemaining / drawTimeSec)) * orderMultiplier
```

Order multipliers:

```text
1st = 1.00
2nd = 0.80
3rd = 0.65
4th+ = 0.50
```

Apply a minimum practical award of 50 points where the formula produces a lower positive value.

Drawer score:

```text
drawerPoints =
  round(sum(all awarded guesser points) * 0.5)
```

If nobody guesses correctly:

- No guesser scores.
- Drawer receives no score for that word.

These constants are intentionally centralized so they can be tuned after playtesting.

## 13. Round Reveal

After drawing time expires or the word is otherwise resolved:

- Stop accepting scoring guesses.
- Reveal the answer.
- Show the round score/result.
- Hold the result for approximately 5 seconds.
- Clear the current canvas.
- Advance to the next drawer.

The reveal must not interfere with the entry/exit animations of other game UI components.

## 14. Game Result

After the configured number of rounds:

- Stop gameplay.
- Calculate the final leaderboard.
- Sort by total score descending.
- Display all participating players.
- Show the final word/result information appropriate to the product design.
- Provide PLAY AGAIN.

PLAY AGAIN reuses the same room ID, matching the existing UNDERCOVER room-reset pattern.

## 15. Late Join / Reconnect

Follow the existing game's proven spectator-until-next-round behavior.

A player joining during an active game:

- Does not become an active drawer immediately.
- Does not modify the current round turn order.
- Enters as a spectator/pending player.
- Becomes eligible at the next valid round according to room rules.

A reconnecting existing player should recover their current permitted state without receiving another player's private word.

The current canvas can be recovered by replaying the current round's stroke log.

## 16. Moderation

Reuse the application's host-authority model where possible.

Mode-specific events must use the `draw:` prefix.

Examples:

```text
draw:kick
draw:mute
draw:report
draw:votekick
```

If the shared moderation implementation already has generic infrastructure, it may remain shared internally while client/server event contracts remain unambiguous.

## 17. Non-Functional Requirements

- No client-authoritative scoring.
- No client-authoritative answer validation.
- No broadcasting private word choices.
- No polling for drawing synchronization.
- No raster screenshot broadcast for every drawing update.
- No changes to existing UNDERCOVER socket semantics.
- No changes to existing UNDERCOVER room state.
- No breaking visual redesign of UNDERCOVER.
- Build must remain clean after each integration phase.
- Existing tests must continue to pass.

## 18. Out of Scope for v1

- Accounts.
- Matchmaking.
- Public matchmaking.
- Voice chat.
- AI drawing evaluation.
- AI word generation during gameplay.
- Persistent public player rankings.
- Mobile drawing pressure/tilt support.
- Complex brush engines.

## 19. Acceptance Criteria

The feature is considered integrated when:

1. Existing landing experience still works.
2. Mode Select can enter either game.
3. UNDERCOVER behavior remains unchanged.
4. DRAW & GUESS creates and joins rooms successfully.
5. Drawer receives private word choices.
6. Other players never receive the choice list.
7. Drawing events synchronize in real time.
8. Reconnect can rebuild the active canvas.
9. Server validates correct guesses.
10. Correct guesses are hidden from normal chat.
11. Timers are server-authoritative.
12. Hints work only in applicable modes.
13. Scores are deterministic on the server.
14. Every player gets one turn per round.
15. Final leaderboard is correct.
16. PLAY AGAIN resets the Draw & Guess room without creating an unnecessary new room.
