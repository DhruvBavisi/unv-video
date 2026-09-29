# SKRIBBL / DRAW & GUESS — Game Rules

## 1. Rule Authority

The server is the authoritative source of truth.

Client-side restrictions are UX safeguards only. The server must independently reject invalid actions.

These rules apply to DRAW & GUESS only. UNDERCOVER has its own rules document and must not inherit these rules accidentally.

## 2. Players

Default supported range:

```text
2–20 players
```

The actual maximum is controlled by server configuration.

A player has:

- ID
- name
- score
- connection state
- spectator state
- current-round drawing status
- current-round guessing status
- guess timestamp

## 3. Room Configuration

```text
players
drawTimeSec
rounds
wordCount
hints
gameMode
customWords
useCustomOnly
```

The server validates all values.

## 4. Game Modes

### NORMAL

The answer is progressively revealed one letter at a time according to the hint schedule.

### HIDDEN

No automatic letters are revealed.

Players only see:

- answer length
- preserved spaces

### COMBINATION

Words can be selected from both default and custom word sources.

If `useCustomOnly` is enabled, only custom words are eligible.

## 5. Turn Order

At the beginning of each round:

1. Server obtains all eligible active players.
2. Server shuffles the order.
3. Every eligible player appears exactly once.
4. The first player becomes the drawer.
5. After each drawing turn, advance to the next player.
6. After every player has drawn, the round ends.
7. Start the next round if configured.

Turn order must not be client-generated.

## 6. Word Selection

For each drawer:

1. Server selects up to the configured number of unique eligible words.
2. The choices are private to the drawer.
3. Drawer chooses one.
4. The chosen word becomes the authoritative current word.
5. Unchosen choices are discarded.
6. The selected word is marked unavailable for the remainder of the game.

If fewer eligible words exist than requested, the server returns the available number without stalling.

## 7. Word Choice Timeout

Recommended timeout:

```text
15 seconds
```

If the drawer does not choose:

```text
server randomly selects one presented choice
→ DRAWING begins
```

The room must never wait indefinitely.

## 8. Drawing Authority

Only the current drawer can submit drawing events.

Valid events:

```text
draw:stroke-start
draw:stroke-point
draw:stroke-end
draw:fill
draw:undo
draw:clear
```

A non-drawer attempting to submit one is rejected.

## 9. Drawing Behavior

The drawer's canvas is authoritative for user input.

The server does not judge the drawing.

The server only validates:

- sender
- room
- phase
- payload shape
- coordinate bounds
- reasonable event size/rate

## 10. Canvas Replay

The current round's drawing is represented by a sequence of drawing operations.

A reconnecting player receives those operations in order and rebuilds the canvas locally.

The system must not depend on a continuously transmitted raster image.

## 11. Guess Rules

Every active non-drawer player may submit guesses until they:

- guess correctly,
- become ineligible,
- or the drawing timer ends.

The drawer cannot guess their own word.

A player who has already guessed correctly cannot receive another guess award for that word.

## 12. Message Normalization

Before comparison:

```text
message.trim().toLowerCase()
```

The comparison must occur server-side.

At minimum, exact normalized equality is required for v1.

Do not rely on the client to decide whether a message is correct.

## 13. Incorrect Guess

An incorrect guess is treated as ordinary chat.

It is broadcast to eligible room participants according to normal chat visibility.

## 14. Correct Guess

The correct text itself is not broadcast.

Instead:

```text
System:
PLAYER NAME guessed the word!
```

is broadcast.

The correct player privately receives:

```text
✓ Correct!
```

The player is marked as correct for the current word.

## 15. Close Guess — Future

Optional v2 feature:

```text
Levenshtein distance <= 2
```

may produce a private “close guess” message.

This must not:

- reveal the answer,
- expose distance to others,
- grant points,
- interrupt normal guessing.

## 16. Drawing Timer

Recommended default:

```text
60 seconds
```

The actual value comes from room configuration.

The server determines when the drawing ends.

A client reaching zero locally does not end the round by itself.

## 17. Hint System

If:

```text
hints > 0
```

and mode is `normal` or `combination`:

```text
window = drawTimeSec / (hints + 1)
```

At each boundary:

1. Select one hidden letter.
2. Reveal it publicly.
3. Preserve spaces.
4. Do not reveal an already visible position.
5. Avoid repeatedly revealing first/last positions when another legal position exists.

If mode is `hidden`, no letters are revealed automatically.

## 18. Multi-Word Answers

Spaces are always preserved.

Example:

```text
_ _ _ _   _ _ _ _
```

Punctuation handling should remain consistent with the stored word.

The server should define whether punctuation is part of the answer rather than allowing clients to make independent decisions.

## 19. Scoring

Initial v1 formula:

```text
guesserPoints =
round(500 * (timeRemaining / drawTimeSec))
* orderMultiplier
```

Order multiplier:

| Correct guess order | Multiplier |
|---:|---:|
| 1st | 1.00 |
| 2nd | 0.80 |
| 3rd | 0.65 |
| 4th+ | 0.50 |

Apply a minimum award of 50 points for a valid positive score.

Drawer:

```text
drawerPoints =
round(totalGuesserPoints * 0.5)
```

If nobody guesses:

```text
guesserPoints = 0
drawerPoints = 0
```

## 20. Scoring Example

If the drawing has 40 seconds remaining out of 60:

```text
base = round(500 * 40/60)
     = 333
```

First correct guess:

```text
333 * 1.00 = 333
```

Second:

```text
333 * 0.80 = 266
```

Third:

```text
333 * 0.65 = 216
```

Fourth:

```text
333 * 0.50 = 166
```

The exact implementation must calculate from the authoritative server timestamps rather than client-reported remaining time.

## 21. Drawer Score Timing

At the end of a word:

```text
drawerPoints = round(sum(awardedGuesserPoints) * 0.5)
```

Add these points to the drawer's cumulative score.

The drawer does not receive points merely for drawing.

## 22. Round End

A drawing turn ends when:

- draw timer expires, or
- the configured product rule explicitly ends it early.

Then:

1. Stop scoring guesses.
2. Reveal the answer.
3. Reveal round points.
4. Show round-result UI.
5. Hold approximately 5 seconds.
6. Clear/reset canvas.
7. Advance turn order.

## 23. Game End

After the configured number of rounds:

```text
GAME_RESULT
```

The final leaderboard is sorted by total score descending.

All final scores are server-authoritative.

## 24. Play Again

PLAY AGAIN:

- reuses the same room ID,
- resets scores unless a future rematch rule says otherwise,
- resets rounds,
- clears used-word state,
- clears drawing state,
- creates a fresh turn order,
- returns players to the appropriate lobby/reset state.

Do not create a new room unnecessarily.

## 25. Spectators / Late Joiners

Players joining during an active game become spectators/pending participants.

They:

- cannot draw in the active turn,
- cannot guess for the current word,
- cannot alter the current round,
- may observe public drawing/chat according to spectator rules.

They become eligible according to the next-round boundary.

## 26. Reconnect

A disconnected active player retains their identity where the existing session system permits.

On reconnect:

- restore permitted public state,
- restore private state only for that player,
- replay the current canvas if applicable,
- calculate remaining time from server timestamps.

A reconnect must not restart a turn.

## 27. Host Rules

The host controls room configuration before the game begins.

During an active game, the host must not be able to arbitrarily change:

- current word,
- score,
- timer,
- turn order,
- correct-guess status.

Host moderation actions remain available according to the shared moderation system.

## 28. Word Privacy

The following are private:

- unselected word choices,
- selected current word before round reveal,
- private correct-guess response.

The following become public at the appropriate time:

- selected answer after round resolution,
- player who guessed correctly,
- awarded points,
- final scores.

## 29. No Duplicate Words

Once a word has been selected for a game, it cannot be selected again in that game.

This applies across rounds and drawers.

## 30. Failure Handling

If the drawer disconnects:

- preserve the room,
- follow the application's reconnect grace period,
- if the drawer does not return within the configured policy, safely terminate/skip the turn,
- never leave the room permanently stuck.

If a guesser disconnects:

- their prior score remains,
- their guess status remains authoritative,
- they may reconnect according to normal rules.

## 31. Determinism

For any completed round, the server must be able to explain:

- who drew,
- which word was selected,
- when drawing started,
- when each correct guess occurred,
- the order of correct guesses,
- awarded points,
- drawer points.

This is important for debugging and future game-history features.
