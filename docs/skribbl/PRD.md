# SKRIBBL / DRAW & GUESS — Product Requirements

## Status
Implemented playable online mode.

## Goal
Provide a mobile-first online drawing-and-guessing game inside the existing application using its shared Socket.IO/session infrastructure.

## Room
Create, join, reconnect, explicitly leave and host-kick are supported. Network disconnect must not remove a player.

## Flow
`LOBBY → WORD_CHOICE → DRAWING → ROUND_REVEAL → next turn/round → GAME_RESULT`

## Drawer
The server selects the drawer. The drawer receives private word choices and draws on the shared canvas. Timer authority remains on the server.

## Guessers
Guessers see synchronized strokes and hints, submit guesses and receive server-authoritative results/points.

## Word Privacy
The selected word remains private from unauthorized guessers until server-authorized reveal/result state.

## Drawing
Canvas must support pointer/touch input, synchronized strokes, reset between turns, bounded drawing and reconnect preservation.

## Hints
Progressive server-authoritative hints are synchronized and preserved during reconnect.

## Scoring
Points are authoritative on the server. Client UI only presents server values.

## Mobile
Respect safe-area insets, keyboard visibility, touch targets and no horizontal overflow.

## Result
Show final scores/ranking and available next actions without forcing a new room.