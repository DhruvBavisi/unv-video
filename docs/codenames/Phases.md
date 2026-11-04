# CODENAMES — Development Phases

## Status
Gameplay loop implemented (Phases 1–8 complete): clue giving, operative card reveal, turn resolution, win/assassin conditions, and same-room rematch.

## Phase 1 — Mode Integration
- [x] Add Codenames to the existing mode selector.
- [x] Add isolated `src/games/codenames/` module.
- [x] Reuse shared Socket.IO connection.
- [x] Preserve existing Undercover/Draw & Guess behavior.

## Phase 2 — Codenames Room Lifecycle
- [x] Dedicated Codenames room state (`codenamesRooms`).
- [x] Create/join/leave handlers.
- [x] Host handling and host transfer.
- [x] Single-player room start into `WAITING_FOR_PLAYERS` phase.
- [x] Late joining allowed during `LOBBY` and `WAITING_FOR_PLAYERS`.
- [x] Late joining locked once in `PLAYING`.
- [x] Explicit removal only.
- [x] Stable session identity with `localStorage['unv_identity']`.
- [x] Resume-token authentication (`codenames:join-room`).
- [x] Reconnect without duplicate players or resetting the board.
- [x] Mobile LAN HTTP resiliency: Back to Game Modes cancel button on session restoration screen (`src/games/codenames/CodenamesApp.jsx`).

## Phase 3 — Teams & Roles
- [x] Red/Blue teams.
- [x] One Spymaster per team (overwriting occupied Spymaster slot prevented).
- [x] Operatives.
- [x] Role selection permitted in `LOBBY` and `WAITING_FOR_PLAYERS` (locked in `PLAYING`).
- [x] Server-authoritative assignments and synchronization.
- [x] Server-authoritative readiness recalculation (4+ real players, 1 Spymaster + 1+ Operative each team).
- [x] Private role state.

## Phase 4 — Board Generation
- [x] Generate 25 unique words (`server/games/codenames/words.js`).
- [x] Generate hidden Red/Blue/Neutral/Assassin key (`server/games/codenames/boardGenerator.js`).
- [x] Select starting team (9 cards for starting team, 8 for second team, 7 neutrals, 1 assassin).
- [x] Initialize board once on room start and preserve through waiting phase.
- [x] Validate board distribution server-side.
- [x] Separate full-page views: dedicated lobby view and main game view (stacked preview removed).
- [x] Never send the complete key to Operatives (sanitized in `getCodenamesPublicState`).

## Phase 5 — Private/Public State
Implement:
- public room state
- Spymaster private state
- Operative private state

Verify that hidden categories never cross the privacy boundary.

## Phase 6 — Clue Phase
- [x] Spymaster gives clue + number.
- [x] Validate turn, role, team and phase.
- [x] Broadcast clue publicly after acceptance.
- [x] Prevent duplicate/stale submissions.

## Phase 7 — Guess Phase
- [x] Operatives reveal cards.
- [x] Validate active team and operative role.
- [x] Reveal one card at a time.
- [x] Resolve category and decrement remaining guesses.
- [x] Prevent repeat reveals.

## Phase 8 — Turn Resolution
- [x] Own-team card (continue guessing if guesses remain).
- [x] Neutral card (immediate turn end to opponent).
- [x] Opponent card (immediate turn end to opponent, count revealed for opponent).
- [x] Assassin (immediate loss, opponent wins).
- [x] End Turn (voluntary pass transferred to opponent).
- [x] Server-authoritative phase and team transitions.

## Phase 9 — Win / Result
- [x] All own agents revealed → team win.
- [x] Assassin → immediate loss.
- [x] Final board reveal across public state on finish.
- [x] Same-room Play Again handler.
- [x] Dedicated classic victory modal (`VictoryModal`) with team theme, win reason, stats, and "Inspect Board" toggle.

## Phase 10 — UI / Responsive Polish
- [x] Mobile-first 5×5 board.
- [x] Desktop layout with side team panels and center board.
- [x] Natural hierarchy reordering: Game-Info Row (top) -> Clue Input / Action Row -> Status Row -> Word Board (5x5 grid).
- [x] Spymaster 10-frame circular number selector popup (`1` to `9` + `∞`) appearing above the clue input with active selection and backdrop dismiss.
- [x] Server authoritative infinity clue support (`room.guessesLeft = 25`, persistent operative guessing).
- [x] Real-time Game Log feed (`turnHistory`) logging clues and card reveal outcomes.
- [x] Full-width Game Log messages covering 100% width with team colored left-accent borders, full header strips, and wrapped outcome chips.
- [x] Play Again table reset: resets room to `WAITING_FOR_PLAYERS`, converting all players to spectators to choose their roles again on the main board.
- [x] Role slot joining lock: hides "JOIN TEAM" buttons on other cards once a player has joined a role.
- [x] Settings role switcher: allows players to change roles or leave to spectator directly from SettingsModal.
- [x] Operative tap-to-select and "Confirm Guess" flow (official `codenames.game` mechanic).
- [x] How to play (`RulesModal`) wired to `?` button.
- [x] Result overlay with inspect board toggle.
- [x] Accessible keyboard and ARIA interactions.

## Phase 11 — Reconnect / Recovery Audit
- preserve current turn
- preserve clue
- preserve revealed cards
- preserve team/role
- preserve game result
- reject stale actions
- preserve identity and points if scoring is introduced

## Phase 12 — Documentation / QA
- update all six Codenames docs after each architectural change
- confirm privacy boundaries
- confirm lifecycle rules
- confirm no regression to shared Socket.IO infrastructure

## Future
Optional later additions should be documented separately rather than silently expanding the initial implementation.

## CLASSIC CODENAMES UI LOCK
The project must reproduce the visual language of the original/classic Codenames board-game experience (2015-era/classic edition), NOT the newer 2025 refreshed Codenames visual design.

Preserve these principles:
- classic 5×5 rectangular word-card board
- traditional Red / Blue / Neutral / Assassin card states
- restrained board-game/card styling
- warm paper/card-like visual treatment
- simple classic typography and hierarchy
- clear physical-board-inspired spacing and borders
- minimal decoration
- responsive adaptation for desktop/mobile is allowed

Explicitly prohibit:
- 2025 refreshed Codenames visual style
- futuristic UI
- glassmorphism
- excessive gradients
- neon gaming UI
- Undercover's black/gold investigation styling
- copying proprietary Codenames artwork/assets

Recreate the classic visual language using the project's own CSS/components/assets.
