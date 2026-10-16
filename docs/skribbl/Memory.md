# SKRIBBL / DRAW & GUESS — Project Memory

## Status
Implemented playable online mode.

## Project Relationship
Modes:
1. Undercover
2. Skribbl / Draw & Guess
3. Codenames — planned

Skribbl shares the existing Socket.IO server/client/session infrastructure but uses isolated `drawRooms` state.

## Current Features
- create/join room
- lobby/configuration
- drawing turns
- private word choice
- synchronized strokes
- guessing/chat
- hints
- scoring
- round reveal
- game result
- explicit leave
- host kick
- reconnect/resume
- QR/deep-link support where shared application provides it

## Lifecycle
Network disconnect does not remove a player. Reconnect restores the same identity and state without duplicates.

## Play Again & Individual Lobby Entry
Any player can opt in during `GAME_RESULT` without waiting for the host. Opting in immediately transitions that player's view to the existing room's lobby. Non-opted-in players remain on the result overlay with real-time `READY` opt-in badges. When the host opts in early, they may adjust room settings, while `START GAME` remains disabled until all eligible players opt in. Once all eligible, connected players have opted in (or pending players depart/disconnect), the server resets room state, clears the canvas, and synchronizes everyone to `LOBBY` with zeroed scores. Opt-in status is preserved through reconnects during the transition.

## Timer Recovery
Automatic reconnect resumes Word Choice and Drawing timers from stored remaining milliseconds. `0` remains valid and must never restart the original duration.

## Drawing Recovery
A reconnecting drawer preserves selected word, strokes, guesses, hints, score state, round/turn and remaining time.

## Development Principle
Keep Draw & Guess independent from Undercover phases. Shared infrastructure changes must be reviewed across all modes.