import React, { useLayoutEffect, useState, useRef, useEffect } from 'react'
import { getRoleImage } from './roleImages.js'

function getRoleSentence(playerName, role) {
  if (role === 'UNDERCOVER') return `${playerName} was an Undercover.`
  if (role === 'CIVILIAN') return `${playerName} was a Civilian.`
  if (role === 'MR_WHITE') return `${playerName} was Mr. White.`
  return `${playerName} has been eliminated.`
}

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

export default function EliminationOverlay({ eliminationResult, sourceRect, onContinue, submitting }) {
  // 0: hidden/measure, 1: travel, 2: settle, 3: morph, 4: flip, 5: final details
  const [phase, setPhase] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [finalDimensions, setFinalDimensions] = useState(null)
  
  const animatedCardRef = useRef(null)
  
  // Measure Phase
  useLayoutEffect(() => {
    if (phase === 0 && sourceRect && eliminationResult) {
      // The final card size requested by CSS is typically 190x210 for the scene, 
      // but the user wants a "tall + narrower elimination card".
      // We will morph to a fixed size that looks good for the flip scene.
      setFinalDimensions({ width: 220, height: 280 })
      
      // Delay slightly to ensure component mounted properly, then start move
      requestAnimationFrame(() => {
        setMounted(true) // Triggers backdrop fade
        setPhase(1)
      })
    }
  }, [phase, sourceRect, eliminationResult])

  // Animation Sequence Phase
  useEffect(() => {
    if (phase !== 1 || !animatedCardRef.current || !sourceRect || !finalDimensions) return

    const card = animatedCardRef.current

    // Set initial voting-card state
    card.style.transition = 'none'
    card.style.width = `${sourceRect.width}px`
    card.style.height = `${sourceRect.height}px`
    card.style.top = `${sourceRect.top}px`
    card.style.left = `${sourceRect.left}px`
    card.style.transform = `translate(0, 0)`

    // Force reflow
    card.offsetHeight

    requestAnimationFrame(() => {
      // Calculate center destinations
      const destX = window.innerWidth / 2 - sourceRect.width / 2
      const destY = window.innerHeight / 2 - sourceRect.height / 2
      
      const deltaX = destX - sourceRect.left
      const deltaY = destY - sourceRect.top

      // PHASE 1: Move to center slowly
      card.style.transition = 'transform 1200ms cubic-bezier(0.4, 0, 0.2, 1)'
      card.style.transform = `translate(${deltaX}px, ${deltaY}px)`

      setTimeout(() => {
        setPhase(2) // Settled

        // Bake the transform into top/left so we can animate width/height smoothly from center
        card.style.transition = 'none'
        card.style.transform = 'translate(0, 0)'
        card.style.left = `${destX}px`
        card.style.top = `${destY}px`
        
        card.offsetHeight // reflow
        
        setTimeout(() => {
          setPhase(3) // Morph
          
          const newLeft = window.innerWidth / 2 - finalDimensions.width / 2
          const newTop = window.innerHeight / 2 - finalDimensions.height / 2
          
          card.style.transition = 'width 450ms cubic-bezier(0.4, 0, 0.2, 1), height 450ms cubic-bezier(0.4, 0, 0.2, 1), top 450ms cubic-bezier(0.4, 0, 0.2, 1), left 450ms cubic-bezier(0.4, 0, 0.2, 1)'
          card.style.width = `${finalDimensions.width}px`
          card.style.height = `${finalDimensions.height}px`
          card.style.left = `${newLeft}px`
          card.style.top = `${newTop}px`
          
          setTimeout(() => {
            setPhase(4) // Flip
            
            setTimeout(() => {
              setPhase(5) // Details
            }, 600)
            
          }, 500) // Wait for morph
          
        }, 200) // Settle duration
        
      }, 1200) // Move duration
    })
  }, [phase, sourceRect, finalDimensions])

  if (!eliminationResult) return null

  const { playerName, role } = eliminationResult
  const characterUrl = getRoleImage(role)
  const displayRole = role ? role.replace('_', ' ') : 'UNKNOWN'
  const roleKey = (role || 'civilian').toLowerCase()

  const isMorphingOrLater = phase >= 3
  const isFlipped = phase >= 4
  const showDetails = phase >= 5

  return (
    <div className={`elimination-overlay ${mounted ? 'is-visible' : ''}`}>
      
      {/* Title & Continue Button (Rendered outside the moving card) */}
      <div 
        className="elimination-ui-container"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: showDetails ? 'auto' : 'none'
        }}
      >
        <div style={{ transform: 'translateY(-200px)', textAlign: 'center' }}>
          <h2 className="elimination-title" style={{ opacity: isMorphingOrLater ? 1 : 0, transition: 'opacity 450ms ease', margin: 0 }}>
            PLAYER <span className="elimination-title--danger">ELIMINATED</span>
          </h2>
          <p className="elimination-subtitle" style={{ opacity: isMorphingOrLater ? 1 : 0, transition: 'opacity 450ms ease', margin: '8px 0 0 0' }}>
            {playerName} has been eliminated from the game.
          </p>
        </div>

        <div style={{ transform: 'translateY(220px)', width: '90%', maxWidth: '420px', textAlign: 'center' }}>
          <p className={`elimination-desc ${showDetails ? 'is-visible' : ''}`} style={{ margin: '0 0 24px 0' }}>
            {getRoleSentence(playerName, role)}
          </p>
          <button 
            className={`elimination-continue-btn ${showDetails ? 'is-visible' : ''}`} 
            type="button"
            onClick={onContinue}
            disabled={submitting}
          >
            {submitting ? 'Waiting...' : 'Continue'}
          </button>
        </div>
      </div>

      {/* The Animated Travelling Card */}
      <div 
        ref={animatedCardRef}
        className="animated-elimination-card"
        style={{
          position: 'absolute',
          // Phase 0 hides the card offscreen briefly while measuring
          opacity: phase === 0 ? 0 : 1, 
          // The CSS transitions and size/pos are applied via refs in useEffect
        }}
      >
        <div className="elimination-card-scene" style={{ width: '100%', height: '100%', margin: 0 }}>
          <div className={`elimination-card-flipper ${isFlipped ? 'is-flipped' : ''}`}>
            
            {/* FRONT FACE: True Voting Card Replica */}
            <div 
              className="elimination-card-face elimination-card-face--front" 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                boxShadow: 'none',
                borderRadius: isMorphingOrLater ? '18px' : '4px',
                transition: 'border-radius 450ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <div 
                className="voting-card voting-card--selected" 
                style={{
                  width: '100%', 
                  height: '100%', 
                  margin: 0,
                  opacity: isMorphingOrLater ? 0 : 1, // Fades out as it morphs
                  transition: 'opacity 400ms ease',
                  boxSizing: 'border-box',
                  borderRadius: isMorphingOrLater ? '18px' : '4px',
                }}
              >
                <span className="voting-card__avatar">{getInitials(playerName)}</span>
                <span className="voting-card__name">{playerName}</span>
                <span className="voting-card__meta">
                  <span className="voting-card__status">ELIMINATED</span>
                </span>
              </div>
            </div>

            {/* BACK FACE: Revealed Character & Role Card */}
            <div className="elimination-card-face elimination-card-face--back" style={{ opacity: isMorphingOrLater ? 1 : 0, transition: 'opacity 400ms ease' }}>
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
      </div>

    </div>
  )
}
