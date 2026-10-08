# SKRIBBL / DRAW & GUESS — Development Rules

## General
1. Inspect existing Draw & Guess code first.
2. Reuse the shared Socket.IO connection.
3. Keep `drawRooms` isolated from Undercover rooms.
4. Keep authoritative state on the server.
5. Make the smallest appropriate change.
6. Do not regress Undercover or Codenames.

## Socket
Use `draw:` event prefixes. Do not create another Socket.IO server.

## Identity
Reuse session ID, resume token and room ID. Existing-player reconnect requires the correct resume token. Never create a duplicate player.

## Disconnect
Socket disconnect is not Leave Game. Only explicit Leave Game or host kick removes a player. Never add stale-player auto-removal.

## Privacy
The selected word is private. Do not send the full word to unauthorized guessers before reveal.

## Drawing
Server controls drawer, phase and timers. Strokes synchronize and reset for each new turn. Invalid drawing data must not corrupt room state.

## Timers
On drawer disconnect, store remaining Word Choice/Drawing milliseconds. On authenticated reconnect resume exactly that duration. `0` is valid. Never restart the original full duration or create duplicate timers.

## Scoring
Points come from the server. Never trust client-supplied scores.

## Mobile
Keep controls >=16px, respect safe areas, keep guess input above the keyboard and prevent horizontal overflow.

## Shared Infrastructure
Changes to shared socket, identity or lifecycle code must be reviewed for Undercover and future Codenames impact.