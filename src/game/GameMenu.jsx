import { useState, useEffect, useRef, useCallback } from 'react'
import Button from '../components/Button.jsx'

const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, isExiting, onExited, disabled }) {
  const [localMountState, setLocalMountState] = useState(isExiting ? 'EXITING' : 'ENTERING')

  useEffect(() => {
    if (isExiting) {
      setLocalMountState('EXITING')
      const timer = setTimeout(() => {
        if (onExited) onExited()
      }, 250) // Match CSS animation duration
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => setLocalMountState('OPEN'), 240)
      return () => clearTimeout(timer)
    }
  }, [isExiting, onExited])

  const overlayClass = `confirm-overlay ${localMountState === 'EXITING' ? 'confirm-overlay--exiting' : ''}`
  const dialogClass = `confirm-dialog ${localMountState === 'EXITING' ? 'confirm-dialog--exiting' : ''}`

  return (
    <div className={overlayClass} onClick={!disabled ? onCancel : undefined} style={{ zIndex: 100000 }}>
      <div className={dialogClass} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{message}</p>
        <div className="confirm-dialog__actions">
          <Button onClick={onCancel} disabled={disabled}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} disabled={disabled}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

export default function GameMenu({ state, socketRef, dispatch, onClose, buttonRect, onLeaveConfirm }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const [confirmState, setConfirmState] = useState(null)
  
  // Transition orchestrator states
  const [loading, setLoading] = useState(false)
  const [isConfirmExiting, setIsConfirmExiting] = useState(false)
  const [transitionAction, setTransitionAction] = useState(null)
  const [serverStateMet, setServerStateMet] = useState(false)
  const [confirmExited, setConfirmExited] = useState(false)

  const panelRef = useRef(null)
  const overlayRef = useRef(null)

  const host = state.hostId === state.sessionId
  const isResultPhase = state.gamePhase === 'RESULT'
  const isVotePhase = state.gamePhase === 'VOTE'
  const hasVotes = Object.keys(state.votes || {}).length > 0
  const hasLockedVotes = (state.lockedVotes || []).length > 0
  const hasTieResult = Boolean(state.voteResult?.tie)
  const canRevote = host && isVotePhase && (hasVotes || hasLockedVotes || hasTieResult)

  // Compute origin transform from button rect to panel center
  const getOriginVars = useCallback(() => {
    if (!buttonRect) return {}
    const vw = window.innerWidth
    const vh = window.innerHeight
    const bx = buttonRect.left + buttonRect.width / 2
    const by = buttonRect.top + buttonRect.height / 2
    const px = vw / 2
    const py = vh / 2
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
    if (e.target === overlayRef.current && !confirmState && !loading && !transitionAction) {
      handleClose()
    }
  }, [handleClose, confirmState, loading, transitionAction])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (loading || isConfirmExiting || transitionAction) return
        if (confirmState) setConfirmState(null)
        else handleClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmState, handleClose, loading, isConfirmExiting, transitionAction])

  const handleNewGame = async () => {
    if (loading || isConfirmExiting) return
    if (!socketRef.current || !socketRef.current.connected) {
      dispatch({ type: 'SET_ERROR', error: 'Connection lost' })
      return
    }
    setLoading(true)
    setTransitionAction('new-game')
    setIsConfirmExiting(true)

    socketRef.current.emit('host-new-game', (res) => {
      if (res.error) {
        setLoading(false)
        setIsConfirmExiting(false)
        setTransitionAction(null)
        setConfirmState(null)
        dispatch({ type: 'SET_ERROR', error: res.error })
      }
    })
  }

  const handleBackToLobby = async () => {
    if (loading || isConfirmExiting) return
    if (!socketRef.current || !socketRef.current.connected) {
      dispatch({ type: 'SET_ERROR', error: 'Connection lost' })
      return
    }
    setLoading(true)
    setTransitionAction('back-to-lobby')
    setIsConfirmExiting(true)

    socketRef.current.emit('host-return-to-lobby', (res) => {
      if (res.error) {
        setLoading(false)
        setIsConfirmExiting(false)
        setTransitionAction(null)
        setConfirmState(null)
        dispatch({ type: 'SET_ERROR', error: res.error })
      }
    })
  }

  const handleSkipClueRound = async () => {
    if (loading || isConfirmExiting) return
    if (!socketRef.current || !socketRef.current.connected) {
      dispatch({ type: 'SET_ERROR', error: 'Connection lost' })
      return
    }
    setLoading(true)
    setTransitionAction('skip-clue-round')
    setIsConfirmExiting(true)

    socketRef.current.emit('host-skip-clue-round', (res) => {
      if (res?.error) {
        setLoading(false)
        setIsConfirmExiting(false)
        setTransitionAction(null)
        setConfirmState(null)
        dispatch({ type: 'SET_ERROR', error: res.error })
      }
    })
  }

  const handleRevote = async () => {
    if (loading || isConfirmExiting) return
    if (!socketRef.current || !socketRef.current.connected) {
      dispatch({ type: 'SET_ERROR', error: 'Connection lost' })
      return
    }
    setLoading(true)
    setTransitionAction('revote')
    setIsConfirmExiting(true)

    socketRef.current.emit('host-revote', (res) => {
      if (res?.error) {
        setLoading(false)
        setIsConfirmExiting(false)
        setTransitionAction(null)
        setConfirmState(null)
        dispatch({ type: 'SET_ERROR', error: res.error })
      }
    })
  }

  const handleConfirmExited = useCallback(() => {
    setConfirmState(null)
    setIsConfirmExiting(false)
    setConfirmExited(true)
  }, [])

  // Monitor for server state update
  useEffect(() => {
    if (transitionAction === 'new-game') {
      if (state.phase === 'CLUE_PHASE' || state.gameStatus === 'ACTIVE') {
        setServerStateMet(true)
      }
    } else if (transitionAction === 'back-to-lobby') {
      if (state.phase === 'ROOM_LOBBY' && state.gameStatus === 'SETUP') {
        setServerStateMet(true)
      }
    } else if (transitionAction === 'skip-clue-round') {
      if (state.gamePhase === 'VOTE' || state.phase === 'VOTE_PHASE') {
        setServerStateMet(true)
      }
    } else if (transitionAction === 'revote') {
      if (
        state.gamePhase === 'VOTE' &&
        Object.keys(state.votes || {}).length === 0 &&
        (state.lockedVotes || []).length === 0 &&
        !state.voteResult
      ) {
        setServerStateMet(true)
      }
    }
  }, [state.phase, state.gamePhase, state.gameStatus, state.votes, state.lockedVotes, state.voteResult, transitionAction])

  // When BOTH confirm exited AND server state met, settle and close GameMenu
  useEffect(() => {
    if (transitionAction && confirmExited && serverStateMet) {
      const settleTimer = setTimeout(() => {
        handleClose()
      }, 150)
      return () => clearTimeout(settleTimer)
    }
  }, [transitionAction, confirmExited, serverStateMet, handleClose])

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
            <button 
              className="players-panel-close" 
              onClick={handleClose} 
              aria-label="Close menu"
              disabled={loading || transitionAction}
            >&times;</button>
          </header>

          <div className="players-panel-content" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px 16px' }}>
            {host ? (
              <>
                {state.gamePhase === 'CLUE' && (
                  <Button 
                    onClick={() => setConfirmState('skip-clue-round')} 
                    disabled={loading || transitionAction}
                    style={{ fontSize: '1.2rem', padding: '16px' }}
                  >
                    Skip Clue Round
                  </Button>
                )}
                {canRevote && (
                  <Button
                    onClick={() => setConfirmState('revote')}
                    disabled={loading || transitionAction}
                    style={{ fontSize: '1.2rem', padding: '16px' }}
                  >
                    ↻ Revote
                  </Button>
                )}
                {!isResultPhase && (
                  <Button 
                    variant="primary" 
                    onClick={() => setConfirmState('new-game')} 
                    disabled={loading || transitionAction}
                    style={{ fontSize: '1.2rem', padding: '16px' }}
                  >
                    ↻ New Game
                  </Button>
                )}
                <Button 
                  onClick={() => setConfirmState('back-to-lobby')} 
                  disabled={loading || transitionAction}
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
                disabled={loading || transitionAction}
                style={{ fontSize: '1.2rem', padding: '16px' }}
              >
                Leave Game
              </Button>
            )}
            <hr style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '8px 0' }} />
            <Button onClick={handleClose} disabled={loading || transitionAction}>Close</Button>
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
          isExiting={isConfirmExiting}
          onExited={handleConfirmExited}
          disabled={isConfirmExiting}
        />
      )}
      
      {confirmState === 'back-to-lobby' && (
        <ConfirmDialog
          title="RETURN TO LOBBY?"
          message={'The current game will end.\nYou can change the game settings before\nstarting a new investigation.'}
          confirmLabel="Back to Lobby"
          onConfirm={handleBackToLobby}
          onCancel={() => setConfirmState(null)}
          isExiting={isConfirmExiting}
          onExited={handleConfirmExited}
          disabled={isConfirmExiting}
        />
      )}

      {confirmState === 'skip-clue-round' && (
        <ConfirmDialog
          title="SKIP CLUE ROUND?"
          message={'The remaining players will not give clues this round.\nThe game will move directly to voting.'}
          confirmLabel="Skip Clue Round"
          onConfirm={handleSkipClueRound}
          onCancel={() => setConfirmState(null)}
          isExiting={isConfirmExiting}
          onExited={handleConfirmExited}
          disabled={isConfirmExiting}
        />
      )}

      {confirmState === 'revote' && (
        <ConfirmDialog
          title="RESTART VOTE?"
          message={'All current votes will be cleared.\nPlayers can cast and lock their votes again.'}
          confirmLabel="Start Revote"
          onConfirm={handleRevote}
          onCancel={() => setConfirmState(null)}
          isExiting={isConfirmExiting}
          onExited={handleConfirmExited}
          disabled={isConfirmExiting}
        />
      )}
    </>
  )
}
