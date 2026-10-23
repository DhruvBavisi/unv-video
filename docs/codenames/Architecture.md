# CODENAMES — Architecture

## Status
**Implemented.** Codenames is an active playable game mode within the shared Socket.IO infrastructure, using isolated `codenamesRooms` state and `codenames:*` socket events.

## Module Structure
Active frontend structure:
```
src/games/codenames/
  CodenamesApp.jsx
  components/
    CodenamesBoard.jsx
    CodenamesCard.jsx
    CodenamesLobby.jsx
  styles/
    codenames.css
```

Server structure:
```
server/
  server.js (Socket.IO/HTTP bootstrap, delegation to games)
  games/codenames/
    codenamesState.js (codenamesRooms map, public/private state projections)
    codenamesHandlers.js (codenames:* event handlers)
    boardGenerator.js (25-word board generator with team assignment)
    words.js (curated Codenames word dictionary)
```

Do not create a second Socket.IO server.


## Shared Connection
Reuse the existing socket connection and identity system:
- `register`
- session ID
- resume token
- room ID
- reconnect handling

Use `codenames:` prefixes for Codenames-specific events.

Examples:
- `codenames:create-room`
- `codenames:join-room`
- `codenames:select-team`
- `codenames:select-role`
- `codenames:start-game`
- `codenames:give-clue`
- `codenames:reveal-card`
- `codenames:end-turn`
- `codenames:room-state`
- `codenames:game-result`

## Room State
Use a dedicated `codenamesRooms` map or equivalent isolated room store.

Conceptual state:
```js
{
  id,
  hostId,
  status,
  players: [],
  teams: { red: [], blue: [] },
  spymasters: { red: null, blue: null },
  board: [],
  currentTeam: 'red',
  phase: 'CLUE',
  clue: { word: null, number: null },
  guessesRemaining: 0,
  revealedCards: [],
  winner: null,
  round: 1
}
```

The exact schema may evolve, but Codenames state must remain authoritative on the server.

## Board Privacy
The 25-card board contains hidden identities:
- RED
- BLUE
- NEUTRAL
- ASSASSIN

Operatives must never receive the unrevealed key.

Use separate state builders:
- `getCodenamesPublicState(room)`
- `getCodenamesPrivateState(room, playerId)`

Spymasters may receive the complete key. Operatives receive only public card information plus their allowed game data.

Do not rely on CSS hiding or client-side filtering of a fully-received board key.

## State Machine
```
LOBBY
  ↓ (Host starts with 1+ real players)
WAITING_FOR_PLAYERS (board initialized; late joins & role selection allowed)
  ↓ (Authoritative readiness satisfied: 4+ real players, 1 Spymaster + 1+ Operative per team)
PLAYING / BOARD_READY (board preserved, gameplay begins, role changes locked)
  ↓
CLUE
  ↓
GUESS
  ├── correct card → continue guessing
  ├── neutral → end turn
  ├── opponent card → opponent turn / game resolution
  ├── assassin → immediate loss
  └── stop/end turn → opposing clue phase
  ↓
GAME_RESULT
```

## Room Initialization vs. Gameplay Readiness
- **Room Initialization (`canStartRoom`)**: Host can initialize a Codenames room with at least one real, non-bot player. Board generation and hidden keys are generated once on the server and preserved.
- **Waiting Phase (`WAITING_FOR_PLAYERS`)**: Allows new players to join late (up to 20 room capacity) and players to select or change their team and role. Spymaster slots are protected against overwriting. Gameplay actions (clue submission, guessing) are strictly blocked.
- **Readiness (`canPlay`)**: Authoritatively verified on the server after every join, leave, kick, and role change. Requires:
  - At least 4 real (non-bot) players.
  - Exactly 1 Red Spymaster and 1 Blue Spymaster.
  - At least 1 Red Operative and 1 Blue Operative.
  - All room players assigned to valid teams and roles (no invalid/conflicting assignments).
  Once readiness is satisfied, the server transitions the room from `WAITING_FOR_PLAYERS` to `PLAYING` (`BOARD_READY`) without regenerating the board.

## View Architecture (Lobby vs. Game View Separation)
- **Separate Full-Page Views**: The lobby and main game board are rendered as distinct full-page views, eliminating vertical stacking of team panels and the 5×5 board.
- **Lobby View (`CodenamesLobby`)**: Displays mobile-first team panels, spectator strip, game settings, and player cards. The board is never rendered underneath the lobby.
- **Main Game View (`CodenamesBoard`)**: Renders the complete 5×5 board, status bar, team roster/score counters, and clue/guess controls in active play, or a clean waiting state during initialization. Includes a top navigation button (`← LOBBY`) and settings modal action to return to the lobby.
- **Join Team Navigation**: Clicking "Join Team" submits `codenames:join-team-role`. Upon server acknowledgement (`{ success: true }`), the client navigates directly to the main game view, while preserving authoritative room state and waiting until server readiness is satisfied before unlocking gameplay actions.

## Reconnection
Reconnect must restore:
- same player identity
- team
- role
- room
- current phase
- clue state allowed to that player
- revealed cards
- turn ownership
- score/result state

Never create a duplicate player.

## Security
All clue submission, card reveal, turn validation, team assignment and win conditions are server-authoritative.

Never trust:
- client-supplied card color
- client-supplied role
- client-supplied team
- client-supplied clue validity
- client-supplied winner

## Existing Project Compatibility
Codenames must not change working Undercover or Draw & Guess lifecycle behavior merely to add the mode.

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
