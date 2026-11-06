import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getAvatarColorClass } from './Lobby.jsx'
import SkribblAvatar from './SkribblAvatar.jsx'

const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function PlayerStrip({ 
  room, 
  currentDrawerId, 
  sessionId, 
  onKickPlayer, 
  onVoteKickPlayer,
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

  // Player selection & action modal state
  const [selectedPlayerId, setSelectedPlayerId] = useState(null)
  const [actionTarget, setActionTarget] = useState(null)
  const [gearBtnRect, setGearBtnRect] = useState(null)
  const [animState, setAnimState] = useState(null) // null | ANIM_ENTERING | ANIM_OPEN | ANIM_EXITING
  const [confirmStep, setConfirmStep] = useState(null) // null | 'kick' | 'votekick'
  const [isVoting, setIsVoting] = useState(false)
  const overlayRef = useRef(null)

  // Fly origin: from the tapped player card's gear button to the screen centre
  const getOriginVars = useCallback(() => {
    if (!gearBtnRect) return {}
    const bx = gearBtnRect.left + gearBtnRect.width / 2
    const by = gearBtnRect.top + gearBtnRect.height / 2
    const cx = (typeof document !== 'undefined' && document.documentElement.clientWidth) ? document.documentElement.clientWidth / 2 : window.innerWidth / 2
    const cy = (typeof document !== 'undefined' && document.documentElement.clientHeight) ? document.documentElement.clientHeight / 2 : window.innerHeight / 2
    return {
      '--fly-tx': `${Math.round(bx - cx)}px`,
      '--fly-ty': `${Math.round(by - cy)}px`,
    }
  }, [gearBtnRect])

  const handleAnimationEnd = (e) => {
    if (e.target !== e.currentTarget) return
    if (e.animationName === 'panelFlyIn') {
      setAnimState(ANIM_OPEN)
    } else if (e.animationName === 'panelFlyOut') {
      setActionTarget(null)
      setConfirmStep(null)
      setGearBtnRect(null)
      setAnimState(null)
      setSelectedPlayerId(null)
    }
  }

  const handleClose = useCallback(() => {
    setAnimState((s) => (s === ANIM_EXITING ? s : ANIM_EXITING))
  }, [])

  // Auto-close menu if target disappears from room
  useEffect(() => {
    if (actionTarget) {
      const stillHere = (room?.players || []).some(p => p.id === actionTarget.id)
      if (!stillHere) {
        const name = actionTarget.name
        setActionTarget(null)
        setConfirmStep(null)
        setGearBtnRect(null)
        setAnimState(null)
        setSelectedPlayerId(null)
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
        const isSelected = selectedPlayerId === p.id && !isCurrent
        
        const baseBg = i % 2 === 0 ? '#FFFFFF' : '#f1f1f1ff'
        const bg = isSelected ? '#E2E8F0' : (isGuessed ? '#CFFFBD' : baseBg)

        return (
          <div 
            key={p.id}
            onClick={() => {
              if (isCurrent) return
              setSelectedPlayerId(prev => (prev === p.id ? null : p.id))
            }}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '10px 6px',
              minHeight: '36px',
              opacity: p.isConnected ? 1 : 0.5,
              background: bg,
              userSelect: 'none',
              WebkitUserSelect: 'none',
              touchAction: 'pan-y',
              cursor: isCurrent ? 'default' : 'pointer',
              transition: 'background-color 150ms ease'
            }}
          >
            {/* Left corner: Gear button when tapped once; otherwise rank number */}
            {isSelected ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const rect = e.currentTarget.getBoundingClientRect()
                  setGearBtnRect(rect)
                  setActionTarget(p)
                  setConfirmStep(null)
                  setAnimState(ANIM_ENTERING)
                }}
                className="sk-gear-btn"
                style={{
                  width: '28px',
                  height: '28px',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1,
                  boxShadow: 'none'
                }}
                aria-label={`Options for ${p.name}`}
                title={`Options for ${p.name}`}
              >
                <img
                  src="/images/svg/settings.svg"
                  alt="Settings"
                  width="24"
                  height="24"
                  style={{ display: 'block', width: '24px', height: '24px', opacity: 0.9 }}
                />
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'black', width: '28px', flexShrink: 0, textAlign: 'center' }}>
                #{rankMap[p.id] || 1}
              </div>
            )}

            {p.avatar ? (
              <div style={{ width: '28px', height: '28px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <SkribblAvatar avatar={p.avatar} size={28} />
              </div>
            ) : (
              <div className={`sk-avatar ${getAvatarColorClass(p.id)}`} style={{ 
                width: '28px', height: '28px', fontSize: '0.9rem', flexShrink: 0, borderRadius: '50%',
                border: isDrawer ? '2px solid var(--sk-primary)' : '1px solid rgba(0,0,0,0.1)',
                boxShadow: 'none'
              }}>
                {p.name.charAt(0).toUpperCase()}
              </div>
            )}
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

      {/* Action Modal: rendered via createPortal so ChatBox cannot overlap it */}
      {actionTarget && typeof document !== 'undefined' && createPortal(
        <div 
          className={`players-panel-overlay sk-settings-overlay ${
            animState === ANIM_ENTERING ? 'players-panel-overlay--entering' :
            animState === ANIM_EXITING ? 'players-panel-overlay--exiting' : 'players-panel-overlay--open'
          }`}
          ref={overlayRef}
          style={{
            zIndex: 999999
          }}
          onClick={(e) => {
            if (e.target === overlayRef.current && !isKicking && !isVoting) {
              handleClose()
            }
          }}
        >
          <div
            className={`players-panel sk-settings-panel sk-player-settings-panel ${
              animState === ANIM_ENTERING ? 'players-panel--entering' :
              animState === ANIM_EXITING ? 'players-panel--exiting' : ''
            }`}
            style={getOriginVars()}
            onAnimationEnd={handleAnimationEnd}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Player Actions for ${actionTarget.name}`}
          >
            {/* Header */}
            <div className="sk-player-modal-header">
              <span className="sk-player-modal-title">PLAYER OPTIONS</span>
              {!isKicking && !isVoting && (
                <button
                  type="button"
                  className="sk-player-modal-close"
                  onClick={handleClose}
                  aria-label="Close"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Target Player Card */}
            <div className="sk-player-modal-card">
              {actionTarget.avatar ? (
                <div style={{ width: '38px', height: '38px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SkribblAvatar avatar={actionTarget.avatar} size={38} bouncy={true} />
                </div>
              ) : (
                <div
                  className={`sk-avatar ${getAvatarColorClass(actionTarget.id)}`}
                  style={{ width: '38px', height: '38px', fontSize: '1.1rem', flexShrink: 0, borderRadius: '50%' }}
                >
                  {actionTarget.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="sk-player-modal-details">
                <div className="sk-player-modal-name">
                  {actionTarget.name}
                  {actionTarget.isHost && <span style={{ marginLeft: '4px' }} title="Host">👑</span>}
                </div>
                <div className="sk-player-modal-sub">
                  {actionTarget.score || 0} points {!actionTarget.isConnected && '• Offline'}
                </div>
              </div>
            </div>

            {/* Menu Options */}
            {!confirmStep ? (
              <div className="sk-player-modal-body">
                {isHost && (
                  <button
                    type="button"
                    className="sk-theme-btn sk-theme-btn--danger"
                    onClick={() => setConfirmStep('kick')}
                  >
                    KICK PLAYER
                  </button>
                )}
                {(() => {
                  const targetVotes = room?.kickVotes?.[actionTarget.id] || []
                  const hasVoted = targetVotes.includes(sessionId)
                  const eligibleVoters = (room?.players || []).filter(p => p.isConnected && p.id !== actionTarget.id)
                  const totalVotes = Math.max(1, eligibleVoters.length)
                  const currentVotes = targetVotes.filter(vid => eligibleVoters.some(p => p.id === vid)).length
                  
                  return (
                    <button
                      type="button"
                      className="sk-theme-btn sk-theme-btn--primary"
                      disabled={hasVoted || isVoting}
                      onClick={() => setConfirmStep('votekick')}
                    >
                      {hasVoted ? `VOTED (${currentVotes}/${totalVotes})` : `VOTE KICK (${currentVotes}/${totalVotes})`}
                    </button>
                  )
                })()}
                <button
                  type="button"
                  className="sk-theme-btn sk-theme-btn--secondary"
                  onClick={handleClose}
                >
                  CANCEL
                </button>
              </div>
            ) : confirmStep === 'kick' ? (
              <div className="sk-player-modal-body">
                <p className="sk-player-modal-text">
                  Kick <strong style={{ color: '#FFC857' }}>{actionTarget.name}</strong> from the room? They will not be able to rejoin this game.
                </p>
                <button
                  type="button"
                  className="sk-theme-btn sk-theme-btn--danger"
                  disabled={isKicking}
                  onClick={() => {
                    const targetId = actionTarget.id
                    onKickPlayer?.(targetId, (success) => {
                      if (success) {
                        handleClose()
                      }
                    })
                  }}
                >
                  {isKicking ? 'KICKING...' : 'YES, KICK'}
                </button>
                <button
                  type="button"
                  className="sk-theme-btn sk-theme-btn--secondary"
                  disabled={isKicking}
                  onClick={() => setConfirmStep(null)}
                >
                  BACK
                </button>
              </div>
            ) : confirmStep === 'votekick' ? (
              <div className="sk-player-modal-body">
                {(() => {
                  const targetVotes = room?.kickVotes?.[actionTarget.id] || []
                  const eligibleVoters = (room?.players || []).filter(p => p.isConnected && p.id !== actionTarget.id)
                  const totalVotes = Math.max(1, eligibleVoters.length)
                  const currentVotes = targetVotes.filter(vid => eligibleVoters.some(p => p.id === vid)).length
                  const willBeVotes = currentVotes + 1

                  return (
                    <>
                      <p className="sk-player-modal-text">
                        Vote to kick <strong style={{ color: '#FFC857' }}>{actionTarget.name}</strong>? Requires all players excluding {actionTarget.name} to agree ({willBeVotes}/{totalVotes}).
                      </p>
                      <button
                        type="button"
                        className="sk-theme-btn sk-theme-btn--primary"
                        disabled={isVoting}
                        onClick={() => {
                          setIsVoting(true)
                          const targetId = actionTarget.id
                          onVoteKickPlayer?.(targetId, (success) => {
                            setIsVoting(false)
                            if (success) {
                              handleClose()
                            }
                          })
                        }}
                      >
                        {isVoting ? 'VOTING...' : 'YES, VOTE KICK'}
                      </button>
                      <button
                        type="button"
                        className="sk-theme-btn sk-theme-btn--secondary"
                        disabled={isVoting}
                        onClick={() => setConfirmStep(null)}
                      >
                        BACK
                      </button>
                    </>
                  )
                })()}
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
