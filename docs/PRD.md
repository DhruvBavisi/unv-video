# UNDERCOVER — Product Requirements Document

## Product Overview
UNDERCOVER is a premium cinematic web experience for an undercover social-deduction investigation game.

The product has two distinct layers:
1. The cinematic landing experience.
2. The actual playable game, beginning with Online Mode.

The cinematic landing experience remains independent from gameplay state.

## Characters / Roles
### The Civilian
An ordinary civilian drawn into an investigation he never asked for.
Receives the Civilian word.
Goal: identify and eliminate all Undercover and Mr. White players.

### The Undercover
Confident, intelligent, mysterious, and impossible to read.
Receives a similar but different word.
Goal: blend in with Civilians and eliminate enough Civilians to make the number of Undercover players strictly greater than the number of remaining Civilians.

### Mr. White
A lifetime of experience disguised as calm detachment.
Receives no word.
Goal: listen to clues and infer the Civilian word. When eliminated, Mr. White immediately gets one chance to guess the Civilian word. A correct guess wins immediately. If Mr. White survives until the Civilians win, Mr. White wins jointly with them.

## Approved Role Distribution
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

The host can configure the player count and corresponding role distribution. The supplied distribution is the default/authoritative baseline.

## Word System
The product owner supplies a predefined list of generated similar-word pairs. Users/hosts can modify the available list according to the game's configuration.

For each investigation:
- Civilians receive Word A.
- Undercover receives Word B, similar to Word A.
- Mr. White receives no word.

Example:
- Civilian → Ocean
- Undercover → Swimming Pool
- Mr. White → no word

## Role Visibility Setting

The game always assigns Civilian, Undercover, and Mr. White roles internally.

The host may choose whether Civilian and Undercover players are explicitly told their assigned role.

### Reveal Roles ON
- Civilian sees their Civilian role presentation and role-specific avatar.
- Undercover sees their Undercover role presentation and role-specific avatar.
- Mr. White keeps the existing role presentation.

### Reveal Roles OFF
- Civilian remains assigned Civilian but is not explicitly told that role.
- Undercover remains assigned Undercover but is not explicitly told that role.
- Local role names, role descriptions, role-specific colors, and role-specific avatars are hidden for Civilian/Undercover.
- A neutral local presentation is used.
- The assigned secret word remains visible according to the existing word rules.
- Game logic continues to use the actual authoritative role.

The setting is configured in the lobby and locked when the investigation starts. It must not be implemented as a CSS-only hiding mechanism.

## Online Mode — Core Flow

`Enter Name → Room/Lobby → Role + Word Assignment → Clues/Chat → Random Clue Sequence → Voting → Elimination → Mr. White Guess if eliminated → Win Check → Next Round → Repeat → Game Over`

### 1. Enter / Join
The user enters their name and joins or creates a Room ID.

### 2. Lobby / Host Configuration
The host controls:
- player count
- Civilian/Undercover/Mr. White distribution according to approved configuration
- word category
- available predefined word-pair list
- `Reveal Roles` setting
- starting the investigation

`Reveal Roles` defaults to ON. Only the host can change it, and it becomes locked when the investigation starts. Non-hosts may view the setting but cannot modify it.

The room ID is reusable.

### 3. Private Assignment
When the investigation starts, every active player is assigned a private authoritative role and the appropriate word information.

The player's visible role presentation is controlled by the locked `Reveal Roles` setting. When disabled, Civilian and Undercover remain assigned their real roles but are not explicitly told their role; their secret word remains available. Public player state must remain role-neutral.

### 4. Clue + Chat
A shared communication area contains:
- **Clues tab:** clue-only input, maximum 3 words, no duplicate clues.
- **Chat tab:** normal discussion.

All clues are visible to everyone and previous-round clues remain visible until the investigation ends.

### 5. Random Clue Sequence
A random active-player sequence is generated every round.

Special Round 1 rule:
- Mr. White cannot be first.

Round 2+ rule:
- Mr. White can appear anywhere, including first.

Each active player submits exactly one clue in sequence.

### 6. Voting
After all clues are submitted, everyone votes for another active player.
Self-voting is prohibited.

If there is a tie for highest votes:
- no elimination occurs
- the same round continues
- another voting round occurs
- this repeats until there is a unique highest-voted player

### 7. Elimination
The uniquely highest-voted player is eliminated and becomes a spectator.

### 8. Mr. White Guess
If the eliminated player is Mr. White:
- immediately show the guess screen
- accept a free-text guess
- compare it to the Civilian word
- correct = Mr. White wins immediately
- incorrect = Mr. White stays eliminated and the game continues

Every eliminated Mr. White receives this opportunity independently.

### 9. Win Conditions
**Undercover:** wins when `UC > CI` among remaining active players. Strictly greater.

**Civilian:** wins when all Undercover players are eliminated and no surviving Mr. White can alter the result through a successful elimination guess.

**Mr. White:** wins immediately with a correct guess. A Mr. White who survives through a Civilian victory wins jointly with Civilians.

### 10. Repeat
If no win condition is reached:
- begin next round
- generate a new random clue order
- continue clue → vote → elimination → Mr. White guess → win check

## Online Room Edge Cases
### New player during ongoing game
- joins as spectator
- receives no current role/word
- does not clue/vote in current round
- automatically enters the room lobby at the next round boundary
- player count updates automatically
- becomes eligible for the next round's role assignment

### Reconnection
A disconnected player can reconnect with the same Room ID and recover their authoritative state without duplication.

### Eliminated players
Remain in the room as spectators.

### Play Again
At Game Over:
- show Play Again
- players choosing it return to the same Room ID's lobby
- old game state is reset
- roles/words are newly assigned
- a new investigation can start without generating a new Room ID

## Error Handling Requirements
The online game must explicitly handle invalid room IDs, full/invalid rooms, duplicate identities, disconnect/reconnect, mid-game joins, stale actions, out-of-order clues, >3-word clues, duplicate clues, self/duplicate/invalid votes, ties, duplicate/invalid Mr. White guesses, game-over actions, simultaneous Play Again actions, refresh/browser close, network interruptions, and client/server state mismatches.

Invalid actions must be rejected by the authoritative game state, not only hidden by the UI.

## Cinematic Sequence
The visual progress is scrubbed via scroll using a Frame Sequence renderer. The single source of truth for text synchronization is the exact video timeline:
- 0.00s – 4.20s: Wide establishing shot, approaching table.
- 4.20s – 7.00s: The Civilian focus and reveal.
- 7.00s – 8.00s: Transition.
- 8.00s – 11.20s: The Undercover focus and reveal.
- 11.20s – 12.50s: Transition.
- 12.50s – 16.00s: Mr. White focus and reveal.
- 16.00s – 20.00s: Pull back and reveal the full room.

## Final Landing CTA
UNDERCOVER
WHO CAN YOU TRUST?
PLAY NOW
DISCOVER THE GAME

PLAY NOW enters the game/lobby layer; it must not couple gameplay state to cinematic ScrollTrigger progress.

## Success Criteria
The site should feel cinematic, provide frame-accurate stutter-free scrolling, work responsively, maintain exact video-time synchronization for all character reveals, and provide a robust playable Online Mode with secure role/word privacy, deterministic state transitions, reconnect recovery, spectator handling, tie-safe voting, Mr. White guessing, correct win conditions, and same-room Play Again.

Pass & Play is intentionally deferred until its rules and flow are separately defined.
