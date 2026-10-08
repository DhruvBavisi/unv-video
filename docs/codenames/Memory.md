# CODENAMES — Project Memory

## Status
Codenames is **planned/specification-only**. No Codenames runtime implementation should be assumed from this document.

## Relationship to Existing Project
The game will live inside the existing React/Vite project and reuse the existing Socket.IO server and reconnect/session architecture.

Existing modes:
- Undercover
- Draw & Guess / Skribbl

Planned:
- Codenames

## Core Product Decisions
- 5×5 board = 25 words.
- Two teams: Red and Blue.
- Each team has one Spymaster and one or more Operatives.
- Spymasters know the hidden board key.
- Operatives do not.
- One team gives a clue and number each turn.
- Operatives reveal cards until they stop, hit a neutral/opponent card, or hit the assassin.
- Assassin causes immediate loss for the guessing team.
- Team that identifies all of its agents first wins.
- Opponent-agent reveal can immediately end the current team's turn and transfer play.
- Repeated/illegal reveals are rejected by the server.

## Identity / Reconnect
Use the existing:
- sessionId
- resumeToken
- roomId

Reconnect must preserve the same player and role/team assignment.

## Privacy
The complete key must never be included in the Operative payload, even if the client could theoretically hide it.

## Planned Implementation Sequence
1. Codenames room lifecycle
2. Team/role assignment
3. board generation
4. private/public state builders
5. clue phase
6. reveal/guess phase
7. win conditions
8. reconnect/lifecycle
9. responsive UI
10. polish/QA

## Non-Goals
- Do not create a new socket server.
- Do not modify Undercover rules.
- Do not modify Skribbl rules.
- Do not add voice/video as a prerequisite.
- Do not implement Pass & Play as part of the initial Codenames scope.
