import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

// Same state machine as the Undercover PlayersPanel (src/game/PlayersPanel.jsx):
// ENTERING (500ms fly-out from the button) -> OPEN -> EXITING (480ms fly-back) -> onClose()
const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function SettingsPanel({ buttonRect, onClose, onLeave }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const leaveAfterCloseRef = useRef(false)
  const overlayRef = useRef(null)

  // Keep the latest callbacks in refs so parent re-renders never restart the exit timer
  const onCloseRef = useRef(onClose)
  const onLeaveRef = useRef(onLeave)
  useEffect(() => {
    onCloseRef.current = onClose
    onLeaveRef.current = onLeave
  })

  // Fly origin: from the settings button to the screen centre
  const getOriginVars = useCallback(() => {
    if (!buttonRect) return {}
    const bx = buttonRect.left + buttonRect.width / 2
    const by = buttonRect.top + buttonRect.height / 2
    return {
      '--fly-tx': `${bx - window.innerWidth / 2}px`,
      '--fly-ty': `${by - window.innerHeight / 2}px`,
    }
  }, [buttonRect])

  useEffect(() => {
    if (animState !== ANIM_ENTERING) return
    const t = setTimeout(() => setAnimState(ANIM_OPEN), 500)
    return () => clearTimeout(t)
  }, [animState])

  useEffect(() => {
    if (animState !== ANIM_EXITING) return
    const t = setTimeout(() => {
      onCloseRef.current()
      if (leaveAfterCloseRef.current) onLeaveRef.current()
    }, 480)
    return () => clearTimeout(t)
  }, [animState])

  const handleClose = useCallback(() => {
    setAnimState((s) => (s === ANIM_EXITING ? s : ANIM_EXITING))
  }, [])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) handleClose()
  }

  const handleConfirmLeave = () => {
    leaveAfterCloseRef.current = true
    handleClose()
  }

  const overlayAnim =
    animState === ANIM_ENTERING ? 'players-panel-overlay--entering' :
    animState === ANIM_EXITING ? 'players-panel-overlay--exiting' : ''
  const panelAnim =
    animState === ANIM_ENTERING ? 'players-panel--entering' :
    animState === ANIM_EXITING ? 'players-panel--exiting' : ''

  return createPortal(
    <div
      className={`players-panel-overlay sk-settings-overlay ${overlayAnim}`}
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{ zIndex: 1000000 }}
    >
      <div
        className={`players-panel sk-settings-panel ${panelAnim}`}
        style={getOriginVars()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className="sk-settings-header">
          <h2 className="sk-settings-title">{confirmLeave ? 'LEAVE GAME?' : 'SETTINGS'}</h2>
          <button type="button" className="sk-settings-close" onClick={handleClose} aria-label="Close settings">&times;</button>
        </header>

        {!confirmLeave ? (
          <div className="sk-settings-body">
            <button type="button" className="sk-btn sk-btn--danger" onClick={() => setConfirmLeave(true)}>
              LEAVE GAME
            </button>
            <button type="button" className="sk-btn sk-btn--secondary" onClick={handleClose}>
              RESUME
            </button>
          </div>
        ) : (
          <div className="sk-settings-body">
            <p className="sk-settings-text">
              You will leave this room. You can rejoin with the room code if the room is still open.
            </p>
            <button type="button" className="sk-btn sk-btn--danger" onClick={handleConfirmLeave}>
              YES, LEAVE
            </button>
            <button type="button" className="sk-btn sk-btn--secondary" onClick={() => setConfirmLeave(false)}>
              STAY
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
