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
