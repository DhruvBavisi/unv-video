# CODENAMES — Development Rules

## Status
**Phase 4 implemented.**

## General
1. Inspect the existing shared socket/session architecture before changing it.
2. Reuse the existing Socket.IO connection.
3. Keep Codenames room state isolated.
4. Keep the server authoritative.
5. Make the smallest change necessary.
6. Do not regress Undercover or Draw & Guess.

## Board
- Exactly 25 cards.
- Every card has exactly one hidden category.
- Categories: Red, Blue, Neutral, Assassin.
- Exactly one Assassin.
- No duplicate word card in the same board.
- The starting team is server-selected.

## Teams / Roles
- Exactly two teams: Red and Blue.
- One Spymaster maximum per team. A player cannot take an already-occupied Spymaster slot.
- Other team members are Operatives.
- A player can belong to only one team and occupy only one role.
- Role/team changes are permitted during `LOBBY` and `WAITING_FOR_PLAYERS`, but strictly forbidden once in `PLAYING` or `FINISHED`.

## Information Privacy
Spymasters may see the complete hidden key.

Operatives may see:
- word text
- public revealed state
- current clue
- current team/turn
- their own team/role

Operatives must never receive:
- hidden category of unrevealed cards
- Spymaster-only board key
- another player's private session data

Do not solve privacy with CSS-only hiding.

## Clue Rules
- Only the active team's Spymaster can submit a clue.
- Clue consists of one word plus a number.
- Number must be a valid non-negative clue count according to the chosen ruleset.
- Server validates phase, team, role and stale game version.
- Accepted clue becomes public to the room.

## Guess Rules
- Only Operatives of the active team may reveal cards.
- A revealed card cannot be selected again.
- Server determines the hidden category.
- Client cannot submit a fake category.

## Turn Rules
Default Codenames resolution:
- Own team card: continue if guesses remain.
- Neutral card: end turn.
- Opponent card: reveal it, end turn and transfer control to the opponent.
- Assassin: revealing team loses immediately.
- End Turn: transfer control to the opposing team.

The exact implementation must keep these transitions atomic on the server.

## Win Rules
- Team wins when all of its agent cards have been revealed.
- Assassin causes immediate loss for the revealing team.
- Final board is shown after game end.

## Lifecycle
- Room creation starts in `LOBBY`.
- Single-player start: The host can start the room with 1+ real player into `WAITING_FOR_PLAYERS`, generating the board once.
- Late joining: Permitted during `LOBBY` and `WAITING_FOR_PLAYERS` (up to 20-player room capacity). New players join with `team: null, role: null`. Late joins into active `PLAYING` are blocked.
- Gameplay readiness: Active gameplay (`PLAYING`, `BOARD_READY`) requires at least 4 real players, 1 Spymaster and at least 1 Operative on each team, and no unassigned players. Transition is server-authoritative and does not regenerate the board.
- Action gating: Clue submission and card reveal actions are strictly rejected until the room enters `PLAYING`.
- Socket disconnect is not Leave Game.
- Explicit Leave Game or host kick removes a player and recalculates readiness.
- Reconnect requires the existing resume token.
- Reconnect restores the same player identity/team/role/game state without creating duplicate players or regenerating the board.
- Never reset a live game because a player temporarily disconnects.

## Shared Infrastructure Rule
Do not create a second Socket.IO server or duplicate authentication system for Codenames.

Use `codenames:` event prefixes and a dedicated room-state namespace.

## Scope
The initial implementation is online-only. Voice/video and Pass & Play are out of scope unless separately approved.

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
