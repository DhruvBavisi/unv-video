# UNDERCOVER — Architecture

## Technology Stack
- React
- Vite
- JavaScript
- GSAP
- GSAP ScrollTrigger
- CSS
- HTML5 canvas (primary cinematic renderer) / video (fallback)

Future optional upgrade:
- Three.js
- React Three Fiber
- GLTF/GLB
- WebGL

Do not introduce libraries unless they solve a real problem.

## Architectural Boundary
The product has two isolated systems:

### A. Landing / Cinematic Experience
Uses the existing 480-frame canvas renderer and ScrollTrigger architecture.

### B. Playable Game
Uses a state-driven online game architecture. Gameplay state must never be driven by cinematic scroll progress.

The `PLAY NOW` action is the boundary between the two systems.

## Asset Source of Truth
The original 3D characters exist in the user's Blender project. The web application does NOT load the `.blend` file.

The landing page uses a 480-frame image sequence extracted from the supplied cinematic MP4 as its primary visual renderer. The MP4 is a fallback only.

Current assets:
- `public/images/cinematic/frame_0001.jpg` … `frame_0480.jpg`
- `public/videos/uncercover-cinematic.mp4` — fallback only
- `public/images/investigation-room/hero-frame.png`
- `public/images/investigation-room/end-frame.png`
- legacy placeholder character frames remain unused

Do not create fake character assets or replacement characters.

## Landing Cinematic Architecture
The cinematic is a `<canvas>` whose frame is selected by scroll progress:

```
USER SCROLL
   -> ScrollTrigger.progress (0..1)
   -> frameIndex = round(progress * 479) + 1
   -> canvas.drawImage(frameCache[frameIndex])
   -> character text from the same progress
```

The frame sequence is primary because H.264 GOP decoding adds visible stutter when scrubbing.

### Frame Sequence
- 480 frames
- 1280×720
- JPEG
- eager preload
- DPR-aware canvas capped at 2×
- object-fit cover geometry
- no network request should occur during active scrolling

### Video Fallback
- always paused
- no autoplay
- no `play()`
- no playbackRate
- currentTime mapped from progress only
- metadata gate before timing

## Landing Scroll Architecture
One cinematic ScrollTrigger remains the single cinematic controller.

```
NATIVE SCROLL
   ↓
ScrollTrigger (pin)
   ↓
progress 0..1
   ↓
frameIndex 1..480
   ↓
canvas.drawImage
   ↓
character reveal mapping
```

Native scrolling remains untouched. No Lenis, wheel interception, touch interception, preventDefault, or CSS smooth scrolling.

## Character Timing
Video-time windows remain:
- Civilian: 4.2s – 7.0s
- Undercover: 8.0s – 11.2s
- Mr. White: 12.5s – 16.0s

Composition:
- Civilian physically LEFT → text RIGHT
- Undercover physically CENTER → text LEFT
- Mr. White physically RIGHT → text LEFT

## Gameplay Architecture
Build gameplay as a separate state machine.

Suggested structure:

```
src/
├── game/
│   ├── GameApp.jsx
│   ├── gameState.js
│   ├── gameReducer.js
│   ├── gamePhases.js
│   ├── gameRules.js
│   ├── roleAssignment.js
│   ├── wordPairs.js
│   ├── clueRules.js
│   ├── votingRules.js
│   ├── winConditions.js
│   ├── roomState.js
│   └── reconnect.js
├── sections/
│   ├── Hero.jsx
│   ├── CinematicSequence.jsx
│   ├── Investigation.jsx
│   └── FinalCTA.jsx
├── components/
│   ├── ...existing landing components
│   └── game/
│       ├── OnlineLobby.jsx
│       ├── HostControls.jsx
│       ├── PlayerRoster.jsx
│       ├── PrivateRoleReveal.jsx
│       ├── PrivateWordReveal.jsx
│       ├── ClueChat.jsx
│       ├── ClueInput.jsx
│       ├── ClueHistory.jsx
│       ├── RoundOrder.jsx
│       ├── VotingPanel.jsx
│       ├── TieVote.jsx
│       ├── Elimination.jsx
│       ├── MrWhiteGuess.jsx
│       ├── SpectatorView.jsx
│       ├── ReconnectState.jsx
│       ├── GameResult.jsx
│       └── PlayAgain.jsx
└── data/
    ├── characters.js
    ├── evidence.js
    └── wordPairs.js
```

Adapt to the existing project rather than blindly creating duplicates.

## Authoritative Game State
The online game requires an authoritative state model. Conceptually:

```
ROOM_LOBBY
   ↓
ASSIGNMENT
   ↓
CLUE_PHASE
   ↓
VOTING
   ↓
ELIMINATION
   ↓
MR_WHITE_GUESS (conditional)
   ↓
WIN_CHECK
   ├── GAME_RESULT
   └── NEXT_ROUND → CLUE_PHASE
```

State must include at minimum:
- roomId
- hostId
- players
- active players
- spectators
- eliminated players
- roles (private access controlled)
- revealRoles setting (host-controlled; locked at investigation start)
- Civilian word (private access controlled)
- Undercover word (private access controlled)
- selected category/word pair
- round number
- clue order
- submitted clues
- clue history
- chat history
- votes
- revote number
- current phase
- Mr. White guess state
- winner
- Play Again state
- reconnect/session state


## Role Visibility / Reveal Roles

The game always assigns an authoritative internal role to every active player:
- Civilian (`ci`)
- Undercover (`uc`)
- Mr. White (`mw`)

The host controls a lobby setting:

`revealRoles`

Default: enabled, preserving the existing player experience.

When `revealRoles = true`:
- the local Civilian may see their Civilian role presentation and role-specific avatar
- the local Undercover may see their Undercover role presentation and role-specific avatar
- the existing Mr. White presentation remains unchanged

When `revealRoles = false`:
- Civilian and Undercover remain assigned their real roles
- their local role name, role-specific description, role-specific color, and role-specific avatar are hidden
- their assigned secret word remains available according to the existing word rules
- a neutral local presentation is used instead
- the authoritative game logic continues to use the actual role

`revealRoles` is host-controlled, synchronized through authoritative room state, and locked when the investigation starts. Non-hosts may view the setting but cannot change it.

Actual role and visible role presentation are separate concepts. Never replace the authoritative role with a hidden/null role in game logic.

Public player state must never expose another player's private role or role-specific avatar, regardless of `revealRoles`.

## Role Distribution
Use the exact approved mapping from 3–20 players:

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

## Clue Architecture
Each round generates a randomized active-player sequence.
- Round 1: Mr. White cannot occupy index 0.
- Round 2+: no Mr. White first-position restriction.
- Exactly one clue per active player.
- Maximum 3 words.
- No duplicate clue for the investigation.
- Clues persist across rounds.

The server/authoritative game state must validate order, turn ownership, clue length, uniqueness, and phase.

## Voting Architecture
- Active players vote.
- Self-vote rejected.
- One vote per player.
- Tied highest vote → no elimination → same round enters another vote phase.
- Unique highest vote → eliminate player.

## Mr. White Guess Architecture
When an eliminated player is Mr. White:
- transition immediately to a private guess action for that Mr. White
- accept one free-text guess
- compare with Civilian word
- correct → immediate game result
- incorrect → continue game

Multiple Mr. Whites each receive their own guess opportunity when eliminated.

## Spectator / Mid-Game Join Architecture
A new joiner during a live round is assigned spectator status.
They do not receive current round role/word data or actions.
At the next round boundary they enter the lobby/eligible pool and the player count updates.

Eliminated players remain spectators in the same room.

## Reconnection Architecture
Use stable player/session identity associated with Room ID.
On reconnect:
1. validate session
2. retrieve authoritative room state
3. restore private role/word only to the correct player, while applying the authoritative `revealRoles` visibility policy
4. restore current phase and action availability
5. reject stale/duplicate actions

## Same-Room Play Again
Game result → player chooses Play Again → same Room ID lobby → reset previous investigation state → new roles/word pair → new investigation.

No new room ID is required.

## Error Handling
The authoritative layer must handle invalid room, capacity, duplicate identity, disconnect, reconnect, stale action, out-of-turn clue, invalid clue, duplicate clue, invalid vote, self-vote, tie, invalid Mr. White guess, game-over action, simultaneous Play Again, and state mismatch.

## Security / Privacy Principle
Role and word assignment is secret information.
Do not place all roles/words in a public client payload merely hidden by CSS.
The architecture must support private per-player state from the online authority/backend.

`revealRoles` controls player-facing role disclosure; it does not remove or alter the authoritative role assignment.
When role reveal is disabled, do not rely on CSS-only hiding. Do not unnecessarily send explicit role identity to the Civilian/Undercover client.
Role-specific avatars, role colors, and role descriptions are private presentation data and must never be exposed through another player's public state.

## Responsive / Accessibility Principle
Gameplay uses normal application layout, not cinematic scroll control. Mobile must remain usable for clue entry, chat, voting, and Mr. White guessing. Keyboard and semantic interaction remain required.

## Future
Pass & Play is deliberately separated from Online Mode and must not be implemented until its rules are approved.
