import React, { useState, useRef, useEffect, useCallback } from 'react'
import { getAvatarColorClass } from './Lobby.jsx'

export default function PlayerStrip({ 
  room, 
  currentDrawerId, 
  sessionId, 
  onKickPlayer, 
  isKicking = false, 
  onTargetLeft 
}) {
  const isHost = room?.hostId === sessionId

  // Sort players by score descending to determine ranks without mutating original array
  const sortedPlayers = [...(room?.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0))
  
  // Create a rank map (handling ties with competition ranking: 1, 2, 2, 4)
  const rankMap = {}
  let currentRank = 1
  for (let i = 0; i < sortedPlayers.length; i++) {
    if (i > 0 && sortedPlayers[i].score < sortedPlayers[i - 1].score) {
      currentRank = i + 1
    }
    rankMap[sortedPlayers[i].id] = currentRank
  }

  const guessedIds = room?.guessedPlayerIds || []

  // Host long-press state & refs
  const [actionTarget, setActionTarget] = useState(null)
  const [confirmStep, setConfirmStep] = useState(false)
  const [pressingId, setPressingId] = useState(null)

  const longPressTimerRef = useRef(null)
  const pointerStartPosRef = useRef({ x: 0, y: 0 })
  const activePointerIdRef = useRef(null)

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
    activePointerIdRef.current = null
    setPressingId(null)
  }, [])

  const handlePointerDown = (e, player) => {
    if (!isHost || player.id === sessionId) return
    if (e.button !== undefined && e.button !== 0) return

    cancelLongPress()

    activePointerIdRef.current = e.pointerId
    pointerStartPosRef.current = { x: e.clientX, y: e.clientY }
    setPressingId(player.id)

    longPressTimerRef.current = setTimeout(() => {
      setActionTarget(player)
      setConfirmStep(false)
      setPressingId(null)
      activePointerIdRef.current = null
      longPressTimerRef.current = null
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40)
        }
      } catch {}
    }, 600)
  }

  const handlePointerMove = (e) => {
    if (!longPressTimerRef.current) return
    if (activePointerIdRef.current !== null && e.pointerId !== activePointerIdRef.current) return

    const dx = e.clientX - pointerStartPosRef.current.x
    const dy = e.clientY - pointerStartPosRef.current.y
    if (Math.hypot(dx, dy) > 10) {
      cancelLongPress()
    }
  }

  const handlePointerUp = () => {
    cancelLongPress()
  }

  const handlePointerCancel = () => {
    cancelLongPress()
  }

  const handlePointerLeave = () => {
    cancelLongPress()
  }

  const handleContextMenu = (e, player) => {
    if (isHost && player.id !== sessionId) {
      e.preventDefault()
    }
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
      }
    }
  }, [])

  // Auto-close menu if target disappears from room
  useEffect(() => {
    if (actionTarget) {
      const stillHere = (room?.players || []).some(p => p.id === actionTarget.id)
      if (!stillHere) {
        const name = actionTarget.name
        setActionTarget(null)
        setConfirmStep(false)
        onTargetLeft?.(name)
      }
    }
  }, [room?.players, actionTarget, onTargetLeft])

  return (
    <div 
      data-sk-scroll
      style={{ 
        display: 'flex', 
        flexDirection: 'column',
        overflowY: 'auto', 
        height: '100%',
        width: '100%',
        background: 'white',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        position: 'relative'
      }}>
      {(room?.players || []).map((p, i) => {
        const isDrawer = p.id === currentDrawerId
        const isCurrent = p.id === sessionId
        const isGuessed = guessedIds.includes(p.id)
        const canLongPress = isHost && !isCurrent
        const isPressing = pressingId === p.id
        
        const baseBg = i % 2 === 0 ? '#FFFFFF' : '#f1f1f1ff'
        const bg = isPressing ? '#E2E8F0' : (isGuessed ? '#CFFFBD' : baseBg)

        return (
          <div 
            key={p.id}
            onPointerDown={canLongPress ? (e) => handlePointerDown(e, p) : undefined}
            onPointerMove={canLongPress ? handlePointerMove : undefined}
            onPointerUp={canLongPress ? handlePointerUp : undefined}
            onPointerCancel={canLongPress ? handlePointerCancel : undefined}
            onPointerLeave={canLongPress ? handlePointerLeave : undefined}
            onContextMenu={canLongPress ? (e) => handleContextMenu(e, p) : undefined}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '10px 6px',
              minHeight: '36px',
              opacity: p.isConnected ? 1 : 0.5,
              background: bg,
              userSelect: canLongPress ? 'none' : 'auto',
              WebkitUserSelect: canLongPress ? 'none' : 'auto',
              WebkitTouchCallout: canLongPress ? 'none' : 'default',
              touchAction: 'pan-y',
              cursor: canLongPress ? 'pointer' : 'default',
              transition: 'background-color 150ms ease, transform 150ms ease',
              transform: isPressing ? 'scale(0.98)' : 'none'
            }}
          >
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'black', width: '24px', flexShrink: 0, textAlign: 'center' }}>
              #{rankMap[p.id] || 1}
            </div>
            <div className={`sk-avatar ${getAvatarColorClass(p.id)}`} style={{ 
              width: '28px', height: '28px', fontSize: '0.9rem', flexShrink: 0, borderRadius: '50%',
              border: isDrawer ? '2px solid var(--sk-primary)' : '1px solid rgba(0,0,0,0.1)',
              boxShadow: 'none'
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', lineHeight: '1.1' }}>
              <div style={{ fontSize: '0.8rem', fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: isCurrent ? '#3366cc' : 'black', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name} {isCurrent} {isDrawer && <span style={{ fontSize: '10px', marginLeft: '2px' }}>✏️</span>}
              </div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--sk-font-body)', color: '#333333', fontWeight: 600 }}>
                {p.score} points
              </div>
            </div>
          </div>
        )
      })}

      {/* Host Kick Action / Confirmation Modal */}
      {actionTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999995,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(38, 51, 74, 0.55)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            padding: '16px'
          }}
          onClick={() => {
            if (!isKicking) {
              setActionTarget(null)
              setConfirmStep(false)
            }
          }}
        >
          <div
            style={{
              width: 'min(320px, 90vw)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--sk-surface, #ffffff)',
              border: '3px solid var(--sk-primary, #3366cc)',
              borderRadius: '24px',
              boxShadow: '0 24px 60px rgba(38, 51, 74, 0.35)',
              fontFamily: 'var(--sk-font-body)'
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={confirmStep ? `Confirm Kick ${actionTarget.name}` : `Player Action for ${actionTarget.name}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  className={`sk-avatar ${getAvatarColorClass(actionTarget.id)}`}
                  style={{ width: '32px', height: '32px', fontSize: '1rem', flexShrink: 0, borderRadius: '50%' }}
                >
                  {actionTarget.name.charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--sk-font-display)',
                    fontSize: '1.2rem',
                    fontWeight: 800,
                    color: 'var(--sk-text, #1e293b)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {actionTarget.name}
                </span>
              </div>
              {!isKicking && (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.8rem',
                    lineHeight: 1,
                    color: 'var(--sk-muted)',
                    cursor: 'pointer',
                    padding: '0 4px'
                  }}
                  onClick={() => {
                    setActionTarget(null)
                    setConfirmStep(false)
                  }}
                  aria-label="Close"
                >
                  &times;
                </button>
              )}
            </div>

            {!confirmStep ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  className="sk-btn sk-btn--danger"
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                  onClick={() => setConfirmStep(true)}
                >
                  KICK PLAYER
                </button>
                <button
                  type="button"
                  className="sk-btn sk-btn--secondary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                  onClick={() => {
                    setActionTarget(null)
                    setConfirmStep(false)
                  }}
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <p style={{ margin: 0, color: 'var(--sk-muted, #64748b)', fontSize: '0.92rem', lineHeight: 1.4, fontWeight: 600 }}>
                  Kick <strong style={{ color: 'var(--sk-text, #1e293b)' }}>{actionTarget.name}</strong> from the room? They will not be able to rejoin this game.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="sk-btn sk-btn--danger"
                    style={{ width: '100%', padding: '12px', fontSize: '0.95rem', opacity: isKicking ? 0.7 : 1 }}
                    disabled={isKicking}
                    onClick={() => {
                      const targetId = actionTarget.id
                      onKickPlayer?.(targetId, (success) => {
                        if (success) {
                          setActionTarget(null)
                          setConfirmStep(false)
                        }
                      })
                    }}
                  >
                    {isKicking ? 'KICKING...' : 'YES, KICK'}
                  </button>
                  <button
                    type="button"
                    className="sk-btn sk-btn--secondary"
                    style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                    disabled={isKicking}
                    onClick={() => {
                      setConfirmStep(false)
                    }}
                  >
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

