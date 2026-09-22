# UNDERCOVER — Design System

## Design Philosophy
A classified investigation file brought to life as a cinematic game trailer and then transformed into a premium playable investigation interface.

The playable game should feel like entering the same investigation world, not like opening a generic social-game dashboard.

## Color System
- Primary background: `#0B0C0D`
- Secondary background: `#151617`
- Dark surface: `#1C1D1F`
- Warm paper: `#E8E0D0`
- Primary text: `#F5F2EA`
- Secondary text: `#A9A69E`
- Accent: `#B58A52`
- Classified red: `#8E2929`

## Typography
Display: Bebas Neue or Oswald.
Body: Inter or Manrope.

## Character Visual Identity
### The Civilian
Young male. Messy brown hair. Brown eyes. Blue hoodie.

### The Undercover
Adult male. Black fedora. Black leather trench coat.

### Mr. White
Older male. White hair. Full white beard. Cream fedora.

## Character Role UI Layout — Landing Cinematic
Desktop:
- The Civilian (physically LEFT) → Text RIGHT
- The Undercover (physically CENTER) → Text LEFT
- Mr. White (physically RIGHT) → Text LEFT

Mobile: role text stacks to bottom with left alignment to prevent face occlusion.

## Motion
Smooth, deliberate, cinematic, slow, controlled. Avoid bouncing, excessive spring motion, and random floating elements.

The landing character role UI remains exactly synchronized to frame-sequence progress using strict video-time mapping.

# PLAYABLE GAME DESIGN

## Core UX Principle
The game should communicate a clear investigation loop:

`SECRET WORD → CLUE → DISCUSSION → SUSPICION → VOTE → ELIMINATION → CONSEQUENCE`

The UI should always tell the player what phase they are in and what action is expected from them.

## Online Lobby
Visual language:
- classified case header
- Room ID displayed clearly
- player roster as investigation participants
- host controls presented as a case configuration panel
- word category / word-pair configuration
- start investigation action

Avoid generic neon gaming-lobby aesthetics.

## Private Role + Word Reveal

Use a confidential case-file treatment.

The host controls `Reveal Roles` in the lobby. The setting is locked when the investigation starts.

### Reveal Roles ON

Civilian:
`YOUR ROLE — THE CIVILIAN`
`YOUR WORD — OCEAN`

Undercover:
`YOUR ROLE — THE UNDERCOVER`
`YOUR WORD — SWIMMING POOL`

Mr. White:
`YOUR ROLE — MR. WHITE`
`YOUR WORD — NONE`

The local Civilian/Undercover may see their own role-specific avatar and role accent.

### Reveal Roles OFF

The actual role remains assigned and authoritative, but Civilian and Undercover are not explicitly told their role.

Civilian:
- neutral local avatar/presentation
- no Civilian role name
- no Civilian role description
- no Civilian-specific color accent
- Civilian word remains visible

Undercover:
- neutral local avatar/presentation
- no Undercover role name
- no Undercover role description
- no Undercover-specific color accent
- Undercover word remains visible

Mr. White's existing behavior remains unchanged.

When role reveal is OFF, do not replace the role with a misleading visible role. Use a deliberate neutral presentation.

Never reveal another player's private word, actual role, or role-specific avatar. Public player roster representations remain role-neutral in both settings.

## Clue + Chat Interface
Use two clearly separated tabs:

### CLUES
- clue history
- current clue order
- current speaker
- clue input
- 3-word maximum indicator
- duplicate-clue feedback
- submitted clue confirmation

### CHAT
- message history
- normal discussion input
- participant identity
- spectator indication where relevant

The Clues input should visually communicate that only a clue of up to 3 words belongs there.

## Clue Sequence UI
Display something like:

`ROUND 02`
`CLUE ORDER`

`01  PLAYER A  ✓`
`02  PLAYER B  NOW`
`03  PLAYER C  WAITING`

Round 1 must place Mr. White after at least one other player.
Later rounds may place Mr. White first.

## Clue History
Previous-round clues remain accessible until the investigation ends.
Visually separate rounds while maintaining one continuous investigation record.

## Voting UI
Question:
`WHO DO YOU SUSPECT?`

Only valid active targets are selectable.
Self-voting should be unavailable and clearly communicated.

When tied:
`NO DECISION`
`THE VOTE IS TIED`
`REVOTE`

Do not eliminate anyone during a tie.

## Elimination UI
Use a restrained classified-case transition:

`VOTE COMPLETE`
`SUBJECT ELIMINATED`
`PLAYER 04`

If the player is Mr. White, immediately transition to:

`MR. WHITE — FINAL GUESS`

## Mr. White Guess UI
The screen should create pressure without becoming theatrical or arcade-like.

Example:

`LAST CHANCE`
`THE WORD IS...`

`[ ENTER YOUR GUESS ]`

`SUBMIT GUESS`

Result:
- correct → `CASE COMPROMISED — MR. WHITE WINS`
- incorrect → `GUESS INCORRECT — INVESTIGATION CONTINUES`

## Spectator UI
Eliminated players should see a clear:

`SPECTATOR`
`YOU HAVE BEEN ELIMINATED`

They remain connected to the Room ID but cannot clue or vote.

A player joining mid-investigation should see:

`SPECTATOR — JOINING NEXT ROUND`

At the next round boundary they move to the lobby/eligible pool automatically.

## Reconnection UI
If disconnected:

`CONNECTION LOST`
`RESTORING CASE FILE...`

On success:

`CASE FILE RESTORED`

Never reset the player to a new game merely because the browser reconnects.

## Game Result
Use a strong final classified-case treatment.

Possible states:
- `CASE CLOSED — CIVILIANS WIN`
- `CASE COMPROMISED — UNDERCOVER WINS`
- `CASE COMPROMISED — MR. WHITE WINS`
- `CIVILIANS WIN — MR. WHITE SURVIVED`

Show:
- result
- reason
- role reveals
- word pair
- elimination history
- investigation/clue history as appropriate

Actions:
`PLAY AGAIN`
`RETURN TO LOBBY`

## Same-Room Play Again
Play Again must feel like reopening the same case room for a fresh investigation.
The Room ID remains visible/unchanged.
Old roles, words, clues, votes, and round state are reset before the next investigation.

## Responsive Gameplay
Desktop:
- two-column investigation workspace
- player roster + main clue/chat/voting area

Tablet:
- collapsible supporting panels
- main interaction remains prominent

Mobile:
- stacked panels
- sticky action area where appropriate
- clue input and vote actions remain thumb-accessible
- no horizontal overflow

## Accessibility
- semantic tabs for Clues/Chat
- keyboard-accessible clue/chat inputs
- visible focus
- error messages adjacent to invalid fields
- role/word privacy preserved for assistive technology as well as visual UI
- hidden role identity must not be exposed through accessible labels, alt text, tooltips, or DOM attributes
- no color-only game-state communication
- reduced motion respected

## Visual Restraint
Avoid:
- excessive glassmorphism
- cartoonish avatars
- neon cyberpunk styling
- bouncing/spring-heavy interactions
- unnecessary particles
- distracting game-show effects

UNDERCOVER should feel premium, tense, investigative, and deliberate.
