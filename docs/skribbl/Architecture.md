# SKRIBBL / DRAW & GUESS — Architecture

## Status
Implemented playable online mode.

## Module Boundary
Client:
- `src/drawgame/SkribblApp.jsx`
- `src/drawgame/components/`
- shared socket: `src/game/socket.js`
- shared identity: `src/game/identity.js`

Server:
- `server/server.js`
- dedicated `drawRooms` map

Do not create a second Socket.IO server.

## Shared Connection
Reuse the existing Socket.IO connection and `register` lifecycle. Draw-specific events use the `draw:` prefix:
- `draw:create-room`
- `draw:join-room`
- `draw:leave-room`
- `draw:update-config`
- `draw:room-state`
- `draw:error`
- `draw:kicked`

## Authoritative State
The server owns room phase, drawer, turn index, word choice, selected word, strokes, guesses, hints, scores, timers and results.

Current phases:
`LOBBY → WORD_CHOICE → DRAWING → ROUND_REVEAL → GAME_RESULT`

## Private State
`getSafeStateForPlayer(room, playerId)` sanitizes the room state. The selected word is only exposed to authorized viewers (current drawer/reveal/result/allowed guessed state). Server-only timers, strokes and player records are not blindly exposed.

## Reconnection
Disconnect is not a leave. Existing players reconnect using the shared session ID + resume token.

For the active drawer:
- WORD_CHOICE resumes from stored remaining milliseconds.
- DRAWING resumes selected word, strokes, guesses, hints and remaining drawing time.

Automatic Socket.IO `register` reconnect and explicit `draw:join-room` reconnect both restore the timer.

Never create a duplicate player.

## Lifecycle
Only explicit leave or host kick removes a player. Do not add stale-player auto-removal.

## Mobile
Drawing and guessing are mobile-first. Shared keyboard-focus and safe-area handling must remain intact.