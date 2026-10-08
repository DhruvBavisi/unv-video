# CODENAMES — Design

## Status
**Specification only — not implemented yet.**

## Design Goal
Create a premium, clean board-game experience that is visually distinct from Undercover's classified investigation aesthetic and from Skribbl's drawing UI.

Priorities:
1. Board readability
2. Team clarity
3. Hidden-information privacy
4. Fast clue/reveal interaction
5. Excellent mobile layout

## Board
The core game board is a 5×5 grid of 25 word cards.

Each card should:
- have a readable word
- maintain a clear unrevealed state
- provide a strong selected/revealed state
- avoid excessive animation
- remain tappable on mobile

The board must fit within the viewport without horizontal scrolling.

## Team Presentation
Use distinct Red and Blue team identity.

Display:
- current team
- team members
- Spymaster/Operative role
- remaining team agents
- game result

Do not depend on color alone; include text/icons/status labels.

## Spymaster View
Spymaster receives a private board-key view showing each card's hidden category.

The key should be visually obvious but never leaked to Operatives.

## Operative View
Operatives see:
- words
- revealed-card states
- current clue
- clue number
- guesses remaining
- team/turn state

They do not receive hidden card identities.

## Clue Panel
Show:
```
CLUE
"SPACE"
3
```

The clue and number are submitted by the current team's Spymaster.

During guessing, clearly show the number of remaining guesses.

## Interaction
Card selection should be immediate and understandable:
- tap/click a card
- show a confirmation/reveal transition
- update authoritative state
- disable invalid cards

Do not allow speculative client-only reveals.

## Lobby
Include:
- room ID
- copy/share controls
- QR support if the shared application already provides it
- player list
- team assignment
- role assignment
- host controls
- start button

## Mobile
Preferred layout:
1. top status/turn strip
2. 5×5 board
3. clue panel
4. team/player panel
5. chat if added

Keep the board as the primary interaction surface.

## Motion
Use restrained transitions:
- card reveal
- team turn change
- clue appearance
- result transition

Respect reduced-motion preferences.

## Accessibility
- keyboard-accessible cards
- visible focus
- semantic team/role labels
- no color-only meaning
- minimum 16px form-control text
- hidden key information must not appear in accessible labels or DOM attributes
