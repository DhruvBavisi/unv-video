# UNDERCOVER — AI Development Rules

## General
Before changing code:
1. Inspect the existing implementation.
2. Understand the architecture.
3. Identify dependencies.
4. Make the smallest appropriate change.
5. Preserve working cinematic behavior unless the requested change explicitly concerns it.

## Character Naming
The three characters are: **The Civilian**, **The Undercover**, **Mr. White**. Internal IDs (`rookie`, `undercover`, `veteran`) may be preserved where legacy code requires them.

For gameplay documentation and communication, the user may use:
- `ci` = Civilian
- `uc` = Undercover
- `mw` = Mr. White

These are shorthand references, not replacements for user-facing role names.

## Cinematic Rules
The landing cinematic uses a **Frame Sequence Renderer**.
Never use H.264 MP4 scrubbing as the primary renderer.
Use a single Canvas element.

## Animation Rules
Prefer transform and opacity. Use GSAP + ScrollTrigger. Do not create competing animation systems.
The cinematic frames/video must never autonomously play. No `setInterval` playback. No `autoplay`.

## Scroll Rules
The cinematic is pinned and scroll controls its progress.
Do NOT use CSS `scroll-behavior: smooth` — it fights with ScrollTrigger.
Keep native scroll intact. Do not use `preventDefault`, wheel hijacking, or Lenis.

## Cinematic Synchronization Rules
Character text must be explicitly mapped to the actual video timeline.
If the scroll stops halfway through a transition, the transition stops exactly there.
Reverse scroll = reverse transition.

## Preloading
Never wait for a network request during scrolling. The Frame Sequence must fully preload all 480 frames before or during the initial view, ensuring smooth scrubbing.

# ONLINE GAME RULES

## Authoritative Game State
Gameplay must be state-driven and have one authoritative source of truth.
Client UI validation is not sufficient; the authoritative game layer must reject invalid actions.

## Role Distribution
Use the exact approved distribution:

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

Do not silently alter these values.


## Role Visibility / Reveal Roles

The authoritative game always assigns every active player one real role:
- Civilian (`ci`)
- Undercover (`uc`)
- Mr. White (`mw`)

The host controls the lobby setting `Reveal Roles`.

### Default
`Reveal Roles = ON` by default, preserving the existing role-reveal behavior.

### Reveal Roles ON
- A local Civilian may see their Civilian role identity and role-specific presentation.
- A local Undercover may see their Undercover role identity and role-specific presentation.
- Mr. White follows the existing presentation and gameplay rules.

### Reveal Roles OFF
Civilian and Undercover are still assigned their actual roles, but they must not be explicitly told what their role is.

When OFF, the local player must not receive or see role-identifying:
- role name
- role description
- role-specific color/accent
- role-specific avatar
- accessible label/alt text
- tooltip
- DOM attribute or other presentation metadata

Use a neutral local presentation instead.

The assigned secret word remains available to Civilian/Undercover according to the existing word rules.

### Authority and privacy
`Reveal Roles` is host-controlled and becomes locked when the investigation starts. Non-hosts cannot change it.

The actual role remains authoritative for:
- role distribution/counts
- word assignment
- clue/turn authorization
- voting/elimination
- Mr. White behavior
- win conditions
- game results

Do not replace the actual role with a hidden/null role in the authoritative game state.

Do not implement role hiding as CSS-only behavior. Public state and other players' views must remain role-neutral, and role-specific avatars must never be shown for another player.

On reconnect, the same authoritative role and locked `Reveal Roles` policy must be restored.

## Word Rules
- Civilians receive the Civilian word.
- Undercover receives a similar but different word.
- Mr. White receives no word.
- Word pairs come from a predefined generated list supplied by the product owner.
- The list must be editable/configurable.
- Private word information must never be exposed to unauthorized players.

## Clue Rules
- Clues are entered only through the Clues tab.
- Maximum 3 words per clue.
- Empty clues are invalid.
- Duplicate clues are prohibited for the entire investigation, not merely the current round.
- Previous-round clues remain visible until the investigation ends.
- Clues are visible to everyone.
- Clues must be submitted strictly in the generated order.
- Round 1: Mr. White can never be first.
- Round 2 onward: Mr. White may be anywhere, including first.

## Chat Rules
Chat is separate from clue entry and is visible to everyone according to the room's spectator visibility rules. Chat messages are not clues and must not be accidentally recorded as clues.

## Voting Rules
- Every active player votes.
- Self-voting is prohibited.
- Eliminated players/spectators cannot vote.
- A vote can only be submitted once.
- If the highest vote is tied, there is no elimination and another voting round occurs.
- Continue revoting until a unique highest-voted player exists.

## Mr. White Rules
- When a Mr. White is eliminated, that Mr. White immediately gets one free-text guess at the Civilian word.
- Correct guess = immediate Mr. White victory and investigation ends.
- Incorrect guess = Mr. White remains eliminated and investigation continues.
- If multiple Mr. Whites are eliminated, each gets the applicable guess opportunity.
- A Mr. White who survives to an investigation ending with the Civilians wins jointly with the Civilians.

## Undercover Win Rule
Undercover wins only when:

`remaining Undercover players > remaining Civilian players`

The comparison is strictly greater than. Equality does not trigger an Undercover victory.

## Civilian Win Rule
Civilians win when all Undercover players are eliminated and no surviving/active Mr. White can change the result through a successful guess. A Mr. White who survives the investigation to a Civilian victory wins jointly with Civilians.

## Eliminated Player Rules
Eliminated players remain in the same Room ID as spectators.
They cannot submit clues or votes and cannot affect active-player win conditions.

## Mid-Game Join Rules
A player joining during an ongoing game becomes a spectator immediately.
They do not join the current round, receive its role/word, enter its clue sequence, or vote.
At the next round boundary, they automatically become eligible in the room lobby and the player count updates.
The next round's role distribution is recalculated according to the valid player count.

## Reconnection Rules
A disconnected player must be able to reconnect to the same Room ID and recover authoritative game state.
Reconnection must not duplicate players, clues, votes, turns, or guess opportunities.
Stale actions must be rejected.

## Room Reuse / Play Again
After an investigation ends, Play Again uses the same Room ID.
Players who choose Play Again return to the lobby.
The previous game state is reset, roles/words are reassigned, and a new investigation can begin without creating a new Room ID.

## Error Handling
Handle and explicitly define behavior for:
- invalid/full rooms
- invalid player count
- duplicate identity
- disconnect/reconnect
- host disconnect
- mid-game joins
- stale actions
- out-of-turn clues
- >3-word clues
- duplicate clues
- duplicate/self/invalid votes
- vote ties
- duplicate/invalid Mr. White guesses
- game already ended
- Play Again races
- refresh/browser close
- network interruption
- client/server state mismatch

## Development Order
Do not implement Pass & Play yet. Online Mode must be completed and QA-tested first.
