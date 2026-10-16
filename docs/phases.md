# Project Development Phases

Refer to the mode-specific phase roadmaps for authoritative tracking:
- [Undercover Phases](file:///c:/Users/dhruv/OneDrive/Documents/Desktop/React/unv/docs/undercover/Phases.md)
- [Skribbl / Draw & Guess Phases](file:///c:/Users/dhruv/OneDrive/Documents/Desktop/React/unv/docs/skribbl/Phases.md)
- [Codenames Phases](file:///c:/Users/dhruv/OneDrive/Documents/Desktop/React/unv/docs/codenames/Phases.md)

---

## Recent Skribbl Additions

### Phase 11 — Persistent Network Status & Settings Room Code / QR
- **Persistent Network Status Indicator:**
  - Added `<SkribblNetworkStatus />` component visible across all screens (menu, create/join, lobby, all gameplay phases).
  - Displays exactly three states: `Connected` (mint/green), `Connecting` (pulsing amber/yellow), and `Disconnected` (coral).
  - Actively tracks Socket.IO connection and reconnection events in `SkribblApp.jsx` with full cleanup and stale event protection.
  - Positioned safely near the top bar / notch area with `--sk-*` theme styling and responsive mobile handling.
- **In-Game Settings Room Code & QR Modal:**
  - `DrawingPhase.jsx` passes `roomId={room.id}` into `SettingsPanel.jsx`.
  - Normal Settings view displays a compact Room Code row above Leave Game / Resume actions.
  - Includes a copy button with temporary visible confirmation (`COPIED!`) and failure handling.
  - Includes a QR button opening the existing `src/game/QRModal.jsx` with full `ENTERING → OPEN → EXITING` flyout animation layered cleanly above the Settings panel.

---

## Mobile LAN Stability & Insecure Context Hardening

### Phase 12 — Mobile LAN Mode Selection & Insecure Context Resiliency
- **Cross-Platform UUID Generation Fallback (`src/game/identity.js`):**
  - Addressed `TypeError: crypto.randomUUID is not a function` occurring on mobile browsers connecting over LAN HTTP (`http://<ip>:5173`) where Web Cryptography secure-context APIs are unavailable.
  - Implemented standard RFC4122 v4 UUID generator with graceful 3-tier fallback hierarchy: `crypto.randomUUID()` → `crypto.getRandomValues()` → pseudorandom RFC4122 template.
  - Wrapped `localStorage` accesses in resilient try/catch wrappers with in-memory storage fallback for private browsing mode and sandboxed mobile environments.
- **Client Render Error Boundary (`src/App.jsx`):**
  - Implemented `GameErrorBoundary` with user-facing recovery options ("Return to Mode Selection" and "Reload Page") and expandable diagnostic details.
  - Wrapped game mode components (`Undercover`, `Skribbl`, `Codenames`) and top-level session resolver inside `GameErrorBoundary` to prevent white-screen crashes.
  - Added a 5-second automatic timeout and manual Cancel escape hatch to `SessionResolver` so offline server connections never leave users on a blank or stuck screen.
- **Defensive Rendering & Clipboard Fallbacks:**
  - `src/game/OnlineGame.jsx`: Safeguarded `state.connectionState` string conversion, added fallback UI if `activePhase` is unrecognized, added a Cancel button during session restoration, and implemented textarea fallback for room ID and invite URL copying when `navigator.clipboard` is restricted.
  - `src/game/PlayersPanel.jsx`: Added textarea fallback for room code copying under insecure HTTP contexts.
  - `src/drawgame/SkribblApp.jsx`: Added a 5-second timeout and Cancel button to the session restoration view.
  - `src/codenames/CodenamesApp.jsx`: Added a Back to Game Modes cancel button to the session restoration screen.
- **Socket.IO Connection Resilience (`src/game/socket.js`):**
  - Ensured `connectSocket()` properly invokes `socket.connect()` when an existing disconnected socket instance is reused or newly initialized.

---

## Mobile Keyboard Native Word Suggestions

### Phase 13 — Mobile Keyboard Native Word Suggestions Restoration
- **Skribbl Guess / Chat Input (`src/drawgame/components/DrawingPhase.jsx`):**
  - Removed suppression attributes (`autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}`) that disabled the mobile operating system's native predictive text and word suggestion bar above virtual keyboards (iOS QuickType and Android Gboard/Samsung Keyboard).
  - Configured mobile-friendly attributes: `autoComplete="on"`, `autoCorrect="on"`, `spellCheck={true}`, and `autoCapitalize="sentences"`.
  - Preserved native keyboard behavior without injecting custom keyboards or suggestion bars.
  - Kept secret word privacy intact with generic placeholders and zero drawer word exposure to guessers.
  - Preserved Enter-to-submit behavior, focus management, touch responsiveness, letterboxed 4:3 canvas layout, and `useGuessKeyboard` visual viewport integration.

---

## Skribbl Entry & Stale-Session Recovery

### Phase 14 — Entry Experience & Stale-Session Recovery
- **Safe Entry & Elimination of False "Room Not Found" Errors (`src/drawgame/SkribblApp.jsx`):**
  - Selecting Skribbl from game-mode selection opens the clean create/join menu without displaying `"We couldn't find that room."` when there is no saved Skribbl room.
  - Initial `view` enters `'restoring'` only when valid stored Skribbl session credentials (`resumeToken`, `roomId`, and `gameMode === 'skribbl'`) exist.
  - Active session restoration triggers immediately on mount if the socket is already connected.
  - When a saved Skribbl room is no longer found on the server (e.g. game ended or server restarted), `handleNoRoom` clears only the Skribbl-specific session credentials (`clearSkribblSession()`), displays an informative message (*"The previous room is no longer available."*), and returns the player to the menu.
  - Explicit room-join attempts with an invalid room code preserve the real `ROOM_NOT_FOUND` error on the join screen so the player can correct the code.
- **Server-Side Registration & Reap Fixes (`server/server.js`):**
  - Updated socket `register` handler so clients without a `clientRoomId` and `resumeToken` register their socket connection without triggering false `session-no-room` events.
  - Enhanced room resolution to check the specific room target (`clientRoomId`) across game mode collections, preventing cross-mode room collisions between Undercover and Skribbl.
  - Added monotonic versioning (`version`) and timestamps (`updatedAt`) to Skribbl room states and safe state projections.
  - Fixed `sessionSockets` cleanup during server-wide room reaping to check `findDrawRoomByPlayer` and `findCodenamesRoomByPlayer` alongside Undercover, preventing Skribbl players' socket ownership mappings from being prematurely deleted.
- **Client State Synchronization & Race Condition Guarding (`src/drawgame/SkribblApp.jsx`):**
  - Introduced `updateRoomStateSafe` to compare incoming versions and timestamps, ensuring create/join callbacks or out-of-order broadcasts never overwrite newer room states with stale snapshots.
  - Expanded `handleRoomState` acceptance criteria to prevent dropping valid updates due to transient identity mismatches during reconnection.

---

## Skribbl Drawer Ownership & Turn Transitions

### Phase 15 — Drawer Ownership & Turn Transition Stabilization
- **Server Authoritative Drawer State & Race Elimination (`server/server.js`):**
  - Made `room.currentDrawerId`, `room.phase`, `room.round`, and `room.turnIndex` strictly authoritative on the server.
  - Eliminated duplicate room-state broadcasts on socket registration and join-room reconciliation.
  - Added monotonic `room.turnSequence` tracking to validate and guard turn transitions against stale or competing callbacks.
  - Protected `draw:choose-word` to accept word selections strictly from the active drawer during `WORD_CHOICE`, atomically clearing the word choice timeout and transitioning to `DRAWING` exactly once. Stale or duplicate selections are rejected without resetting turn timers.
  - Added 6-way callback validation to word-choice timeout, drawing turn timeout, hint interval, and reveal timeout (room ID, round, turnIndex, currentDrawerId, turnSequence, and expected phase). Obsolete timers are cleared synchronously before scheduling new timers.
  - Hardened private state projection in `getSafeStateForPlayer` to ensure secret words remain strictly private to drawers and successful guessers, while internal word history (`usedWords`), hint reveal indices, and mask arrays are stripped from public payloads.
  - Hardened drawer reconnection to resume remaining turn time without resetting to full 80s or altering drawer ownership. Reconnection by other players never affects drawer state or timers.
  - Structured drawer leave and host kick handling to advance the turn cleanly once, preserving scores and remaining turn order; cleanly ends the game in `GAME_RESULT` if fewer than 2 eligible players remain.
  - Fixed multi-game `sessionSockets` cleanup in `disconnectPlayer` so socket disconnects from Skribbl sessions are not prematurely purged before `disconnectDrawPlayer` executes.
- **Client Role Derivation & Safe Controls (`src/drawgame/components/DrawingPhase.jsx`):**
  - UI drawing tools and guess docks derive exclusively from authoritative server state (`room.currentDrawerId === sessionId`). No optimistic promotion, demotion, or client-side toggles exist.
  - Added phase/turn change effect to immediately reset word selection in-flight state (`isChoosing`), and gated word choice and guess submission against invalid phases or roles.

---

## Skribbl Room Lifecycle, Reconnects & Round Completion Hardening

### Phase 16 — Room Lifecycle, Reconnects & Round Completion Hardening
- **Idempotency & Reconnect Guards (`server/server.js`):**
  - Rapid double-clicks on `draw:create-room` by an existing lobby host return the existing safe room state idempotently without raising `ALREADY_IN_DRAW_ROOM`.
  - Duplicate or repeated `draw:leave-room` requests return `{ success: true, alreadyLeft: true }` without errors or duplicate player removal.
  - Duplicate `draw:join-room` requests from active/connected players restore memberships idempotently without turn resets or duplicate timers.
- **Anti-Resurrection & Strict Kick Enforcement (`server/server.js`, `src/drawgame/SkribblApp.jsx`):**
  - Explicit leave and host kicks flag `record.departed = true` and `record.kicked = true`.
  - Kicked players cannot rejoin the room; requests are rejected with `KICKED_FROM_ROOM` and mapped to user-facing error `"You have been kicked from this room."`.
  - Departed players and new players cannot join ongoing games; requests are rejected with `GAME_ALREADY_STARTED`. Departed players may rejoin with fresh state only when the room is in `LOBBY`.
- **Cross-Mode Session Isolation (`server/server.js`):**
  - Leaving a Skribbl room cleans up `draw:${roomId}` and session rooms. `sessionSockets` entries are preserved if the player is active in Undercover or Codenames.
- **Word Pool Resilience & Automatic Recycling (`server/server.js`):**
  - Custom words are safely sanitized; empty or whitespace lists fall back to `defaultWords`.
  - When all pool words are exhausted across rounds, `room.usedWords` automatically recycles (`usedWords = []`), guaranteeing `generateWordChoices` always produces choices and eliminating stuck `WORD_CHOICE` or `DRAWING` phases.
  - Word-choice timeout auto-selects from freshly generated words if choices are somehow empty.
- **Turn Order Deduplication & Guesser Departure (`server/server.js`):**
  - Explicitly deduplicated `turnOrder` and round shuffling player IDs.
  - If a guesser departs during `DRAWING` and all remaining active guessers have already guessed, `endDrawRound` triggers immediately rather than waiting for timer expiration.
  - When fewer than 2 eligible players remain during an active game, the turn settles once without intermediate reveals and transitions directly to `GAME_RESULT`.
- **Full State Reset on Play-Again (`server/server.js`):**
  - `draw:play-again` clears active timeouts and intervals, resets `usedWords`, resets `turnSequence = 0`, resets hints, and zeroes out all player and record scores before returning to `LOBBY`.
- **Abandoned Room Reaping (`server/server.js`):**
  - Extended reaping to clean up `drawRooms` where all real players remain disconnected for longer than `DISCONNECT_GRACE_MS`, clearing active timers, rate limits, and broadcasting `room-closed`.

---

## Native Autofill and Keyboard Suggestions Consistency

### Phase 17 — Native Autofill & Keyboard Suggestions Consistency
- **Name Input Native Autofill & Suggestion Assist (`src/drawgame/SkribblApp.jsx`):**
  - Configured create-room (`#sk-create-name`) and join-room (`#sk-join-name`) name inputs with standard autofill and prediction attributes: `name="name"`, `autoComplete="name"`, `autoCapitalize="words"`, `autoCorrect="on"`, and `spellCheck={true}`.
  - Allows mobile operating systems (iOS QuickType, Android Gboard) to suggest saved names and provide proper name capitalization without custom suggestion bars.
- **Room Code Field Hardening (`src/drawgame/SkribblApp.jsx`):**
  - Configured room-code input (`#sk-join-id`) with `name="roomCode"`, `autoCapitalize="characters"`, `autoCorrect="off"`, `autoComplete="off"`, and `spellCheck={false}`.
  - Preserved uppercase text transform, letter spacing, 6-character limit, and integrated camera QR scanning modal.
- **Guess Input Suggestions & Word Confidentiality (`src/drawgame/components/DrawingPhase.jsx`):**
  - Preserved predictive text, autocorrect, and spellcheck on the guess input (`#sk-guess-input`) using `autoComplete="on"`, `autoCorrect="on"`, `spellCheck={true}`, and `autoCapitalize="sentences"`.
  - Secret words remain strictly protected: never exposed through autocomplete, browser autofill, input attributes, or guess placeholders.
  - Preserved mobile keyboard viewport resizing, focus retention, and Enter-to-submit behavior without introducing custom keyboards or suggestion bars.

---

## Connection Status Polish and Reaction Colors

### Phase 18 — Connection Status Polish & Consistent Reaction Colors
- **Network Status Indicator Placement & Settings Menu Integration (`src/styles/globals.css`, `src/drawgame/components/SkribblNetworkStatus.jsx`, `src/drawgame/components/SettingsPanel.jsx`):**
  - Removed connection status from the in-game top bar entirely, keeping the top bar uncluttered and returning topbar spacing to `--sk-topbar-extra: 8px` for maximum canvas drawing area.
  - Shifted in-game connection status inside the settings menu (`SettingsPanel.jsx`) as a dedicated, native `.sk-settings-status-row` matching the panel's rounded border, card background, uppercase typography, and pill badge aesthetics.
  - Supported `inline` rendering in `SkribblNetworkStatus.jsx` with `.sk-settings-status-badge--connected/connecting/disconnected` modifier classes.
  - Positioned standalone connection indicator on menu and lobby at `top: calc(env(safe-area-inset-top, 0px) + 5px); right: clamp(12px, 3vw, 20px);`.
  - Increased `.sk-header` top padding to `calc(36px + env(safe-area-inset-top, 0px))` so the logo never overlaps with the indicator on narrow screens or iPhone PWA viewports.
  - Ensured the indicator dot is consistently circular (`width: 7px; height: 7px; min-width: 7px; min-height: 7px; border-radius: 50%; flex-shrink: 0;`) and vertically centered with the status label (`display: inline-flex; align-items: center; justify-content: center; gap: 6px; line-height: 1;`).
  - Implemented high-contrast, accessible status states:
    - **Connected:** Emerald dot (`#10B981`) with `#065F46` label (> 7:1 WCAG AAA contrast).
    - **Connecting:** Amber dot (`#F59E0B`) with subtle pulse animation and `#92400E` label (> 5.8:1 contrast).
    - **Disconnected:** Red dot (`#EF4444`) with `#DC2626` failure red label (> 4.5:1 contrast).
- **Reaction Colors Consistency (`src/drawgame/components/DrawingPhase.jsx`, `src/drawgame/components/ChatBox.jsx`):**
  - Updated both temporary canvas notification capsules and persistent ChatBox reaction messages to check `msg.reaction` / `notif.reaction` directly (`'LIKE'` vs `'DISLIKE'`) with robust fallback to text matching.
  - When a drawing is disliked, rendered notification text and chat message text in clear failure red (`#DC2626`) on `#FEE2E2` background, strictly eliminating confusing success green or non-standard orange colors.
  - Preserved success green (`#359b35`) on `#CFFFBD` background for liked drawings.
  - Preserved notification timing (4000ms expiration), server-side single reaction limit per turn, and all existing system and chat message styles.
- **Main Game Page Safe Bottom Spacing (`src/styles/globals.css`, `src/styles/sk-pwa-background.css`):**
  - Added safe bottom space to the guess dock (`.sk-guess-dock`) and drawer lower info section via `padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px))`, leaving a 10px breathing buffer above the viewport bottom or iPhone safe area.
  - Blended safe area background seamlessly with the input form background color (`var(--sk-surface, #ffffff)`) across `.sk-view--game` and `sk-pwa-background.css`.
  - When the software keyboard opens, reduced guess dock padding to `8px` so it rests directly on top of the keyboard without wasted gap.

---

## Skribbl Dev Bots Removal & Host Kick

### Phase 19 — Dev Bots Removal & Host Long-Press Kick
- **Complete Development Bots Removal from Skribbl:**
  - Removed dev bot controls (`ADD DEV BOTS`, `REMOVE DEV BOTS`) and handlers from `src/drawgame/components/Lobby.jsx`.
  - Removed Skribbl-specific bot manager initialization, dynamic imports, and socket event listeners (`draw:add-dev-bots`, `draw:remove-dev-bots`) from `server/server.js`.
  - Removed `isBot` parameters, flags, and branch logic across Skribbl `draw:join-room`, `reassignDrawHostIfNeeded`, `removeDrawPlayer`, and game loop handlers.
  - Deleted obsolete `server/dev/drawBotManager.js` without touching Undercover or Codenames bot architectures.
- **Host Active-Game Long-Press Player Kick:**
  - Added host-only long-press interaction (~600ms) on non-self player cards in `src/drawgame/components/PlayerStrip.jsx` during active gameplay.
  - Managed pointer events (`onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`, `onPointerLeave`) with movement cancellation (>10px) to prevent interfering with mobile touch scrolling or standard mouse interactions.
  - Prevented browser native context menu during card long-press while preserving responsive card styling, ranking, and drawer pencil indicator.
  - Provided a themed action sheet opening on long-press with `KICK PLAYER`, leading to a themed confirmation dialog clearly identifying the target player by name.
  - Prevented duplicate submissions during pending requests, auto-closed dialog on target departure or successful kick, and displayed actionable error banners via `SkribblError` in `DrawingPhase.jsx` for all kick failure scenarios.
  - Hardened `draw:kick-player` server handler in `server/server.js` with structured `{ success: true }` / `{ success: false, error: '...' }` acknowledgements, host authority validation, self-kick and host-kick protections, immediate target kick notification, safe socket room eviction, turn advancement, and authoritative room state broadcasting.

---

## Skribbl Guess Input & Bottom Safe Area Polish

### Phase 20 — Full-Width Guess Input & Bottom Safe Padding Removal
- **Removal of SEND Button & Clean Enter Submission:**
  - Removed the visible `SEND` button from the guess dock form (`.sk-guess-dock`) in `src/drawgame/components/DrawingPhase.jsx`.
  - Preserved standard `<form onSubmit={handleGuessSubmit}>` mechanics, enabling submission via the hardware Enter key or mobile keyboard "Send" action (`enterKeyHint="send"`).
  - Maintained complete guess validation: non-empty input requirement, drawer exclusion, and `DRAWING` phase gating.
  - Cleared input after submission and maintained input focus (`guessInputRef.current?.focus({ preventScroll: true })`).
- **Full-Width & Enlarged Guess Input:**
  - Expanded guess input to 100% of available width with `box-sizing: border-box; min-width: 0; width: 100%; margin: 0;`.
  - Increased input touch height with `padding: 12px 16px;` and comfortable `font-size: 18px;` (with `text-align: left;` and `border-radius: 14px;`).
  - Removed `.sk-guess-dock` inter-element gap and updated container to `width: 100%; box-sizing: border-box;`.
  - Preserved input attributes: `disabled`, `maxLength={120}`, `autoComplete="on"`, `autoCorrect="on"`, `spellCheck={true}`, and `autoCapitalize="sentences"`.
- **Bottom Safe-Area Padding Removal from Main Game Screen:**
  - Removed redundant `padding-bottom: 20px;` from `.sk-guess-dock`, reducing it to standard `padding: 8px 12px;` so the dock reaches the bottom edge of the viewport.
  - Removed `.sk-view--game > .sk-lower-info-section:last-child { padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }`, eliminating the unwanted bottom gap when the user is drawer or spectator.
  - Kept top safe area handling, top-bar layout, mobile keyboard visibility adaptation (`html.sk-kb-open .sk-guess-dock { padding-bottom: 8px; }`), and all other game modes completely unaffected.

---

## Skribbl Play Again & Individual Lobby Entry

### Phase 21 — Individual Lobby Entry & Play Again Coordination
- **Universal Player Opt-In on `GAME_RESULT` (`src/drawgame/components/DrawingPhase.jsx`):**
  - Replaced the host-only Play Again button and non-host waiting text with an interactive Play Again button available to every player on `GAME_RESULT`.
  - Added per-player pending and acknowledged states: displays `"RETURNING TO LOBBY..."` while awaiting server acknowledgement and `"WAITING FOR OTHERS..."` once opted in, preventing duplicate clicks.
  - Visualized player opt-in status in the game-over scoreboard with a green `READY` badge next to players whose `playAgain === true`.
- **Immediate Individual Lobby Entry (`src/drawgame/SkribblApp.jsx`, `src/drawgame/components/DrawingPhase.jsx`):**
  - Enabled individual players who opt in to transition immediately to their existing room's lobby view without waiting for other players or altering room ID.
  - Hardened client routing in `SkribblApp.jsx` to render `Lobby` when `roomState.phase === 'LOBBY' || (roomState.phase === 'GAME_RESULT' && me?.playAgain)`.
  - Added early lobby return in `DrawingPhase.jsx` if `room.phase === 'GAME_RESULT' && myPlayer?.playAgain`, seamlessly handing over configuration management via `onUpdateConfig`.
  - Protected `updateRoomStateSafe` against stale intermediate `GAME_RESULT` broadcast packets overriding a local player's opted-in state.
- **Server-Side Opt-In Coordination & Guarded Reset (`server/server.js`):**
  - Updated `draw:play-again` socket handler to permit any authorized player in `GAME_RESULT` to opt in, recording `player.playAgain = true` and broadcasting safe transitional state.
  - Implemented `checkDrawPlayAgainCompletion(room)`: counts active eligible players (`isConnected && !departed && !kicked`) and executes the authoritative shared reset only after every eligible player has opted in.
  - Hooked completion checks into `disconnectDrawPlayer` and `removeDrawPlayer` so departed or disconnected players never block remaining players from resetting to lobby.
  - Preserved `existing.playAgain` state during reconnects in `draw:join-room`.
  - Factored a single guarded `resetDrawRoomToLobby(room)` that clears active timeouts/intervals, zeroes out player and record scores, resets round, turn, drawer, words, strokes, hints, reactions, and opt-in flags, clears the canvas, and broadcasts `LOBBY` state once.
- **Host Privileges & Start Game Protection (`src/drawgame/components/Lobby.jsx`, `server/server.js`):**
  - Allowed the host to update game configuration (`drawTimeSec`, `rounds`, `gameMode`, etc.) immediately upon entering the lobby, even while the room remains in transitional `GAME_RESULT`.
  - Disabled the `START GAME` button and displayed `"WAITING FOR PLAYERS..."` whenever `room.phase !== 'LOBBY'`, preventing premature game starts while players remain on the result screen.
  - Displayed `(In results)` next to players in the lobby player strip who have not yet opted in.


