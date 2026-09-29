# SKRIBBL / DRAW & GUESS — Development Phases

## Development Rule

Build one phase at a time.

After every phase:

1. Run the application.
2. Run typecheck/build.
3. Run relevant tests.
4. Verify existing UNDERCOVER behavior.
5. Verify the new Draw & Guess behavior.
6. Fix regressions before proceeding.
7. Update `Memory.md`.

Never implement a later phase by silently weakening an earlier one.

---

## PHASE 0 — Repository Audit

Before changing code:

- inspect the current repository,
- inspect `App.jsx` and navigation,
- inspect the existing socket connection,
- inspect Undercover room lifecycle,
- inspect server event registration,
- inspect reconnect logic,
- inspect moderation,
- inspect shared UI/animation systems,
- inspect current tests.

Acceptance:

- no architecture is changed yet,
- integration points are documented,
- existing build/tests remain clean.

---

## PHASE 1 — Mode Selection Boundary

Add the application-level mode selection.

Conceptually:

```text
landing
   ↓
mode-select
   ├── undercover
   └── drawguess
```

Requirements:

- preserve existing landing behavior,
- preserve existing Undercover entry flow,
- add Draw & Guess entry,
- use the same visual language,
- add smooth transitions,
- avoid duplicating the application shell.

Acceptance:

- both modes can be selected,
- existing Undercover flow still works.

---

## PHASE 2 — Draw Game Skeleton

Create the isolated Draw & Guess module:

```text
src/drawgame/
├── gamePhases.*
├── gameState.*
├── roomState.*
├── components/
└── ...
```

Implement:

- phase constants,
- initial state,
- room configuration,
- player model,
- basic state transitions.

Do not implement drawing yet.

Acceptance:

- Draw & Guess can enter a lobby state,
- no Undercover state is modified.

---

## PHASE 3 — Draw Room Server

Add:

```ts
drawRooms
```

Implement:

- create room,
- join room,
- leave room,
- host identity,
- room configuration,
- ready state,
- basic cleanup.

All events use `draw:`.

Acceptance:

- two or more browsers can create/join a Draw room,
- Undercover rooms continue working independently.

---

## PHASE 4 — Draw Lobby UI

Build the Draw & Guess lobby using the existing design system.

Include:

- room ID,
- player list,
- host marker,
- ready state,
- settings,
- word mode,
- custom word configuration,
- rounds,
- drawing time,
- word choice count,
- hints,
- start button.

Acceptance:

- responsive desktop/mobile lobby,
- no generic SaaS dashboard appearance,
- host controls are authoritative.

---

## PHASE 5 — Word System

Implement:

- default word pool,
- custom word pool,
- custom-only mode,
- combination mode,
- unique word selection,
- game-level used-word tracking,
- private word choices.

Acceptance:

- only drawer sees choices,
- no duplicate selected words,
- timeout automatically selects a word.

---

## PHASE 6 — Word Choice Phase

Implement:

```text
WORD_CHOICE
```

Requirements:

- approximately 15-second timeout,
- drawer-only choice UI,
- server timeout,
- automatic selection,
- transition to DRAWING.

Acceptance:

- room cannot stall when drawer does nothing.

---

## PHASE 7 — Canvas Foundation

Implement the drawing canvas.

Support:

- pointer input,
- mouse,
- touch,
- pen where supported,
- brush,
- eraser,
- color,
- size,
- clear,
- undo,
- fill if supported by the chosen implementation.

Keep canvas implementation isolated from server state.

Acceptance:

- drawer can draw smoothly,
- controls work on desktop and mobile.

---

## PHASE 8 — Real-Time Canvas Sync

Implement:

```text
draw:stroke-start
draw:stroke-point
draw:stroke-end
draw:fill
draw:undo
draw:clear
```

Server validates that only the active drawer can send drawing events.

Acceptance:

- other clients see drawing in real time,
- no polling,
- drawing remains smooth under normal room sizes.

---

## PHASE 9 — Stroke Replay / Reconnect

Implement:

- server-side stroke log,
- canvas replay,
- reconnect recovery,
- late-viewer synchronization.

Acceptance:

- refreshing/reconnecting during drawing reconstructs the current canvas,
- no raster screenshot dependency.

---

## PHASE 10 — Guess Chat

Implement one combined chat channel.

Requirements:

- normal chat messages,
- guesses,
- server normalization,
- server answer validation,
- correct-guess privacy,
- correct-guess order.

Acceptance:

- wrong guesses appear as normal chat,
- correct answer text is never broadcast,
- correct player receives private confirmation.

---

## PHASE 11 — Timer System

Implement server-authoritative:

- word-choice timer,
- drawing timer,
- round-reveal timer.

Clients render countdowns from server timestamps.

Acceptance:

- refresh/reconnect does not restart timers,
- all clients converge on the same phase.

---

## PHASE 12 — Hint / Reveal System

Implement:

- configurable hint count,
- reveal windows,
- random hidden-letter selection,
- space preservation,
- hidden mode bypass.

Acceptance:

- correct number of hints,
- no answer leakage,
- hidden mode never reveals letters.

---

## PHASE 13 — Scoring

Implement the centralized v1 formula.

Test:

- first guess,
- second guess,
- third guess,
- fourth+,
- slow guesses,
- no guesses,
- drawer scoring.

Acceptance:

- deterministic server scores,
- no client score mutation.

---

## PHASE 14 — Round Loop

Implement:

```text
WORD_CHOICE
→ DRAWING
→ ROUND_REVEAL
→ NEXT DRAWER
→ ...
→ NEXT ROUND
```

Requirements:

- every eligible player draws exactly once per round,
- server-shuffled turn order,
- no duplicate turns,
- correct round counter.

Acceptance:

- complete multi-player round loop.

---

## PHASE 15 — Game Result

Implement:

- final leaderboard,
- total score,
- final result animation,
- reveal state,
- Play Again.

Acceptance:

- final scores match server state,
- Play Again resets correctly.

---

## PHASE 16 — Shared Room / Join Integration

Connect Draw & Guess to the existing:

- QR joining,
- URL joining,
- room code UI,
- reconnect system,
- session identity.

Do not duplicate these systems if they are already mode-agnostic.

Acceptance:

- all existing join mechanisms work for Draw & Guess.

---

## PHASE 17 — Moderation

Integrate:

- kick,
- mute,
- report,
- votekick where supported.

Use mode-safe authorization.

Acceptance:

- moderation cannot affect an unrelated Undercover room.

---

## PHASE 18 — Visual Integration

Match the established game identity.

Reuse:

- card treatment,
- transitions,
- typography,
- spacing,
- animation philosophy,
- audio architecture,
- theme tokens,
- responsive patterns.

Draw-specific UI may introduce canvas controls, color palettes and drawing tools.

Acceptance:

- Draw & Guess looks like the same product,
- Undercover visual behavior is unchanged.

---

## PHASE 19 — Mobile

Test:

- portrait,
- landscape,
- touch drawing,
- chat input,
- word choice,
- timers,
- lobby settings,
- result screen.

Canvas must not interfere with page scrolling unintentionally.

Acceptance:

- usable on small screens,
- no accidental page zoom or broken pointer capture.

---

## PHASE 20 — Reliability / Edge Cases

Test:

- drawer disconnect,
- guesser disconnect,
- reconnect,
- host disconnect,
- duplicate guess,
- duplicate drawing event,
- invalid phase action,
- expired timer,
- no available words,
- custom-only with insufficient words,
- maximum players,
- minimum players,
- rapid canvas input.

Acceptance:

- no room deadlocks,
- no invalid state transitions.

---

## PHASE 21 — Full Regression

Run:

- existing Undercover tests,
- Draw & Guess unit tests,
- socket integration tests,
- Playwright flows,
- responsive tests.

Required full flows:

1. Undercover existing flow.
2. Mode selection.
3. Draw room creation.
4. Draw room joining.
5. Word choice.
6. Drawing.
7. Guessing.
8. Correct guess.
9. Hint.
10. Round transition.
11. Multi-round game.
12. Final result.
13. Play Again.
14. Reconnect.
15. Late join.
16. Moderation.

---

## PHASE 22 — Production Readiness

Verify:

- production build,
- environment configuration,
- Socket.IO production connection,
- room cleanup,
- rate limits,
- asset loading,
- canvas performance,
- mobile performance,
- error handling,
- logging.

Do not deploy Draw & Guess by disabling or bypassing existing Undercover checks.

---

## PHASE 23 — Post-Launch Tuning

Only after real playtesting:

- tune scoring,
- tune timer defaults,
- tune hint frequency,
- improve word selection,
- improve drawing controls,
- evaluate close-guess feedback.

Keep tunable constants centralized.
