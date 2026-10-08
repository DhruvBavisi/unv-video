# CODENAMES — Product Requirements Document

## Status
**Phase 1 implemented.**

## Product Overview
Add Codenames as a third online game mode in the existing application.

Users should be able to select Codenames from the game's mode selector and enter a dedicated Codenames room using the same connection/session infrastructure already used by the other modes.

## Core Roles
Each player is:
- Red Spymaster
- Red Operative
- Blue Spymaster
- Blue Operative

Only one Spymaster is allowed per team.

## Lobby Requirements
Host can:
- create/start the room
- manage team membership
- assign/change Spymasters
- start the game

Players can:
- join by room ID
- reconnect to the same room
- leave explicitly

Room sharing should reuse the existing deep-link/QR infrastructure where appropriate.

## Board Requirements
At game start:
- generate exactly 25 unique word cards
- assign one hidden identity to every card
- generate a valid Codenames distribution with one assassin
- choose the starting team
- reset revealed state

The server owns the board key.

## Gameplay
### Clue Phase
The active team's Spymaster submits:
- one clue word
- one clue number

Server validates:
- correct team
- Spymaster role
- correct phase
- valid clue
- valid number
- no stale game version/action

### Guess Phase
Operatives on the active team can reveal cards.

For each reveal:
- server identifies the card's hidden category
- server marks it revealed
- server broadcasts only the newly public result
- server resolves turn/game state

### Turn Resolution
- own agent: team may continue within remaining guesses
- neutral: turn ends
- opponent: turn ends and control passes appropriately
- assassin: immediate game loss
- explicit End Turn: switch to opposing team

The implementation must follow the chosen Codenames rule set consistently.

## Win Condition
A team wins when all cards belonging to its team have been revealed.

Assassin reveal is an immediate loss for the revealing team.

## Reconnection
Reconnect must restore:
- player identity
- team/role
- room
- current turn
- clue
- revealed board
- available action

Do not duplicate players or reset the game.

## Privacy
Operatives must never receive hidden card identities before reveal.

Spymaster-only data must be delivered privately.

## Result
Show:
- winning team
- final board
- team rosters
- reason for ending
- Play Again / Return to Lobby actions

Play Again should reuse the same room if the shared application convention is retained.
