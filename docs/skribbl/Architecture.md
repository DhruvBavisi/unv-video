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
The server owns room phase, drawer, turn index, word choice, selected word, strokes, guesses, hints, scores, timers and results. `room.currentDrawerId`, `room.phase`, `room.round`, and `room.turnIndex` are strictly server-authoritative. The client derives UI roles and controls solely from `room.currentDrawerId === sessionId` and never optimistically promotes, demotes, or toggles roles.

Current phases:
`LOBBY → WORD_CHOICE → DRAWING → ROUND_REVEAL → GAME_RESULT`

## Private State
`getSafeStateForPlayer(room, playerId)` sanitizes the room state:
- The selected word is strictly private to the active drawer and guessers who have successfully guessed, or during reveal/game over.
- Internal word pools (`usedWords`), hint reveal order (`revealIndices`), and hint mask states (`hintRevealed`) are withheld from public payloads to prevent secret word deduction.
- Server-only timers, stroke caches, and player records are never exposed.

## Turn Transitions & Timer Validation
- Each turn transition is governed by monotonic `room.turnSequence` tracking.
- All timeouts (word-choice timer, drawing turn timer, hint interval, reveal timer) validate room identity, round, turn index, drawer identity, turn sequence, and expected phase before executing any state changes.
- Obsolete or superseded timers are explicitly cleared before scheduling new timers.
- `draw:choose-word` is accepted only from the active drawer during `WORD_CHOICE`, atomically clearing the selection timer and transitioning to `DRAWING` exactly once. Stale or duplicate selections are rejected without timer restarts.

## Reconnection
Disconnect is not a leave. Existing players reconnect using the shared session ID + resume token.

For the active drawer:
- WORD_CHOICE resumes from stored remaining milliseconds.
- DRAWING resumes remaining drawing time without restarting the turn timer to full duration, duplicating timers, or altering drawer ownership.
- Reconnects by guessers or other players never affect drawer ownership or active timers.

Automatic Socket.IO `register` reconnect and explicit `draw:join-room` reconnect both restore the timer safely without emitting duplicate room states.

Never create a duplicate player.

## Lifecycle
Only explicit leave or host kick removes a player. Do not add stale-player auto-removal.
On drawer disconnect, kick, or leave, the turn advances exactly once while preserving scoring and remaining-player order. If fewer than 2 eligible players remain, the room cleanly transitions to `GAME_RESULT`.

## Network State & Persistent UI
- `SkribblApp.jsx` actively observes Socket.IO lifecycle events (`connect`, `disconnect`, `connect_error`, `reconnect_attempt`, `reconnect_error`, `reconnect_failed`) and propagates normalized state (`Connected`, `Connecting`, `Disconnected`) to `SkribblNetworkStatus`.
- Reconnection attempts do not drop the persistent indicator; stale events are ignored.
- `SettingsPanel.jsx` consumes `room.id` during active gameplay, offering in-panel room copying and overlay-level `QRModal` invocation.

## Mobile
Drawing and guessing are mobile-first. Shared keyboard-focus and safe-area handling must remain intact.

## Entry and Session Recovery
- Initial view logic in `SkribblApp.jsx` evaluates stored credentials: if `gameMode === 'skribbl'` and valid `resumeToken` and `roomId` exist, the app begins in `'restoring'` state and actively initiates session restoration via `register`.
- If no previous Skribbl room exists or the session was for another mode, Skribbl opens cleanly to the `'menu'` view without false `"room not found"` banners.
- When a saved room is expired or absent after a server restart, `SkribblApp.jsx` clears only the Skribbl-specific session credentials, displays a clear explanatory message, and returns the player to the create/join menu.
- When joining explicitly with a room code, invalid codes preserve the real `ROOM_NOT_FOUND` error on the join screen so the player can correct the code.
- Room state synchronization is sequenced: states carry server-side versions and timestamps, and `updateRoomStateSafe` ensures delayed callbacks or out-of-order broadcasts never overwrite newer room states with stale data. Transient identity timing does not cause valid room updates to be discarded.

## Lifecycle Invariants & Reconnect Hardening
- **Idempotency:** Rapid double-clicks or repeated requests for `draw:create-room` (by current lobby host) return existing room state. Repeated `draw:leave-room` requests return `{ success: true, alreadyLeft: true }` without errors or double removals. Reconnection requests by already-connected players return safe room state idempotently.
- **Anti-Resurrection Guards:** When a player explicitly leaves or is kicked, their persistent record is flagged with `departed: true` (and `kicked: true` on kicks). Kicked players attempting to rejoin are rejected with `KICKED_FROM_ROOM`. Departed players attempting to rejoin mid-game or brand new players joining an active game are rejected with `GAME_ALREADY_STARTED`. A departed player may only rejoin when the room is back in `LOBBY`.
- **Cross-Mode Session Isolation:** Leaving a Skribbl room cleans up socket room subscriptions (`draw:${roomId}` and `${sessionId}`). The socket-to-session mapping (`sessionSockets`) is only deleted if the leaving socket is the registered owner and the player has no active game in Undercover or Codenames.
- **Word Pool Resilience & Recycling:** Custom words are sanitized; if empty or whitespace-only, the pool falls back to `defaultWords`. When all words in the pool are exhausted across multiple rounds, `room.usedWords` is automatically recycled (`usedWords = []`), ensuring `generateWordChoices` always produces playable words and preventing stuck `WORD_CHOICE` or `DRAWING` phases.
- **Turn Order Deduplication & Guesser Departure:** `turnOrder` and round shuffling explicitly deduplicate eligible player IDs. If a guesser departs during `DRAWING` and all remaining active guessers have already guessed, `endDrawRound` triggers immediately rather than leaving players waiting for a full timer. If eligible players drop below 2 during an active game, the round settles once without intermediate reveals and cleanly ends in `GAME_RESULT`.
- **Play-Again Reset:** `draw:play-again` clears active timeouts and intervals, resets `usedWords`, resets `turnSequence = 0`, resets hints, and resets all player scores (in `room.players` and `room.playerRecords`) to 0, returning the room cleanly to `LOBBY`.
- **Abandoned Room Reaping:** In addition to empty rooms, `drawRooms` where all real players have been disconnected for longer than `DISCONNECT_GRACE_MS` are destroyed, clearing all timers, rate limits, and broadcasting `room-closed`.