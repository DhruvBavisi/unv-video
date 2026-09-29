# SKRIBBL / DRAW & GUESS — Design System

## 1. Design Direction

DRAW & GUESS is a second game mode inside the same application as UNDERCOVER.

It must feel related to the existing product:

- same visual identity,
- same quality bar,
- same animation discipline,
- same tactile UI language,
- same responsive philosophy.

It must not look like a generic clone of a web drawing dashboard.

The mode can become more playful and drawing-focused while retaining the application's established mystery/game-world foundation.

## 2. Shared Product Language

Reuse the existing game's:

- typography hierarchy,
- button treatment,
- card treatment,
- spacing system,
- borders,
- shadows,
- transitions,
- notification patterns,
- modal behavior,
- loading states,
- sound architecture,
- responsive conventions.

Do not copy unrelated visual styles from external drawing games.

## 3. Mode Select

Mode selection should be the visual bridge between the cinematic landing page and the two gameplay systems.

Concept:

```text
CHOOSE YOUR GAME

┌───────────────────┐   ┌───────────────────┐
│    UNDERCOVER     │   │   DRAW & GUESS    │
│                   │   │                   │
│  Social Deduction │   │  Draw. Guess. Win.│
│                   │   │                   │
│   PLAY MODE       │   │   PLAY MODE       │
└───────────────────┘   └───────────────────┘
```

Cards should share the same physical/tactile treatment used elsewhere in the application.

Animation:

- subtle entrance,
- hover/tap lift,
- focused selection,
- smooth transition into the selected mode.

Avoid excessive bounce or flashy gaming effects.

## 4. Lobby

The Draw & Guess lobby should feel like a game room, not an admin panel.

Information hierarchy:

1. Game title/mode.
2. Room ID.
3. Players.
4. Host/settings.
5. Primary start action.

Settings can use compact cards/controls.

Recommended groups:

```text
GAME SETTINGS
├── Players
├── Drawing Time
├── Rounds
├── Word Choices
└── Hints

WORD SETTINGS
├── Normal / Hidden / Combination
├── Custom Words
└── Custom Only
```

## 5. Player List

Each player card can show:

- avatar/character,
- player name,
- ready state,
- host indicator,
- connection/spectator state where needed.

Do not reveal hidden word information.

## 6. Drawing Screen

Primary hierarchy:

```text
┌────────────────────────────────────────────┐
│ ROUND / DRAWER / TIMER                     │
├───────────────────────────┬────────────────┤
│                           │                │
│                           │  PLAYERS       │
│                           │                │
│          CANVAS           │  SCORE         │
│                           │                │
│                           │                │
├───────────────────────────┴────────────────┤
│ TOOLBAR                                    │
│ [UNDO] [ERASER] [COLOR] [SIZE] [CLEAR]    │
├────────────────────────────────────────────┤
│ CHAT / GUESSES                             │
└────────────────────────────────────────────┘
```

The exact layout can adapt responsively.

Desktop:

- large canvas,
- compact player/score area,
- chat alongside or beneath depending on existing shell.

Mobile:

```text
TIMER
DRAWER
CANVAS
TOOLS
CHAT/GUESS
PLAYERS/SCORE
```

Prioritize the canvas and current action.

## 7. Canvas

The canvas is the visual centerpiece of gameplay.

Requirements:

- crisp rendering,
- no visible latency under normal conditions,
- pointer/touch support,
- clear drawing boundary,
- responsive dimensions,
- no accidental page scrolling while drawing.

Use a visually appropriate surface rather than a sterile white admin panel.

The surface may resemble:

- paper,
- investigation board,
- drawing sheet,
- tactile game card,

provided it remains high-contrast and readable.

## 8. Word Mask

Place the answer mask where it remains visible without dominating the drawing area.

Example:

```text
_ _ _ _   _ _ _ _
```

When a letter is revealed:

```text
_ A _ _   _ _ _ _
```

Use restrained animation for newly revealed letters.

Do not expose hidden letters through DOM attributes, accessibility text or client-side debug data where that would leak the answer.

## 9. Timer

The timer should be immediately visible.

It may use:

- numeric countdown,
- subtle progress ring/bar,
- final-seconds emphasis.

Do not make the timer visually overwhelming.

The server owns time; the UI only visualizes it.

## 10. Chat

One chat area handles:

- ordinary messages,
- guesses,
- system messages,
- correct-guess notifications.

Correct answers must not appear in the visible chat.

Example:

```text
Aarav: Is it a house?
Riya: Maybe a building?
SYSTEM: Dev guessed the word!
```

The successful player's own interface may show:

```text
✓ Correct!
+266
```

## 11. Scoreboard

Show scores without taking attention away from the canvas.

During a round:

```text
PLAYER       SCORE
Aarav        820
Riya         690
Dev          540
```

Highlight the current drawer subtly.

Do not use excessive leaderboard animation during active drawing.

## 12. Word Choice

Drawer-only interface:

```text
CHOOSE A WORD

[ OPTION 1 ]
[ OPTION 2 ]
[ OPTION 3 ]

15
```

The choices should feel like physical cards consistent with the existing game UI.

Only the drawer sees this screen.

Other players see:

```text
Aarav is choosing a word...
```

## 13. Hint Animation

When a letter appears:

- animate only the newly revealed character,
- avoid large screen transitions,
- keep the drawing visible.

The reveal should feel like a helpful game event, not an interruption.

## 14. Round Reveal

At the end of drawing:

```text
THE WORD WAS

"MICROPHONE"

+333
+266
+216
```

Show:

- answer,
- correct guess order,
- points,
- drawer points.

Hold long enough to read, then transition cleanly.

## 15. Game Result

Use the existing product's cinematic result philosophy.

Example:

```text
FINAL RESULTS

1  AARAV       2480
2  RIYA        2210
3  DEV         1940

[ PLAY AGAIN ]
```

Use controlled motion and clear hierarchy.

## 16. Animation Rules

Prefer:

- transform,
- opacity,
- scale,
- controlled card movement.

Avoid:

- random floating animations,
- excessive springs,
- unnecessary particle effects,
- animations that delay user actions,
- animations that interfere with timers.

Gameplay transitions should feel fast enough for multiplayer.

## 17. Shared Animation Compatibility

Do not create a second incompatible animation system merely for Draw & Guess.

If the existing application already has an animation utility/system, use it where practical.

Draw-specific canvas rendering remains separate from UI animation.

## 18. Sound

Reuse the application's centralized audio architecture.

Potential Draw & Guess sounds:

- mode selection,
- word choice,
- countdown,
- drawing start,
- hint reveal,
- correct guess,
- round result,
- final result,
- player join/leave.

Audio should remain optional and muted by user preference.

## 19. Responsive Rules

### Desktop

Prioritize:

- large drawing surface,
- visible player scores,
- chat,
- drawing tools.

### Tablet

Reduce side panels and enlarge touch controls.

### Mobile

Prioritize:

1. timer
2. canvas
3. tools for drawer
4. word mask
5. chat/guess
6. score/player information

Controls must be large enough for touch.

## 20. Accessibility

Provide:

- keyboard navigation,
- visible focus states,
- accessible control labels,
- readable contrast,
- non-color-only status indicators,
- reduced-motion behavior,
- accessible chat semantics.

Do not expose private words through accessibility content to unauthorized players.

## 21. Error States

Examples:

```text
CONNECTION LOST
Reconnecting...

DRAWER DISCONNECTED
Waiting for reconnection...

ROOM FULL
This room cannot accept another player.

GAME STARTED
You joined as a spectator and will enter next round.
```

Keep errors within the existing product's visual language.

## 22. Loading

Do not introduce unnecessary loading screens between every phase.

Prefer immediate state transitions with small visual feedback.

Only block the interface when required.

## 23. Quality Bar

The finished Draw & Guess interface should feel like a polished second game mode of the existing product.

It should not feel like:

- a CRUD dashboard,
- a generic whiteboard,
- a copied SaaS interface,
- an unrelated game embedded into the website.

The user should be able to move:

```text
LANDING
→ MODE SELECT
→ DRAW & GUESS
```

without feeling that they have left the original application.
