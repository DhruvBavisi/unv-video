import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getAvatarColorClass } from './Lobby.jsx'

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
  const [confirmStep, setConfirmStep] = useState(null) // null | 'kick' | 'votekick'
  const [isVoting, setIsVoting] = useState(false)

  // Auto-close menu if target disappears from room
  useEffect(() => {
    if (actionTarget) {
      const stillHere = (room?.players || []).some(p => p.id === actionTarget.id)
      if (!stillHere) {
        const name = actionTarget.name
        setActionTarget(null)
        setConfirmStep(null)
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
                  setActionTarget(p)
                  setConfirmStep(null)
                }}
                className="sk-gear-btn"
                style={{
                  width: '24px',
                  height: '24px',
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
                  width="18"
                  height="18"
                  style={{ display: 'block', opacity: 0.85 }}
                />
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'black', width: '24px', flexShrink: 0, textAlign: 'center' }}>
                #{rankMap[p.id] || 1}
              </div>
            )}

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

      {/* Action Modal: rendered via createPortal so ChatBox cannot overlap it */}
      {actionTarget && typeof document !== 'undefined' && createPortal(
        <div 
          className="sk-edge-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            padding: '16px'
          }}
          onClick={() => {
            if (!isKicking && !isVoting) {
              setActionTarget(null)
              setConfirmStep(null)
            }
          }}
        >
          <div
            style={{
              width: 'min(340px, 92vw)',
              padding: '22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--sk-surface, #ffffff)',
              border: '3px solid var(--sk-primary, #3366cc)',
              borderRadius: '24px',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
              fontFamily: 'var(--sk-font-body)'
            }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Player Actions for ${actionTarget.name}`}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div
                  className={`sk-avatar ${getAvatarColorClass(actionTarget.id)}`}
                  style={{ width: '34px', height: '34px', fontSize: '1rem', flexShrink: 0, borderRadius: '50%' }}
                >
                  {actionTarget.name.charAt(0).toUpperCase()}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--sk-font-display)',
                    fontSize: '1.25rem',
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
              {!isKicking && !isVoting && (
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '1.8rem',
                    lineHeight: 1,
                    color: 'var(--sk-muted, #64748b)',
                    cursor: 'pointer',
                    padding: '0 4px'
                  }}
                  onClick={() => {
                    setActionTarget(null)
                    setConfirmStep(null)
                  }}
                  aria-label="Close"
                >
                  &times;
                </button>
              )}
            </div>

            {/* Menu Options */}
            {!confirmStep ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {isHost && (
                  <button
                    type="button"
                    className="sk-btn sk-btn--danger"
                    style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 700 }}
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
                      className="sk-btn sk-btn--secondary"
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        fontSize: '0.95rem', 
                        fontWeight: 700,
                        borderColor: hasVoted ? '#94a3b8' : 'var(--sk-primary, #3366cc)',
                        color: hasVoted ? '#64748b' : 'var(--sk-primary, #3366cc)',
                        background: hasVoted ? '#f1f5f9' : 'transparent',
                        opacity: (hasVoted || isVoting) ? 0.75 : 1
                      }}
                      disabled={hasVoted || isVoting}
                      onClick={() => setConfirmStep('votekick')}
                    >
                      {hasVoted ? `VOTED (${currentVotes}/${totalVotes})` : `VOTE KICK (${currentVotes}/${totalVotes})`}
                    </button>
                  )
                })()}
                <button
                  type="button"
                  className="sk-btn sk-btn--secondary"
                  style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                  onClick={() => {
                    setActionTarget(null)
                    setConfirmStep(null)
                  }}
                >
                  CANCEL
                </button>
              </div>
            ) : confirmStep === 'kick' ? (
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
                          setConfirmStep(null)
                          setSelectedPlayerId(null)
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
                    onClick={() => setConfirmStep(null)}
                  >
                    BACK
                  </button>
                </div>
              </div>
            ) : confirmStep === 'votekick' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(() => {
                  const targetVotes = room?.kickVotes?.[actionTarget.id] || []
                  const eligibleVoters = (room?.players || []).filter(p => p.isConnected && p.id !== actionTarget.id)
                  const totalVotes = Math.max(1, eligibleVoters.length)
                  const currentVotes = targetVotes.filter(vid => eligibleVoters.some(p => p.id === vid)).length
                  const willBeVotes = currentVotes + 1

                  return (
                    <>
                      <p style={{ margin: 0, color: 'var(--sk-muted, #64748b)', fontSize: '0.92rem', lineHeight: 1.4, fontWeight: 600 }}>
                        Vote to kick <strong style={{ color: 'var(--sk-text, #1e293b)' }}>{actionTarget.name}</strong>? Requires all players excluding {actionTarget.name} to agree ({willBeVotes}/{totalVotes}).
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <button
                          type="button"
                          className="sk-btn sk-btn--primary"
                          style={{ width: '100%', padding: '12px', fontSize: '0.95rem', opacity: isVoting ? 0.7 : 1 }}
                          disabled={isVoting}
                          onClick={() => {
                            setIsVoting(true)
                            const targetId = actionTarget.id
                            onVoteKickPlayer?.(targetId, (success) => {
                              setIsVoting(false)
                              if (success) {
                                setActionTarget(null)
                                setConfirmStep(null)
                                setSelectedPlayerId(null)
                              }
                            })
                          }}
                        >
                          {isVoting ? 'VOTING...' : 'YES, VOTE KICK'}
                        </button>
                        <button
                          type="button"
                          className="sk-btn sk-btn--secondary"
                          style={{ width: '100%', padding: '12px', fontSize: '0.95rem' }}
                          disabled={isVoting}
                          onClick={() => setConfirmStep(null)}
                        >
                          BACK
                        </button>
                      </div>
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
