# UNDERCOVER — Development Phases

Develop incrementally. Do not build everything at once.

## PHASE 0 — Project Setup
Initialize React/Vite, install required dependencies, create structure, create base App/global CSS, verify dev server.

## PHASE 1 — Asset Integration
- create `public/videos`
- add `uncercover-cinematic.mp4`
- add generated frames to `public/images/cinematic/frame_0001.jpg` … `frame_0480.jpg`
- verify video and frame assets load
- create temporary asset-test view
- Do not implement scroll animation.

## PHASE 2 — Visual Foundation
Build background, typography, navigation, buttons, hero, cinematic container, and responsive structure.

## PHASE 3 — Cinematic Scroll
Implement GSAP ScrollTrigger, pin cinematic section, map scroll progress to frame index (primary) or video currentTime (fallback), no scrub/smoothing, and asset loading/error handling.

## PHASE 3H — Frame Sequence Renderer (FINAL LANDING ARCHITECTURE)
- Full preload of all 480 JPEG frames (Option A).
- Single ScrollTrigger for the cinematic.
- Progress → frame index (1..480) direct mapping.
- Canvas render scheduled via rAF only when index changes.
- Character text mapped to exact video-time windows.
- Composition: Civilian→Right, Undercover→Left, Mr. White→Left.
- Fallback: MP4 (paused, linear currentTime) → static frame → reduced-motion static.

## PHASE 4 — Character Reveals
Add Civilian, Undercover, and Mr. White role UI. Synchronize text with cinematic progress and video-time windows.

## PHASE 5 — Cinematic Polish / Investigation Presentation
Add easing, opacity transitions, loading screen, scroll indicator, transitions, restrained background effects, investigation-board presentation, evidence presentation, and final CTA. No gameplay logic is embedded in the cinematic controller.

## PHASE 6 — Responsive Experience
Optimize desktop, laptop, tablet, mobile, typography, touch behavior, and gameplay-ready responsive foundations.

## PHASE 7 — Performance
Compress/optimize assets, lazy-load non-critical assets, reduce unnecessary animation, and test scroll/game performance and network loading.

## PHASE 8 — Accessibility
Keyboard navigation, semantic HTML, accessible buttons, contrast, reduced-motion support, private-information accessibility boundaries, and fallback content.

## PHASE 9 — Final Landing + Gameplay QA
Test Chrome, Safari, Firefox, desktop, mobile, slow network, cinematic/frame failure, reduced motion, refresh, resize, room reconnect, game-state recovery, voting, ties, role privacy, timers, spectators, and Play Again.

## PHASE 10 — Deployment
Deploy to Vercel. Verify production build, asset paths, HTTPS, responsive behavior, performance, and online-game connectivity/configuration.

# POST-LANDING GAME DEVELOPMENT

The original landing-page roadmap ended at deployment. The following phases define the actual playable game flow.

## PHASE 11 — Core Game Rules, Roles & Word-Pair Data
Establish the authoritative game rules and centralized data models before building gameplay UI.

### Roles
- **Civilian (`ci`)** — receives the Civilian word and must identify/eliminate all Undercover and Mr. White players.
- **Undercover (`uc`)** — receives a similar but different word and must blend in with Civilians. Undercover wins when the number of Undercover players becomes strictly greater than the number of remaining Civilians.
- **Mr. White (`mw`)** — receives no word. Mr. White listens to clues, attempts to infer the Civilian word, and receives an immediate guess opportunity when eliminated. A correct guess gives Mr. White a win immediately. If Mr. White survives until the investigation ends with the Civilians, Mr. White wins with the Civilians.

### Role distribution by total player count
| Players | ci | uc | mw |
|---:|---:|---:|---:|
| 3 | 2 | 1 | 0 |
| 4 | 3 | 1 | 0 |
| 5 | 3 | 1 | 1 |
| 6 | 4 | 1 | 1 |
| 7 | 4 | 2 | 1 |
| 8 | 5 | 2 | 1 |
| 9 | 5 | 3 | 1 |
| 10 | 6 | 3 | 1 |
| 11 | 6 | 3 | 2 |
| 12 | 7 | 3 | 2 |
| 13 | 7 | 4 | 2 |
| 14 | 8 | 4 | 2 |
| 15 | 8 | 5 | 2 |
| 16 | 9 | 5 | 2 |
| 17 | 9 | 5 | 3 |
| 18 | 10 | 5 | 3 |
| 19 | 10 | 6 | 3 |
| 20 | 11 | 4 | 3 |

These values are authoritative and must be configurable by the host rather than hard-coded into presentation components.

### Word pairs
- The game uses a predefined generated list of related word pairs supplied by the product owner.
- A selected pair contains a Civilian word and a similar Undercover word.
- The user/product owner can modify the predefined list.
- Mr. White receives no word.
- Word selection must be centralized and private.

## PHASE 12 — Online Room & Lobby
Build the online room lifecycle.

Flow:
`Create/Join Room → Enter Name → Lobby → Configure Game → Start Investigation → Clue/Investigation Phase`

Requirements:
- User enters a name when joining.
- A unique/reusable Room ID identifies the investigation room.
- Host controls player-count configuration, role distribution, word category, available word-pair settings, and `Reveal Roles`.
- `Reveal Roles` defaults to OFF.
- Non-hosts can view the current setting but cannot change it.
- `Reveal Roles` becomes locked when the investigation starts and remains fixed for that investigation.
- Player count updates automatically.
- The host can start the investigation when the room satisfies the minimum/valid configuration.
- Players who click Play Again return to the same room/lobby rather than creating a new room.
- A room can be reused for another investigation after Game Over.

## PHASE 13 — Secure Role & Word Assignment
After the investigation starts (directly into Clue Phase):
1. Lock the active player roster for the round.
2. Assign roles according to the configured distribution.
3. Assign the Civilian word to every Civilian.
4. Assign the similar Undercover word to every Undercover.
5. Assign no word to Mr. White.
6. Preserve the authoritative internal role for every active player.
7. Apply the locked `Reveal Roles` setting to the player's private presentation inside the investigation UI:
   - ON: local Civilian/Undercover may see their role name and role-specific presentation.
   - OFF: local Civilian/Undercover do not receive explicit role identity; use neutral presentation.
8. When roles are hidden, the assigned Civilian/Undercover word remains available.
9. Never expose private roles/words through shared UI, client-readable public state, logs, or other players' views.
10. Do not reveal role identity through role-specific avatar, color, description, accessible label, tooltip, DOM attribute, or similar UI when `Reveal Roles` is OFF.

## PHASE 14 — Clue + Chat System
After role assignment (inside the investigation UI directly):

Two tabs exist:
- **CLUES** — strictly for clue submission.
- **CHAT** — normal room discussion.

### Clues
- Clues are visible to everyone.
- A clue may contain a maximum of 3 words.
- A clue may not be empty.
- The same clue may not be submitted again in the investigation.
- Previous-round clues remain visible in the Clues tab until the investigation ends.
- Clues must be entered strictly in the generated player sequence.
- Only the currently authorized player may submit a clue.
- Once submitted, the clue becomes part of the permanent investigation history for that game.

### Chat
- Chat is visible to everyone in the room according to the game's spectator/visibility rules.
- Chat is separate from clues and must not be treated as a clue submission.
- The UI must prevent accidental clue submission through the normal chat input and vice versa.

## PHASE 15 — Random Clue Order & Round Execution
At the beginning of each round:
- Generate a random sequence of active players.
- In Round 1 only, Mr. White must never be first.
- From Round 2 onward, Mr. White may appear anywhere in the randomized sequence, including first.
- Every active player gets exactly one clue opportunity in the sequence.
- The sequence must be authoritative and synchronized for all players.
- A player cannot submit before their turn.
- A player cannot submit twice.
- If a player disconnects during their clue turn, recovery/reconnection rules must preserve the turn state and prevent duplicate submissions.
- Spectators do not enter the clue sequence.

When the last clue is submitted, the round proceeds to voting.

## PHASE 16 — Voting, Tie Handling & Elimination
After all clues for the round are submitted:
- Every active player votes.
- Self-voting is prohibited.
- Eliminated players/spectators cannot vote.
- A vote is locked after confirmation.
- Duplicate votes are prohibited.
- Votes resolve only when all required active players have voted or the configured timeout/error policy resolves the phase.

### Tie rule
If there is a tie for the highest vote count:
- No player is eliminated.
- The investigation continues within the same round.
- A new voting round begins.
- The tie process repeats until there is a single highest-voted player.
- The UI must clearly identify that the previous vote resulted in a tie and that a revote is required.

### Elimination
When there is a unique highest-voted player:
- Eliminate that player.
- Immediately determine whether the eliminated player is Mr. White.
- If the eliminated player is Mr. White, proceed immediately to the Mr. White Guess phase before continuing the investigation.

## PHASE 17 — Mr. White Guess Phase
Every eliminated Mr. White receives an immediate final guess opportunity.

Requirements:
- The guess is a free-text input.
- Compare the submitted guess against the actual Civilian word.
- Comparison should be case-insensitive and should ignore harmless leading/trailing whitespace.
- If the guess is correct → **Mr. White wins immediately and the investigation ends.**
- If the guess is incorrect → that Mr. White remains eliminated and the investigation continues.
- If multiple Mr. Whites are eliminated during the game, the guess opportunity applies independently to each eliminated Mr. White.
- The guess phase must not reveal the Civilian word to the guessing Mr. White before submission.
- Once a guess is submitted, it cannot be changed.

## PHASE 18 — Spectators, Joining During an Ongoing Investigation & Reconnection
### Eliminated players
- Remain in the Room ID as spectators.
- Cannot provide clues.
- Cannot vote.
- Cannot affect active-player win conditions.
- May view the appropriate ongoing room/investigation information according to the spectator visibility rules.

### New player joins during an ongoing game
- They do not enter the active round.
- They immediately become a spectator.
- They do not receive the current round's role/word assignment.
- They do not enter the current clue order.
- They do not vote in the current round.
- At the next round boundary, they automatically move into the room lobby/eligible player pool.
- The active/lobby player count updates automatically.
- The next round's role distribution is recalculated according to the configured player count before the round begins.
- The host can then start the next round when valid.

### Reconnection
- A disconnected player may reconnect using the same Room ID and recover their game state.
- Recovery must restore their identity, role/private word, active/eliminated/spectator state, current round, clue status, vote status, and permitted actions.
- Reconnection must not duplicate a player, clue, vote, or turn.
- If the game state has advanced while disconnected, the player receives the current authoritative state rather than attempting to replay stale actions.

## PHASE 19 — Win Conditions & Investigation Loop
After each elimination/guess resolution, evaluate the authoritative win conditions.

### Civilian win
Civilians win when all Undercover players are eliminated and all Mr. White players are either eliminated without a successful guess or otherwise no longer capable of changing the outcome.

If a Mr. White survives until the investigation ends with the Civilians, that Mr. White wins jointly with the Civilians.

### Undercover win
Undercover wins when:
`remaining Undercover players > remaining Civilian players`

The comparison is strictly greater than. Equality does not trigger an Undercover win.

### Mr. White win
A Mr. White wins immediately if they correctly guess the Civilian word when eliminated.

### Round loop
If no win condition has been reached:
`Next Round → New randomized clue order → Clue phase → Voting → Elimination → Guess if applicable → Win check`

The game repeats until a win condition is reached.

## PHASE 20 — Game Result & Same-Room Play Again
When the investigation ends, show a final result screen containing:
- winning side/role
- reason the investigation ended
- revealed roles
- relevant word pair
- elimination history
- key clues/investigation history as appropriate

Provide:
- **PLAY AGAIN**
- **RETURN TO LOBBY**

### Play Again
- Players who choose Play Again remain associated with the same Room ID.
- They are redirected to the room lobby.
- The previous game state is reset for the new investigation.
- Roles are reassigned.
- A new word pair/category can be selected according to the room configuration.
- The room remains reusable; no new Room ID is required.
- Players who do not choose Play Again remain spectators/room members according to the room policy.

## PHASE 21 — Error Handling & State Recovery
Every gameplay phase must define safe failure behavior.

Handle at minimum:
- invalid Room ID
- room full / unsupported player count
- duplicate player name or identity conflict
- player disconnect/reconnect
- host disconnect/reconnect and host migration policy
- player joins mid-round
- stale client action
- duplicate clue submission
- clue over 3 words
- duplicate clue
- clue submitted out of turn
- duplicate vote
- self-vote
- vote for eliminated/spectator player
- incomplete vote set
- voting tie
- timer expiration if timers are enabled
- duplicate Mr. White guess
- invalid/empty guess
- game already ended
- Play Again race conditions
- stale Room ID state
- server/client state mismatch
- refresh/browser close
- network interruption

The server/authoritative game state must reject invalid actions rather than relying only on UI validation.

## PHASE 22 — Online Gameplay UX & Visual Polish
Translate the rules into the existing premium investigation aesthetic.

Screens/components should include:
- Online Lobby
- Room Header / Room ID
- Host Controls
- Player Roster
- Private Role Reveal / Role-Neutral Presentation
- Private Word Reveal
- Reveal Roles host setting
- Clue Tab
- Chat Tab
- Clue Turn Indicator
- Clue History
- Round / Voting HUD
- Vote Panel
- Tie / Revote State
- Elimination Reveal
- Mr. White Guess Screen
- Spectator State
- Reconnection State
- Game Result
- Play Again / Lobby Return

Keep the visual system consistent with the existing classified-investigation design.

## PHASE 23 — Online Game QA
Test the complete online lifecycle with multiple browser sessions/devices.

Minimum test matrix:
- 3–20 player configurations
- each role count configuration
- Reveal Roles ON/OFF
- host-only setting permissions
- setting locked after investigation start
- Civilian/Undercover role secrecy when Reveal Roles is OFF
- neutral local avatar/color/description when roles are hidden
- secret words remain correct when roles are hidden
- no role leakage through public state, DOM, accessibility labels, or reconnect
- Round 1 Mr. White ordering restriction
- Round 2+ Mr. White first position
- clue maximum 3 words
- duplicate clue rejection
- clue order enforcement
- chat/clue separation
- self-vote rejection
- vote tie and repeated revote
- every Mr. White guess opportunity
- correct/incorrect Mr. White guesses
- strict Undercover `uc > ci` win condition
- Civilian win
- surviving Mr. White joint win with Civilians
- mid-game spectator joining
- next-round automatic lobby admission
- player elimination → spectator
- reconnect to same Room ID
- refresh recovery
- simultaneous actions/race conditions
- Game Over
- same-room Play Again
- new role/word assignment after Play Again

Do not proceed to Pass & Play until the Online Mode is stable and the above flow is explicitly verified.

## PHASE 24 — Pass & Play
Reserved for a separate design discussion. Do not implement until the Pass & Play rules and flow are defined and approved.

# SPECIAL ROLES EXPANSION

Source: Yanstar Studio's official "Undercover" special-roles list (https://www.yanstarstudio.com/undercover-special-roles).
These are **optional add-on traits**, not replacements for the base alignment. A player's authoritative alignment is always `ci` / `uc` / `mw`. A Special Role is an additional flag layered on top of that alignment (e.g. a player can be `ci` **and** have the `lovers` trait).

Do not begin this section until Phase 11–23 (core Online Mode) is fully stable and QA-passed. Build strictly one role at a time, in the order below, and keep every role behind its own host toggle so it can be shipped independently.

### Cross-cutting ground rules (apply to every phase in this section)
- Special Roles are **entirely opt-in**. Default state = all OFF, identical to current behavior.
- The host enables/disables each Special Role individually in the lobby, alongside `Reveal Roles`. Selection locks when the investigation starts, exactly like `Reveal Roles`.
- A player may hold **at most one** Special Role trait per investigation. Traits are never stacked on the same player.
- A Special Role is assigned in addition to, and never instead of, the authoritative `ci`/`uc`/`mw` alignment. Nothing in this section may change role-distribution counts from the approved table.
- Each role that says "can only be activated from N players" must be **disabled and disabled-looking in the host UI** (not merely rejected on submit) when the active player count is below its minimum.
- Special-role identity is private information with the same protection level as base role/word: never exposed in public state, DOM, accessible labels, or another player's view, except at the exact moment the role's own rule says to reveal it (e.g. Lovers reveal only on elimination).
- Any role that changes vote tallying, elimination, or win-condition eligibility must be implemented as an explicit hook in the authoritative state machine (not a UI-layer patch), consistent with the existing "server rejects invalid actions" principle in Rules.md.
- **Open assumptions below are flagged `ASSUMPTION:`** — confirm or override these before the agent builds that phase, since the source page does not fully specify them.

## PHASE 25 — Special Roles Framework
Build the extensibility layer every individual role will plug into. No role-specific behavior yet.

- Extend authoritative state with a `specialRoles` config: map of role key → `{ enabled: boolean, minPlayers: number }`, host-controlled, locked at investigation start.
- Extend per-player private state with an optional `specialRole` field (null by default) and any role-scoped data (target player id, points, used/unused flag) as a generic `specialRoleData` bag.
- Add a `points` field to player state, defaulting to 0, surfaced only on the Game Result screen. This is investigation-scoped (resets on Play Again) unless product later asks for cross-game persistence — do not build persistence yet.
- Add explicit extension hooks to the state machine so individual roles don't require touching core logic later:
  - `onRoundStart(state)`
  - `onVoteTallied(state, tally)` — before elimination is finalized
  - `onElimination(state, eliminatedPlayerId)` — after elimination is finalized
  - `onGameEnd(state, result)`
- Lobby UI: a "Special Roles" panel (collapsed by default) listing each role with a toggle, its one-line description, and its minimum player count; toggles auto-disable below the minimum with an inline reason.
- No visible gameplay change yet if all toggles stay OFF — this phase must not alter existing verified behavior.

## PHASE 26 — The Joy Fool
Simplest role: no interaction with voting/elimination logic beyond a read.

- Assignable to any one active player (any alignment) when enabled.
- `onElimination`: if the eliminated player holds `joy-fool` **and** this is the first elimination of the investigation, award +4 points via `specialRoleData`/`points`.
- No effect on win conditions — the Joy Fool's own alignment still needs to win/lose normally; points are a side-score only.
- Game Result screen shows a small "Special Role Outcomes" list when any special roles were active this game (e.g. "Joy Fool bonus: +4 pts — PlayerName").
- No minimum player count (site does not specify one; usable from 3 players, same as base game).

## PHASE 27 — The Duelists
Two players, points-only, no elimination-order or vote logic changes.

- When enabled with ≥5 active players, assign the `duelist` trait to exactly two players (any alignment(s), independent of each other).
- `onElimination`: if the eliminated player is a duelist, the **other** duelist gets +2 points and the eliminated duelist gets −2 points. Only the first duelist elimination triggers this (once resolved, the pair's duel is closed).
- Duel identity is never shown to either player or the room before it resolves; reveal both duelists' identity + point outcome only on the Elimination/Result screen once resolved (matches the site's flavor of "no big deal" — private until settled).
- Minimum 5 active players (per source).

## PHASE 28 — The Lovers
First role that changes elimination flow (cascading elimination).

- When enabled with ≥5 active players, assign the `lover` trait to exactly two players. Lovers may share the same alignment or different alignments — assignment is independent of `ci`/`uc`/`mw` distribution.
- `onElimination`: if the eliminated player is a Lover, immediately and automatically eliminate the other Lover too, **before** the next phase (Mr. White guess check, win check) evaluates. This is a single atomic double-elimination for win-condition and Mr. White-guess purposes — both eliminations resolve, then Mr. White guess checks run for each eliminated Lover who is `mw`, then win conditions evaluate once against the resulting state.
- The Lovers pairing is revealed to the whole room **only at the moment one is eliminated** — not before, not via any public/DOM state.
- ASSUMPTION: if the cascade eliminates a second Lover who is also mid-guess-eligible (`mw`), both get independent guess opportunities sequentially (consistent with "every eliminated Mr. White gets a guess"). Confirm this ordering before building.
- Minimum 5 active players (per source).

## PHASE 29 — The Revenger
Elimination-triggered secondary elimination, this time player-chosen rather than automatic.

- When enabled with ≥5 active players, assign the `revenger` trait to one active player (any alignment).
- `onElimination`: if the eliminated player is the Revenger, immediately open a private "choose a target" action for that (now-eliminated) player, scoped to remaining active players, excluding self.
- The Revenger's chosen target is eliminated immediately once submitted; then Mr. White-guess checks and win checks run against the resulting state (same ordering principle as Phase 28).
- Define and enforce a timeout/default behavior if the Revenger disconnects or does not choose (reuse the reconnection/stale-action patterns from Phase 18/21) — ASSUMPTION: no target is eliminated if the Revenger fails to choose within the timeout; confirm before building.
- Minimum 5 active players (per source).

## PHASE 30 — The Boomerang
First role that changes vote-tallying itself rather than post-elimination effects.

- When enabled, assign the `boomerang` trait to one active player (any alignment), with a `used: false` flag.
- `onVoteTallied`: if the Boomerang trait is unused and the Boomerang player is this round's uniquely-highest-voted (i.e. about to be eliminated), reroute: every vote cast **against** the Boomerang is instead tallied against the voter who cast it, mark the trait `used: true`, and re-resolve the tally (which may itself produce a new highest-voted player, a tie, or no majority).
- This can only trigger once per Boomerang player for the whole investigation (one-shot).
- Re-resolution must still respect existing tie rules (Phase 16) if the rerouted tally produces a tie.
- No minimum player count specified by source — ASSUMPTION: usable from 5 players (consistent with the other vote/elimination-altering roles); confirm before building.

## PHASE 31 — The Goddess of Justice
Changes the existing tie-resolution rule (Phase 16) — must not silently break the default (no-Goddess) tie→revote behavior.

- When enabled, assign the `goddess` trait to one active player, announced to the room once roles/words are distributed (per source, this is the one special role whose identity is public from the start, not private).
- `onVoteTallied`: if this round's vote is tied **and** the Goddess is still in the game (active **or** eliminated — she "remains in the game to deal out justice" even after elimination per the source), open a private "decide who is eliminated" action for the Goddess, scoped to the tied players only, instead of triggering a revote.
- If the Goddess herself has been eliminated in a prior round, she is still summoned for this decision (spectator-with-power, similar in spirit to Phase 32's Ghost, but scoped only to tie-breaking, not general voting).
- If the Goddess is disabled or was never assigned (shouldn't happen while enabled, but guard for it), fall back to the existing revote rule unchanged.
- ASSUMPTION: no minimum player count is stated by the source; default to no minimum beyond the base game's 3-player floor — confirm before building.

## PHASE 32 — The Ghost
Changes eligibility for post-elimination participation — most invasive role relative to existing Rules.md ("eliminated players/spectators cannot vote").

- When enabled, assign the `ghost` trait to one player at investigation start (any alignment). Unlike other roles, the Ghost's power only activates once that player is eliminated.
- Once the Ghost is eliminated: they remain able to post in Chat/Clue-discussion context and **cast a vote** in subsequent rounds, in addition to ordinary spectators who still cannot vote or clue.
- The Ghost's vote counts toward vote tallying/tie resolution for elimination purposes, but the Ghost is explicitly excluded from win-condition player counts (`uc > ci`, Civilian/Undercover win checks) since they are not an active player.
- The Ghost does not clue and does not re-enter the active roster; this is a voting/discussion exception only.
- UI must distinguish an ordinary spectator ("SPECTATOR — cannot vote") from a Ghost-empowered spectator ("SPECTATOR — GHOST — may still vote") without exposing this to other players beyond the fact that a Ghost rule is active in this room (the Ghost's own identity can be public per source flavor, since the haunting is meant to be visible — ASSUMPTION: identity is revealed at elimination, same as Lovers; confirm before building).
- No minimum player count specified by source.

## PHASE 33 — The Falafel Vendor
Needs a concrete effect definition before an agent can build it — the source only says "protection or sabotage," not the mechanics.

- When enabled with ≥4 active players, assign the `falafel-vendor` trait to one active player.
- `onRoundStart`: before clues begin, the Vendor privately chooses another active player to give a "falafel" to.
- ASSUMPTION (needs product decision before building): define "protection" and "sabotage" concretely for this game, e.g.:
  - Protection candidate: the recipient's vote cannot be redirected/nullified this round, or the recipient is immune to being the tie-break target.
  - Sabotage candidate: the recipient's clue this round is hidden from everyone except the Vendor until the next round, or the recipient's vote this round is discarded.
  - Whether the Vendor knows which effect they're giving, or it's randomized and hidden even from the Vendor (source says "try your luck," implying it may be random/blind).
- Do not start implementation until this is resolved with the product owner; treat this phase as spec-then-build, not build-from-the-page-alone.
- Minimum 4 active players (per source).

## PHASE 34 — Mr. Meme
Needs an online-play adaptation decision — the source assumes players are physically co-located and can see gestures; this product is an online room, not in-person.

- ASSUMPTION (needs product decision before building): the site's rule is "describe your word with gestures instead of speaking," which has no direct equivalent in a text-clue online game. Candidate adaptations, pick one:
  - The selected player's clue this round must be an emoji-only clue (no letters/words), enforced by the same clue-validation layer as the 3-word-max rule.
  - The selected player's clue this round is temporarily replaced by a short webcam/gesture capture if the product later adds video — explicitly out of scope for the current text/canvas architecture and should not be attempted until a video layer exists.
  - Skip Mr. Meme for the online mode entirely and reserve it for the future Pass & Play (in-person) mode, where physical gestures are actually visible.
- Given the current architecture (Architecture.md) has no camera/video-chat capability, the emoji-only-clue adaptation is the only option buildable without new infrastructure — recommend confirming that adaptation, or deferring this role to Pass & Play.
- `onRoundStart`: if adopted, randomly select one active player each round to be "possessed"; that player's Clues-tab input is constrained to emoji characters only for their turn.
- No minimum player count specified by source.

## PHASE 35 — Special Roles QA & Balancing
Do not begin until every enabled-by-default-off role above has been individually built and verified.

- Test every role in isolation with all others OFF, at its minimum valid player count and above.
- Test legal combinations of multiple simultaneously-enabled roles (e.g. Lovers + Duelists + Joy Fool active together) for state conflicts, especially around cascading eliminations (Lovers/Revenger) interacting with Mr. White guess timing and win-condition evaluation.
- Verify no Special Role identity leaks through public state, DOM, accessible labels, or reconnect, except at each role's own defined reveal moment.
- Verify host-only control, per-role locking at investigation start, and correct enable/disable gating below each role's minimum player count.
- Verify Play Again correctly resets all special-role assignments, traits, points, and used/unused flags alongside the existing reset scope from Phase 20.
- Re-run the full Phase 23 QA matrix with a representative set of Special Roles enabled to confirm the base game is unaffected when a given role is OFF.
