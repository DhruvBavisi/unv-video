import { useState, useEffect, useRef, useCallback } from 'react'
import Button from '../components/Button.jsx'

const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel} style={{ zIndex: 100000 }}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
        <div className="confirm-dialog__actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

export default function GameMenu({ state, socketRef, dispatch, onClose, buttonRect, onLeaveConfirm }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const [confirmState, setConfirmState] = useState(null)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef(null)
  const overlayRef = useRef(null)

  const host = state.hostId === state.sessionId
  const isResultPhase = state.gamePhase === 'RESULT'

  // Compute origin transform from button rect to panel center
  const getOriginVars = useCallback(() => {
    if (!buttonRect) return {}
    const vw = window.innerWidth
    const vh = window.innerHeight
    // Button center
    const bx = buttonRect.left + buttonRect.width / 2
    const by = buttonRect.top + buttonRect.height / 2
    // Panel center (viewport center)
    const px = vw / 2
    const py = vh / 2
    // Translation needed to move from center to button
    const tx = bx - px
    const ty = by - py
    return {
      '--fly-tx': `${tx}px`,
      '--fly-ty': `${ty}px`,
    }
  }, [buttonRect])

  // Entry: transition to OPEN after animation
  useEffect(() => {
    if (animState !== ANIM_ENTERING) return
    const timer = setTimeout(() => setAnimState(ANIM_OPEN), 500)
    return () => clearTimeout(timer)
  }, [animState])

  // Exit: call onClose after animation
  useEffect(() => {
    if (animState !== ANIM_EXITING) return
    const timer = setTimeout(() => onClose(), 480)
    return () => clearTimeout(timer)
  }, [animState, onClose])

  const handleClose = useCallback(() => {
    if (animState === ANIM_EXITING) return
    setAnimState(ANIM_EXITING)
  }, [animState])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current && !confirmState) {
      handleClose()
    }
  }, [handleClose, confirmState])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (confirmState) setConfirmState(null)
        else handleClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmState, handleClose])

  const handleNewGame = async () => {
    if (loading) return
    if (!socketRef.current || !socketRef.current.connected) {
      dispatch({ type: 'SET_ERROR', error: 'Connection lost' })
      return
    }
    setLoading(true)
    socketRef.current.emit('host-new-game', (res) => {
      setLoading(false)
      if (res.error) {
        dispatch({ type: 'SET_ERROR', error: res.error })
      } else {
        handleClose()
      }
    })
  }

  const handleBackToLobby = async () => {
    if (loading) return
    if (!socketRef.current || !socketRef.current.connected) {
      dispatch({ type: 'SET_ERROR', error: 'Connection lost' })
      return
    }
    setLoading(true)
    socketRef.current.emit('host-return-to-lobby', (res) => {
      setLoading(false)
      if (res.error) {
        dispatch({ type: 'SET_ERROR', error: res.error })
      } else {
        handleClose()
      }
    })
  }

  const flyVars = getOriginVars()
  const overlayClass = `players-panel-overlay ${
    animState === ANIM_ENTERING ? 'players-panel-overlay--entering' :
    animState === ANIM_EXITING ? 'players-panel-overlay--exiting' : ''
  }`
  const panelClass = `players-panel ${
    animState === ANIM_ENTERING ? 'players-panel--entering' :
    animState === ANIM_EXITING ? 'players-panel--exiting' : ''
  }`

  return (
    <>
      <div 
        className={overlayClass} 
        onClick={handleOverlayClick}
        ref={overlayRef}
        style={{ zIndex: 9999 }}
      >
        <div 
          className={panelClass} 
          onClick={e => e.stopPropagation()}
          ref={panelRef}
          style={{ ...flyVars, maxWidth: '400px', display: 'flex', flexDirection: 'column' }}
        >
          <header className="players-panel-header">
            <h2>Game Menu</h2>
            <button className="players-panel-close" onClick={handleClose} aria-label="Close menu">&times;</button>
          </header>

          <div className="players-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px 16px' }}>
            {host ? (
              <>
                {!isResultPhase && (
                  <Button 
                    variant="primary" 
                    onClick={() => setConfirmState('new-game')} 
                    disabled={loading}
                    style={{ fontSize: '1.2rem', padding: '16px' }}
                  >
                    ↻ New Game
                  </Button>
                )}
                <Button 
                  onClick={() => setConfirmState('back-to-lobby')} 
                  disabled={loading}
                  style={{ fontSize: '1.2rem', padding: '16px' }}
                >
                  ⌂ Back to Lobby
                </Button>
              </>
            ) : (
              <Button 
                variant="danger"
                onClick={() => {
                  handleClose()
                  onLeaveConfirm()
                }}
                disabled={loading}
                style={{ fontSize: '1.2rem', padding: '16px' }}
              >
                Leave Game
              </Button>
            )}
            <hr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px 0' }} />
            <Button onClick={handleClose} disabled={loading}>Close</Button>
          </div>
        </div>
      </div>
      
      {confirmState === 'new-game' && (
        <ConfirmDialog
          title="START A NEW GAME?"
          message={'The current game will end and a new\nword pair will be selected.\n\nPlayers and game settings will stay the same.'}
          confirmLabel="Start New Game"
          onConfirm={handleNewGame}
          onCancel={() => setConfirmState(null)}
        />
      )}
      
      {confirmState === 'back-to-lobby' && (
        <ConfirmDialog
          title="RETURN TO LOBBY?"
          message={'The current game will end.\nYou can change the game settings before\nstarting a new investigation.'}
          confirmLabel="Back to Lobby"
          onConfirm={handleBackToLobby}
          onCancel={() => setConfirmState(null)}
        />
      )}
    </>
  )
}
