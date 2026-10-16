# SKRIBBL / DRAW & GUESS — Development Phases

## Status
Core online mode implemented.

## Phase 1 — Mode Integration
**Implemented:** isolated Draw & Guess client module, shared Socket.IO connection, isolated draw-room state and mode integration.

## Phase 2 — Room / Lobby
**Implemented:** create/join, room state, host controls, leave game and room sharing/join support.

## Phase 3 — Drawing Core
**Implemented:** canvas, synchronized strokes, drawer turns and canvas reset.

## Phase 4 — Word Choice
**Implemented:** private word choices, server-authoritative selection and timeout.

## Phase 5 — Guessing / Chat
**Implemented:** guesses, chat/system messages and correct-guess handling.

## Phase 6 — Hints
**Implemented:** progressive hints and server-authoritative hint timing.

## Phase 7 — Scoring / Results
**Implemented:** authoritative points, round reveal and final ranking.

## Phase 8 — Lifecycle / Reconnect
**Implemented:** resume-token reconnect, duplicate prevention, disconnected-player retention and active-drawer timer/state restoration.

## Phase 9 — Mobile / Responsive UX
**Implemented/maintained:** mobile layout, keyboard visibility, safe-area handling and responsive canvas/controls.

## Phase 10 — Maintenance
Preserve word privacy, server authority, timer correctness, stale-turn protection and reconnect behavior. Never reintroduce disconnect-as-leave behavior.

## Phase 11 — Persistent Network Status & Settings Room Code / QR
**Implemented:**
- Compact, persistent network status indicator (`Connected`, `Connecting`, `Disconnected`) on every Skribbl screen (menu, create/join, lobby, gameplay phases) safely positioned around the top bar/notch with `--sk-*` theme styling and no obstruction to canvas or controls.
- Active Socket.IO connection and reconnection tracking in `SkribblApp.jsx` without stale state overrides.
- In-game room code row in `SettingsPanel.jsx` with one-tap clipboard copy confirmation and integrated `QRModal` supporting fly-in/fly-out animations above Settings.

## Phase 12 — Mobile LAN Stability & Insecure Context Hardening
**Implemented:**
- Resilient identity generation in `src/game/identity.js` preventing runtime crashes when accessing the app over LAN HTTP where `crypto.randomUUID` is unavailable.
- Added timeout and cancel action to Skribbl session restoration screen so users are not trapped if the server is offline or reconnecting.
- Root error boundary in `App.jsx` preventing blank screen on unexpected exceptions.

## Phase 13 — Mobile Keyboard Native Word Suggestions Restoration
**Implemented:**
- Restored mobile keyboard native word suggestions, predictive text, and spellcheck on the Skribbl guess/chat input in `DrawingPhase.jsx` using `autoComplete="on"`, `autoCorrect="on"`, `spellCheck={true}`, and `autoCapitalize="sentences"`.
- Removed legacy suppression attributes (`autoComplete="off"`, `autoCorrect="off"`, `spellCheck={false}`) without affecting Enter-to-submit handling, focus behavior, secret-word privacy, or canvas layout.

## Phase 14 — Entry Experience & Stale-Session Recovery
**Implemented:**
- Prevented false `"room not found"` errors when opening Skribbl without an active room or when restoring missing rooms.
- Server `register` distinguishes general socket connection from explicit session restoration attempts without prematurely emitting `session-no-room`.
- Isolated stale session clearing so invalid Skribbl data does not wipe Undercover/Codenames credentials.
- Ensured room code input errors during explicit joins retain `ROOM_NOT_FOUND` on the join screen for user correction.
- Sequenced room updates with server-side versions and timestamps, preventing delayed callbacks or broadcasts from overwriting newer state. Fixed membership check to prevent dropping valid updates.
- Fixed `sessionSockets` cleanup during server room reaping to preserve Skribbl and Codenames socket ownership.

## Phase 15 — Drawer Ownership & Turn Transition Stabilization
**Implemented:**
- Made `room.currentDrawerId`, `room.phase`, `room.round`, and `room.turnIndex` strictly authoritative on the server. Client derives UI and action states purely from `room.currentDrawerId === sessionId` and cannot independently toggle roles.
- Traced and eliminated duplicate room-state broadcasts on reconnection by consolidating `register` and `draw:join-room` broadcasts and ensuring versioned safe state propagation.
- Protected `draw:choose-word` to accept selections solely from the active drawer during `WORD_CHOICE`, atomically clearing the timeout and transitioning to `DRAWING` exactly once. Stale or duplicate selections are rejected without resetting the turn timer.
- Added 6-way validation to word-choice, drawing turn, hint, and reveal timeouts/intervals (checking room ID, round, turnIndex, currentDrawerId, turnSequence, and phase) to prevent obsolete or cross-turn callbacks from corrupting state.
- Hardened private state projection in `getSafeStateForPlayer` by concealing secret words from guessers until reveal/result, and withholding internal word history (`usedWords`), hint reveal indices, and mask arrays.
- Hardened drawer reconnection to resume remaining turn time without resetting to 80s or altering drawer ownership. Ensured guesser reconnects never touch drawer ownership or timers.
- Normalized drawer disconnect, kick, and leave lifecycles: on drawer departure, the turn advances exactly once while preserving score state and remaining turn order; cleanly ends game if fewer than 2 eligible players remain.
- Fixed `sessionSockets` cleanup in `disconnectPlayer` to prevent premature session deletion on multi-game socket disconnects.

## Phase 16 — Room Lifecycle, Reconnects & Round Completion Hardening
**Implemented:**
- **Idempotency & Duplicate Request Protection:** Guarded `draw:create-room` against rapid double-clicks by returning safe room state if the requester already hosts a lobby room. Made `draw:leave-room` idempotent, responding with `{ success: true, alreadyLeft: true }` on duplicate calls. Handled duplicate `draw:join-room` requests from connected players idempotently without resetting turn sequence or timers.
- **Anti-Resurrection & Kick Enforcement:** Flagged departing players with `record.departed = true` and kicked players with `record.kicked = true`. Rejoining as a kicked player is explicitly rejected with `KICKED_FROM_ROOM`. Rejoining an active game as a departed player or unauthenticated new player is rejected with `GAME_ALREADY_STARTED`. Rejoining is permitted with a clean slate only when the room is in `LOBBY`.
- **Cross-Mode Safe Socket Cleanup:** Leaving a Skribbl room cleans up socket room subscriptions (`draw:${roomId}` and private session room) and safely removes session socket mappings only if the socket is the registered owner and the user has no active game in Undercover or Codenames.
- **Word Pool Resilience & Recycling:** Validated custom words, falling back to `defaultWords` if empty or invalid. Implemented automatic pool recycling (`usedWords = []`) when all eligible words are exhausted in multi-round games, preventing empty choices or stuck `WORD_CHOICE`/`DRAWING` loops.
- **Turn Order Deduplication & Guesser Departure:** Enforced deduplication of eligible player IDs in `turnOrder` and round shuffling. When a guesser leaves during `DRAWING` and all remaining active guessers have already guessed, round completion triggers immediately.
- **Play-Again Cleanup:** Full state reset on `draw:play-again`: clears lingering timeouts/intervals, resets `usedWords`, resets `turnSequence = 0`, resets hints, and zeroes out scores on all players and player records before returning to `LOBBY`.
- **Abandoned Room Reaping:** Extended server-wide room reaping to clean up `drawRooms` where all real players have remained disconnected for longer than `DISCONNECT_GRACE_MS`, clearing timers, player rate limits, and broadcasting `room-closed`.

## Phase 17 — Native Autofill & Keyboard Suggestions Consistency
**Implemented:**
- **Name Input Autofill & Suggestions (`src/drawgame/SkribblApp.jsx`):**
  - Added native name autofill and input assistance to both create-room (`#sk-create-name`) and join-room (`#sk-join-name`) name fields using `name="name"`, `autoComplete="name"`, `autoCapitalize="words"`, `autoCorrect="on"`, and `spellCheck={true}`.
  - Enabled mobile browsers to suggest stored user names and capitalize words automatically without obstructing custom styling.
- **Room Code Input Security & Formatting (`src/drawgame/SkribblApp.jsx`):**
  - Configured room-code field (`#sk-join-id`) with `name="roomCode"`, `autoCapitalize="characters"`, `autoCorrect="off"`, `autoComplete="off"`, and `spellCheck={false}`.
  - Preserved uppercase formatting, character spacing, 6-character limit, and camera QR scanning modal integration.
- **Guess Input Suggestions & Word Confidentiality (`src/drawgame/components/DrawingPhase.jsx`):**
  - Maintained native predictive text, autocorrect, and spellcheck on the guess input (`#sk-guess-input`) via `autoComplete="on"`, `autoCorrect="on"`, `spellCheck={true}`, and `autoCapitalize="sentences"`.
  - Strictly prevented secret-word leakage: drawer's word is never injected into placeholders, values, autocomplete history, or autofill attributes.
  - Preserved mobile keyboard viewport resizing, focus retention, and Enter-to-submit behavior without introducing custom keyboards or suggestion bars.

## Phase 18 — Connection Status Polish & Consistent Reaction Colors
**Implemented:**
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

## Phase 19 — Dev Bots Removal & Host Long-Press Kick
**Implemented:**
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

## Phase 20 — Full-Width Guess Input & Bottom Safe Padding Removal
**Implemented:**
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

## Phase 21 — Individual Lobby Entry & Play Again Coordination
**Implemented:**
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