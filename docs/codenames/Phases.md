# CODENAMES — Development Phases

## Status
All phases below are planned. Do not mark a phase complete until the corresponding code actually exists.

## Phase 1 — Mode Integration
- [x] Add Codenames to the existing mode selector.
- [x] Add isolated `src/codenames/` module.
- [x] Reuse shared Socket.IO connection.
- [x] Preserve existing Undercover/Draw & Guess behavior.

## Phase 2 — Codenames Room Lifecycle
- Dedicated Codenames room state.
- Create/join/leave.
- Host handling.
- Explicit removal only.
- Stable session identity.
- Resume-token authentication.
- Reconnect without duplicate players.

## Phase 3 — Teams & Roles
- Red/Blue teams.
- One Spymaster per team.
- Operatives.
- Server-authoritative assignments.
- Private role state.

## Phase 4 — Board Generation
- Generate 25 unique words.
- Generate hidden Red/Blue/Neutral/Assassin key.
- Select starting team.
- Validate board distribution server-side.
- Never send the complete key to Operatives.

## Phase 5 — Private/Public State
Implement:
- public room state
- Spymaster private state
- Operative private state

Verify that hidden categories never cross the privacy boundary.

## Phase 6 — Clue Phase
- Spymaster gives clue + number.
- Validate turn, role, team and phase.
- Broadcast clue publicly after acceptance.
- Prevent duplicate/stale submissions.

## Phase 7 — Guess Phase
- Operatives reveal cards.
- Validate active team.
- Reveal one card at a time.
- Resolve category.
- Update remaining guesses.
- Prevent repeat reveals.

## Phase 8 — Turn Resolution
Implement:
- own-team card
- neutral card
- opponent card
- assassin
- End Turn

Ensure the server, not the client, determines the next phase/team.

## Phase 9 — Win / Result
- all own agents revealed → team win
- assassin → immediate loss
- final board reveal
- result screen
- same-room Play Again

## Phase 10 — UI / Responsive Polish
- mobile-first 5×5 board
- desktop layout
- team panels
- clue panel
- result overlay
- accessible interactions
- reduced-motion behavior

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
