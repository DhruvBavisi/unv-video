# Project Documentation

Documentation is organized by game mode so each mode has an independent, authoritative source of truth, alongside shared platform infrastructure documentation.

## Documentation Index

```
docs/
├── README.md                          # Platform documentation index (this file)
├── undercover/                        # Undercover (Social Deduction & Investigation)
│   ├── Architecture.md                # Client/server architecture & landing page structure
│   ├── Design.md                      # Bebas Neue / dark cinematic aesthetic spec
│   ├── Memory.md                      # Product history, role balance, & core decisions
│   ├── PRD.md                         # Product requirements for Undercover
│   ├── Phases.md                      # Development phases & mobile LAN stability history
│   └── Rules.md                       # Authoritative gameplay & role reveal rules
├── skribbl/                           # Skribbl (Draw & Guess Multiplayer)
│   ├── Architecture.md                # Canvas sync, turn lifecycle, & server architecture
│   ├── Design.md                      # Fredoka / playful theme & responsive UI spec
│   ├── Memory.md                      # Reconnection rules, word choice, & state sync
│   ├── PRD.md                         # Product requirements for Skribbl
│   ├── Phases.md                      # Development phases 1–21 (lifecycle, hints, scoring)
│   └── Rules.md                       # Authoritative turn, guessing, & scoring rules
└── codenames/                         # Codenames (Classic Board Game)
    ├── Architecture.md                # 5x5 board sync, Spymaster privacy, & socket events
    ├── Design.md                      # Classic 2015 board-game aesthetic spec
    ├── Memory.md                      # Single-player start, late join, & role requirements
    ├── PRD.md                         # Product requirements for Codenames
    ├── Phases.md                      # Development phases & implementation status
    └── Rules.md                       # Team assignments, clues, & reveal mechanics
```

## Repository Architecture

```
unv/
├── src/
│   ├── app/                           # Application shell, mode router, GameErrorBoundary
│   ├── games/
│   │   ├── undercover/                # OnlineGame.jsx, components/, data/, gamePhases, gameState
│   │   ├── skribbl/                   # SkribblApp.jsx, components/, hooks/, finalScoresRanking
│   │   └── codenames/                 # CodenamesApp.jsx, components/, styles/
│   ├── landing/                       # Hero, CinematicSequence, Investigation, FinalCTA, lib/, data/
│   └── shared/
│       ├── realtime/                  # Shared Socket.IO client (socket.js)
│       ├── session/                   # Player identity & resume token storage (identity.js)
│       ├── components/                # Button, ModeSelect, QRModal, QRScannerModal
│       ├── hooks/                     # useMobileKeyboardFocus, usePageBackground
│       └── styles/                    # globals.css, sk-pwa-background.css
├── server/
│   ├── server.js                      # Application bootstrap, Express HTTP, health check & Socket.IO server
│   ├── shared/
│   │   ├── sessionRegistry.js         # sessionSockets map, connectPlayer, ensureResumeToken
│   │   └── utils.js                   # makeRoomId, shuffle, normalizeOrigin, isOriginAllowed
│   └── games/
│       ├── undercover/                # undercoverState.js, undercoverHandlers.js, specialRolesHooks.js, prodWords.json, dev/botManager.js
│       ├── skribbl/                   # skribblState.js, skribblHandlers.js, drawWords.json
│       └── codenames/                 # codenamesState.js, codenamesHandlers.js, boardGenerator.js, words.js
├── public/
│   ├── icons/                         # App & PWA icons (icon-192, icon-512, apple-touch-icon)
│   ├── images/
│   │   ├── characters/                # 27 Undercover character portraits & badges
│   │   ├── investigation-room-30fps/  # 300-frame 30fps cinematic scrub sequence
│   │   ├── cinematic/                 # 480-frame evidence surveillance frames
│   │   ├── investigation-room/        # Hero, logo, and section background plates
│   │   └── svg/                       # 8 Skribbl toolbar and canvas SVG icons
│   └── videos/                        # Undercover_cinematic_30fps.mp4 (active video scrub fallback)
└── tests/                             # Unit, integration, and QA test suites
```

## Mode Implementation Status

| Mode | Status | Frontend Module | Backend Module & Store | Socket Event Pattern |
| :--- | :--- | :--- | :--- | :--- |
| **Undercover** | Implemented | `src/games/undercover/` | `server/games/undercover/` (`rooms`) | Unprefixed (`create-room`, `join-room`, `submit-clue`, `vote`, `mr-white-guess`, `play-again`) |
| **Skribbl / Draw & Guess** | Implemented | `src/games/skribbl/` | `server/games/skribbl/` (`drawRooms`) | Prefixed: `draw:*` (`draw:create-room`, `draw:choose-word`, `draw:stroke`, `draw:guess`, `draw:play-again`) |
| **Codenames** | Implemented | `src/games/codenames/` | `server/games/codenames/` (`codenamesRooms`) | Prefixed: `codenames:*` (`codenames:create-room`, `codenames:join-room`, `codenames:join-team-role`, `codenames:start-game`, `codenames:give-clue`) |

## Shared Platform Infrastructure

All three games operate on a unified connection, session, and recovery foundation:
- **Universal Transport:** Single Socket.IO server on default namespace (`/`) initialized in `server/server.js`, consumed by `src/shared/realtime/socket.js`.
- **Persistent Player Identity:** Managed by `src/shared/session/identity.js`, storing player credentials (`sessionId`, `playerName`, `roomId`, `resumeToken`, `gameMode`) in `localStorage['unv_identity']`. Scoped to browser origin, surviving network drops and page refreshes.
- **Session Resolution:** `src/app/App.jsx` routes returning players back to their active game based on stored credentials and server verification.
- **Client Resilience:** `GameErrorBoundary` protects against unhandled rendering errors with recovery actions ("Return to Mode Selection", "Reload Page").
- **Shared QR Infrastructure:** Game-agnostic invite modal `src/shared/components/QRModal.jsx` and camera scanner `src/shared/components/QRScannerModal.jsx`.
- **Server Lifecycle:** Shared `sessionSockets = new Map()` in `server/shared/sessionRegistry.js` mapping active sessions to sockets, plus periodic `reapAbandonedRooms()` sweep clearing idle rooms across all three games.

## Documentation Guidelines

1. **Mode Independence:** When modifying a specific game mode, update that mode's six documentation files first.
2. **Shared Infrastructure:** When changing shared networking, identity, or server infrastructure, review the Architecture and Rules files of all three modes, plus this README.
3. **No Speculative Verification:** Only document behaviors and state machines that are verified by active source code or automated tests.
