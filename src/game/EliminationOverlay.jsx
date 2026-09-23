import React, { useEffect, useState } from 'react'
import { getRoleImage } from './roleImages.js'

function getRoleSentence(playerName, role) {
  if (role === 'UNDERCOVER') return `${playerName} was an Undercover.`
  if (role === 'CIVILIAN') return `${playerName} was a Civilian.`
  if (role === 'MR_WHITE') return `${playerName} was Mr. White.`
  return `${playerName} has been eliminated.`
}

export default function EliminationOverlay({ eliminationResult, sourceRect }) {
  const [mounted, setMounted] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [contentOpacity, setContentOpacity] = useState(0)

  // Start hidden, wait for sourceRect to calculate exact position
  const [cardStyle, setCardStyle] = useState({ opacity: 0, transform: 'scale(0.25)', transition: 'none' })

  useEffect(() => {
    // If we don't have sourceRect yet, but we are supposed to show an elimination,
    // wait for it. If it never comes (e.g. tie or missing button), we can fallback,
    // but typically VotingPanel will set it immediately.
    if (!sourceRect) return

    // 1. Calculate initial starting position based on the voting card
    const destX = window.innerWidth / 2;
    const destY = window.innerHeight / 2;
    const sourceX = sourceRect.left + sourceRect.width / 2;
    const sourceY = sourceRect.top + sourceRect.height / 2;
    const deltaX = sourceX - destX;
    const deltaY = sourceY - destY;

    // Apply the start state synchronously to React state
    setCardStyle({
      transform: `translate(${deltaX}px, ${deltaY}px) scale(0.25)`,
      opacity: 1,
      transition: 'none'
    })

    let mountTimer, flipTimer, detailsTimer

    // Use double requestAnimationFrame to ensure the start state is painted to the DOM
    // before we apply the CSS transition to the end state.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMounted(true)
        setContentOpacity(1)
        setCardStyle({
          transform: `translate(0, 0) scale(1)`,
          opacity: 1,
          transition: 'transform 1200ms cubic-bezier(0.34, 1.25, 0.64, 1)'
        })

        // 2. Trigger 3D Card Flip after expansion finishes
        flipTimer = setTimeout(() => {
          setIsFlipped(true)
        }, 1250)

        // 3. Reveal narrative description and action button after flip
        detailsTimer = setTimeout(() => {
          setShowDetails(true)
        }, 1900)
      })
    })

    return () => {
      clearTimeout(flipTimer)
      clearTimeout(detailsTimer)
    }
  }, [sourceRect])

  if (!eliminationResult) return null

  console.log('[ELIMINATION DEBUG]\nRENDER PHASE=ELIMINATION')

  const { playerName, role } = eliminationResult
  const characterUrl = getRoleImage(role)
  const displayRole = role ? role.replace('_', ' ') : 'UNKNOWN'
  const roleKey = (role || 'civilian').toLowerCase()

  return (
    <div className={`elimination-overlay ${mounted ? 'is-visible' : ''}`}>
      <div className="elimination-card" style={cardStyle}>
        <h2 className="elimination-title" style={{ opacity: contentOpacity, transition: 'opacity 800ms ease' }}>
          PLAYER <span className="elimination-title--danger">ELIMINATED</span>
        </h2>
        <p className="elimination-subtitle" style={{ opacity: contentOpacity, transition: 'opacity 800ms ease' }}>{playerName} has been eliminated from the game.</p>
        
        {/* 3D Flip Card Container */}
        <div className="elimination-card-scene">
          <div className={`elimination-card-flipper ${isFlipped ? 'is-flipped' : ''}`}>
            {/* FRONT FACE: Confidential Suspect Card */}
            <div className="elimination-card-face elimination-card-face--front">
              <div className="elimination-front-content">
                <span className="elimination-front-badge">CLASSIFIED</span>
                <div className="elimination-front-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </div>
                <div className="elimination-front-name">{playerName}</div>
                <span className="elimination-front-status">REVEALING IDENTITY...</span>
              </div>
            </div>

            {/* BACK FACE: Revealed Character & Role Card */}
            <div className="elimination-card-face elimination-card-face--back">
              <div className={`elimination-char-card elimination-char-card--${roleKey}`}>
                <div className="elimination-char-img-wrap">
                  <img src={characterUrl} alt={displayRole} />
                </div>
                <div className="elimination-role-banner">
                  <span className={`elimination-role-banner-text elimination-role-banner-text--${roleKey}`}>
                    {displayRole}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className={`elimination-desc ${showDetails ? 'is-visible' : ''}`}>
          {getRoleSentence(playerName, role)}
        </p>

        <button className={`elimination-continue-btn ${showDetails ? 'is-visible' : ''}`} type="button">
          Continue
        </button>
      </div>
    </div>
  )
}


