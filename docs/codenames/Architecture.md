# CODENAMES — Architecture

## Status
**Phase 4 implemented. Codenames foundational module and routing added.**

Codenames is a planned third playable mode inside the existing Vite + React project. It must reuse the existing Socket.IO connection/session infrastructure while keeping its game state isolated from Undercover and Draw & Guess.

## Module Boundary
Recommended structure:
```
src/codenames/
  CodenamesApp.jsx
  components/
    CodenamesBoard.jsx
    CodenamesCard.jsx
    TeamPanel.jsx
    CluePanel.jsx
    TurnIndicator.jsx
    PlayerRoster.jsx
    ResultOverlay.jsx
  hooks/
  styles/
```

Server:
```
server/
  server.js
  codenames/
    ...optional helpers as implementation grows
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
  ↓
TEAM/ROLE SETUP
  ↓
GAME_START
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
