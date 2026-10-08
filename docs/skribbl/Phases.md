# SKRIBBL / DRAW & GUESS — Development Phases

## Status
Core online mode implemented.

## Phase 1 — Mode Integration
**Implemented:** isolated Draw & Guess client module, shared Socket.IO connection, isolated draw-room state and mode integration.

## Phase 2 — Room / Lobby
**Implemented:** create/join, room state, host controls, leave game and room sharing/join support.

## Phase 3 — Drawing Core
**Implemented:** canvas, synchronized strokes, drawer turns and canvas reset.

## Phase 4 — Word Choice
**Implemented:** private word choices, server-authoritative selection and timeout.

## Phase 5 — Guessing / Chat
**Implemented:** guesses, chat/system messages and correct-guess handling.

## Phase 6 — Hints
**Implemented:** progressive hints and server-authoritative hint timing.

## Phase 7 — Scoring / Results
**Implemented:** authoritative points, round reveal and final ranking.

## Phase 8 — Lifecycle / Reconnect
**Implemented:** resume-token reconnect, duplicate prevention, disconnected-player retention and active-drawer timer/state restoration.

## Phase 9 — Mobile / Responsive UX
**Implemented/maintained:** mobile layout, keyboard visibility, safe-area handling and responsive canvas/controls.

## Phase 10 — Maintenance
Preserve word privacy, server authority, timer correctness, stale-turn protection and reconnect behavior. Never reintroduce disconnect-as-leave behavior.