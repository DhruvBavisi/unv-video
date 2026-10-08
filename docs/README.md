# Project Documentation

Documentation is organized by game mode so each mode has an independent source of truth.

## Structure

```
docs/
├── README.md
├── undercover/
│   ├── Architecture.md
│   ├── Design.md
│   ├── Memory.md
│   ├── PRD.md
│   ├── Phases.md
│   └── Rules.md
├── skribbl/
│   ├── Architecture.md
│   ├── Design.md
│   ├── Memory.md
│   ├── PRD.md
│   ├── Phases.md
│   └── Rules.md
└── codenames/
    ├── Architecture.md
    ├── Design.md
    ├── Memory.md
    ├── PRD.md
    ├── Phases.md
    └── Rules.md
```

## Mode Status

| Mode | Status | Client | Server State |
|---|---|---|---|
| Undercover | Implemented | `src/game/` | `rooms` |
| Skribbl / Draw & Guess | Implemented | `src/drawgame/` | `drawRooms` |
| Codenames | Planned | `src/codenames/` | planned dedicated room state |

## Shared Infrastructure

All modes use the shared Socket.IO/session foundation where applicable:
- `src/game/socket.js`
- `src/game/identity.js`
- shared server Socket.IO instance
- session ID
- resume token
- explicit Leave Game / host kick lifecycle

Game-specific state and events must remain isolated.

## Documentation Rule

When changing a mode, update that mode's six documents first.

When changing shared infrastructure, review all three mode Architecture and Rules documents plus this README.

Do not mix game-specific requirements into another mode's documentation.

## Codenames Status

Codenames is specification-only. Its six documents define the implementation contract but do not claim runtime code exists.
