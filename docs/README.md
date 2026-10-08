
# UNDERCOVER — Project Documentation

This folder contains the current product, architecture, design, rules and implementation roadmap for the project.

## Core Documentation
- [Architecture.md](./Architecture.md)
- [Design.md](./Design.md)
- [Memory.md](./Memory.md)
- [PRD.md](./PRD.md)
- [Phases.md](./Phases.md)
- [Rules.md](./Rules.md)

## Current Playable Modes
1. **Undercover** — primary investigation game.
2. **Draw & Guess / Skribbl** — separate drawing/guessing game sharing the Socket.IO infrastructure.

Both modes use server-authoritative room state and stable reconnect identity.

## Undercover Current Special Roles
Implemented:
- Joy Fool
- Duelists
- Lovers
- Revenger
- Boomerang
- Goddess of Justice
- Ghost
- Falafel Vendor
- Mr. Meme

## Reconnection Rule
Network/socket disconnect is not Leave Game. Players remain in their rooms and can reconnect using their resume token. Explicit Leave Game and host kick are the removal paths.

## Planned Next Mode — Codenames
Codenames is specified but not yet implemented.

Six dedicated Codenames documents are maintained in [codenames/](./codenames/):
- [Architecture.md](./codenames/Architecture.md)
- [Design.md](./codenames/Design.md)
- [Memory.md](./codenames/Memory.md)
- [PRD.md](./codenames/PRD.md)
- [Phases.md](./codenames/Phases.md)
- [Rules.md](./codenames/Rules.md)

The Codenames documents define the initial implementation contract and must remain consistent with the existing shared Socket.IO/session architecture.
