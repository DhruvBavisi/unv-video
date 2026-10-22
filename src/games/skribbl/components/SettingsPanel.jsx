import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import QRModal from '../../../shared/components/QRModal.jsx'
import SkribblNetworkStatus from './SkribblNetworkStatus.jsx'

// Same state machine as the Undercover PlayersPanel (src/game/PlayersPanel.jsx):
// ENTERING (500ms fly-out from the button) -> OPEN -> EXITING (480ms fly-back) -> onClose()
const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function SettingsPanel({ buttonRect, onClose, onLeave, roomId, connectionStatus = 'Connected' }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const qrBtnRef = useRef(null)
  const copyTimerRef = useRef(null)
  const leaveAfterCloseRef = useRef(false)
  const overlayRef = useRef(null)

  // Keep the latest callbacks in refs so parent re-renders never restart the exit timer
  const onCloseRef = useRef(onClose)
  const onLeaveRef = useRef(onLeave)
  useEffect(() => {
    onCloseRef.current = onClose
    onLeaveRef.current = onLeave
  })

  // Clean up copy feedback timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

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

  const handleCopyCode = async () => {
    if (!roomId) return
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(roomId)
        setCopied(true)
        setCopyFailed(false)
        if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
      } else {
        throw new Error('Clipboard API unavailable')
      }
    } catch {
      setCopyFailed(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopyFailed(false), 2000)
    }
  }

  const overlayAnim =
    animState === ANIM_ENTERING ? 'players-panel-overlay--entering' :
    animState === ANIM_EXITING ? 'players-panel-overlay--exiting' : ''
  const panelAnim =
    animState === ANIM_ENTERING ? 'players-panel--entering' :
    animState === ANIM_EXITING ? 'players-panel--exiting' : ''

  return (
    <>
      {createPortal(
        <div
          className={`players-panel-overlay sk-settings-overlay ${overlayAnim}`}
          ref={overlayRef}
          onClick={handleOverlayClick}
          style={{ zIndex: 999990 }}
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
                {roomId && (
                  <div className="sk-settings-room-row">
                    <div className="sk-settings-room-info">
                      <span className="sk-settings-room-label">
                        {copied ? 'COPIED!' : copyFailed ? 'COPY FAILED' : 'ROOM CODE'}
                      </span>
                      <span className="sk-settings-room-code">{roomId}</span>
                    </div>
                    <div className="sk-settings-room-actions">
                      <button 
                        type="button" 
                        className={`sk-settings-icon-btn ${copied ? 'sk-settings-icon-btn--success' : ''}`}
                        onClick={handleCopyCode}
                        title={copied ? 'Copied!' : copyFailed ? 'Failed to copy' : 'Copy Room Code'}
                        aria-label="Copy room code"
                      >
                        {copied ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        )}
                      </button>
                      <button 
                        ref={qrBtnRef}
                        type="button" 
                        className="sk-settings-icon-btn"
                        onClick={() => setShowQR(true)}
                        title="Show QR Code"
                        aria-label="Show QR code"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h6v6H4z" />
                          <path d="M14 4h6v6h-6z" />
                          <path d="M4 14h6v6H4z" />
                          <path d="M14 14h6v6h-6z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                <div className="sk-settings-status-row">
                  <span className="sk-settings-status-label">CONNECTION</span>
                  <SkribblNetworkStatus status={connectionStatus} inline />
                </div>
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
      )}

      {showQR && roomId && (
        <QRModal 
          roomId={roomId}
          mode="skribbl"
          joinUrl={`${window.location.origin}/?mode=skribbl&room=${encodeURIComponent(roomId)}`}
          buttonRect={qrBtnRef.current?.getBoundingClientRect()}
          onClose={() => setShowQR(false)}
        />
      )}
    </>
  )
}
