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
