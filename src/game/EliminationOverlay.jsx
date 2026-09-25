import React, { useLayoutEffect, useState, useRef, useEffect, useCallback } from 'react'
import { getRoleImage } from './roleImages.js'
import { emitSubmitMrWhiteGuess, emitMrWhiteLiveGuess } from './gameState.js'

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

// Inline Mr White guess panel rendered inside the elimination card back-face
function MrWhiteGuessPanel({ isMe, liveGuess, socketRef, onSubmitted }) {
  const [localText, setLocalText] = useState(liveGuess || '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const throttleRef = useRef(null)
  const inputRef = useRef(null)

  // Sync incoming liveGuess (from server broadcasts) when not the guesser
  useEffect(() => {
    if (!isMe) {
      setLocalText(liveGuess || '')
    }
  }, [isMe, liveGuess])

  // Auto-focus input for Mr White
  useEffect(() => {
    if (isMe && inputRef.current && !submitted) {
      inputRef.current.focus()
    }
  }, [isMe, submitted])

  const handleChange = useCallback((e) => {
    if (!isMe || submitted) return
    const val = e.target.value.slice(0, 40)
    setLocalText(val)

    // Throttle live-guess updates to avoid flooding — max once per 80ms
    if (throttleRef.current) clearTimeout(throttleRef.current)
    throttleRef.current = setTimeout(() => {
      if (socketRef?.current) {
        emitMrWhiteLiveGuess(socketRef.current, val)
      }
    }, 80)
  }, [isMe, submitted, socketRef])

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault()
    if (!isMe || submitting || submitted) return
    const trimmed = localText.trim()
    if (!trimmed) { setError('Enter your guess first.'); return }

    setSubmitting(true)
    setError('')

    // Flush the live guess immediately before submitting
    if (socketRef?.current) {
      await emitMrWhiteLiveGuess(socketRef.current, trimmed)
    }

    const response = await emitSubmitMrWhiteGuess(socketRef.current, trimmed)
    if (!response?.success) {
      setError(response?.error === 'ALREADY_SUBMITTED' ? 'Already submitted.' : 'Failed to submit guess.')
      setSubmitting(false)
    } else {
      setSubmitted(true)
      setSubmitting(false)
      onSubmitted?.()
    }
  }, [isMe, submitting, submitted, localText, socketRef, onSubmitted])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  return (
    <div className="mw-guess-panel" style={{
      marginTop: '16px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      width: '100%',
      padding: '0 8px',
    }}>
      <p style={{
        fontSize: '0.62rem',
        letterSpacing: '0.2em',
        color: 'var(--danger, #ff4d4d)',
        margin: 0,
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        MR WHITE IS GUESSING
      </p>

      {/* Live guess display / input */}
      {isMe && !submitted ? (
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <input
            ref={inputRef}
            type="text"
            value={localText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type the Civilian word…"
            maxLength={40}
            disabled={submitting}
            autoComplete="off"
            spellCheck="false"
            style={{
              width: '100%',
              padding: '10px 12px',
              fontSize: '1rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '6px',
              color: '#fff',
              fontFamily: 'var(--font-body, inherit)',
              boxSizing: 'border-box',
              outline: 'none',
              textAlign: 'center',
              letterSpacing: '0.05em',
            }}
          />
          {error && (
            <p style={{ fontSize: '0.7rem', color: 'var(--danger, #ff4d4d)', margin: 0, textAlign: 'center' }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || !localText.trim()}
            style={{
              padding: '9px 16px',
              fontSize: '0.7rem',
              letterSpacing: '0.15em',
              fontWeight: 700,
              textTransform: 'uppercase',
              background: submitting || !localText.trim() ? 'rgba(255,77,77,0.3)' : 'var(--danger, #ff4d4d)',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: submitting || !localText.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 200ms ease',
              fontFamily: 'var(--font-body, inherit)',
            }}
          >
            {submitting ? 'Checking…' : 'Submit Guess'}
          </button>
        </form>
      ) : (
        // Read-only view — shown to all other players, and to Mr White after submission
        <div style={{
          width: '100%',
          padding: '10px 12px',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          color: localText ? '#fff' : 'rgba(255,255,255,0.3)',
          textAlign: 'center',
          letterSpacing: '0.05em',
          minHeight: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          fontFamily: 'var(--font-body, inherit)',
          fontStyle: localText ? 'normal' : 'italic',
          fontSize: localText ? '1rem' : '0.8rem',
        }}>
          {localText || (submitted ? '…' : 'Waiting for guess…')}
        </div>
      )}
    </div>
  )
}

export default function EliminationOverlay({
  eliminationResult,
  sourceRect,
  myPlayerId,
  mrWhiteGuesserId,
  mrWhiteLiveGuess,
  socketRef,
}) {
  // 0: hidden/measure, 1: travel, 2: settle, 3: morph, 4: flip, 5: final details, 6: exit flight
  const [phase, setPhase] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [finalDimensions, setFinalDimensions] = useState(null)
  const [guessSubmitted, setGuessSubmitted] = useState(false)
  
  const animatedCardRef = useRef(null)

  const isMrWhiteGuessing = !!eliminationResult?.isMrWhiteGuessing
  const isMrWhiteWrongGuessExit = !!eliminationResult?.isMrWhiteWrongGuessExit
  const isMe = myPlayerId && mrWhiteGuesserId && myPlayerId === mrWhiteGuesserId

  // Reset guess submitted state when a new elimination starts
  useEffect(() => {
    setGuessSubmitted(false)
  }, [eliminationResult?.playerId])

  // Removed: card expansion effect. The transition into guessing is a CONTENT transition.

  // Global 5s authoritative timer or instant exit for wrong guess
  useEffect(() => {
    if (isMrWhiteWrongGuessExit) {
      setFinalDimensions({ width: 220, height: 280 })
      setMounted(true)
      setPhase(5)
      const timer = setTimeout(() => {
        setPhase(6)
      }, 200)
      return () => clearTimeout(timer)
    }

    if (!eliminationResult?.startedAt) return

    // Mr White initial reveal: do NOT auto-exit after 5s — wait for guess phase
    if (eliminationResult?.role === 'MR_WHITE') return

    const timeElapsed = Date.now() - eliminationResult.startedAt
    const remaining = 5000 - timeElapsed
    
    if (remaining <= 0) {
      setPhase(6)
    } else {
      const timer = setTimeout(() => {
        setPhase(6)
      }, remaining)
      return () => clearTimeout(timer)
    }
  }, [eliminationResult, isMrWhiteWrongGuessExit, isMrWhiteGuessing])
  
  // Measure Phase
  useLayoutEffect(() => {
    if (animatedCardRef.current && phase === 0) {
      animatedCardRef.current.style.opacity = '0'
    }

    if (isMrWhiteWrongGuessExit) return

    if (phase === 0 && sourceRect && eliminationResult) {
      setFinalDimensions({ width: 220, height: 280 })
      
      requestAnimationFrame(() => {
        setMounted(true)
        setPhase(1)
      })
    }
  }, [phase, sourceRect, eliminationResult, isMrWhiteWrongGuessExit])

  // Animation Sequence Phase
  useEffect(() => {
    if (isMrWhiteWrongGuessExit) return
    if (phase !== 1 || !animatedCardRef.current || !sourceRect || !finalDimensions) return

    const card = animatedCardRef.current
    card.style.transition = 'none'
    card.style.opacity = '1'
    card.style.width = `${sourceRect.width}px`
    card.style.height = `${sourceRect.height}px`
    card.style.top = `${sourceRect.top}px`
    card.style.left = `${sourceRect.left}px`
    card.style.transform = `translate(0, 0)`

    card.offsetHeight // Force reflow

    requestAnimationFrame(() => {
      const destX = window.innerWidth / 2 - sourceRect.width / 2
      const destY = window.innerHeight / 2 - sourceRect.height / 2
      
      const deltaX = destX - sourceRect.left
      const deltaY = destY - sourceRect.top

      card.style.transition = 'transform 1200ms cubic-bezier(0.4, 0, 0.2, 1)'
      card.style.transform = `translate(${deltaX}px, ${deltaY}px)`

      setTimeout(() => {
        setPhase((p) => p < 6 ? 2 : p)
        card.style.transition = 'none'
        card.style.transform = 'translate(0, 0)'
        card.style.left = `${destX}px`
        card.style.top = `${destY}px`
        card.offsetHeight 
        
        setTimeout(() => {
          setPhase((p) => p < 6 ? 3 : p)
          const w = finalDimensions.width
          const h = finalDimensions.height
          const newLeft = window.innerWidth / 2 - w / 2
          const newTop = window.innerHeight / 2 - h / 2
          
          card.style.transition = 'width 450ms cubic-bezier(0.4, 0, 0.2, 1), height 450ms cubic-bezier(0.4, 0, 0.2, 1), top 450ms cubic-bezier(0.4, 0, 0.2, 1), left 450ms cubic-bezier(0.4, 0, 0.2, 1)'
          card.style.width = `${w}px`
          card.style.height = `${h}px`
          card.style.left = `${newLeft}px`
          card.style.top = `${newTop}px`
          
          setTimeout(() => {
            setPhase((p) => p < 6 ? 4 : p)
            setTimeout(() => {
              setPhase((p) => p < 6 ? 5 : p)
            }, 600)
          }, 500)
        }, 200)
      }, 1200)
    })
  }, [phase, sourceRect, finalDimensions, isMrWhiteWrongGuessExit])

  // The card remains exactly at its phase 5 position/dimensions.
  // No repositioning or dimension expanding is performed.

  // Phase 6: Exit Flight Animation
  useEffect(() => {
    if (phase === 6 && animatedCardRef.current) {
      const card = animatedCardRef.current
      const btn = document.getElementById('players-navbar-button')
      
      // Ensure card position is centered before exit flight if starting directly at phase 5/6
      if (isMrWhiteWrongGuessExit || !sourceRect) {
        const destX = window.innerWidth / 2 - (finalDimensions?.width || 220) / 2
        const destY = window.innerHeight / 2 - (finalDimensions?.height || 280) / 2
        card.style.transition = 'none'
        card.style.opacity = '1'
        card.style.left = `${destX}px`
        card.style.top = `${destY}px`
        card.style.width = `${finalDimensions?.width || 220}px`
        card.style.height = `${finalDimensions?.height || 280}px`
        card.style.transform = 'translate(0, 0)'
        card.offsetHeight // force reflow
      }

      if (btn) {
        const btnRect = btn.getBoundingClientRect()
        const cardRect = card.getBoundingClientRect()
        
        const destX = btnRect.left + btnRect.width / 2
        const destY = btnRect.top + btnRect.height / 2
        
        const startX = cardRect.left + cardRect.width / 2
        const startY = cardRect.top + cardRect.height / 2
        
        const deltaX = destX - startX
        const deltaY = destY - startY

        requestAnimationFrame(() => {
          card.style.transition = 'all 1200ms cubic-bezier(0.4, 0, 0.2, 1)'
          card.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.05) rotate(10deg) rotateX(50deg) skewX(-15deg)`
          card.style.opacity = '0'
        })
        
        setTimeout(() => {
          btn.style.transition = 'transform 150ms ease'
          btn.style.transform = 'scale(1.2)'
          setTimeout(() => {
            btn.style.transform = 'scale(1)'
          }, 150)
        }, 1050)
      }
    }
  }, [phase, isMrWhiteWrongGuessExit, sourceRect, finalDimensions])

  if (!eliminationResult) return null

  const { playerName, role } = eliminationResult
  const characterUrl = getRoleImage(role)
  const displayRole = role ? role.replace('_', ' ') : 'UNKNOWN'
  const roleKey = (role || 'civilian').toLowerCase()

  const isMorphingOrLater = phase >= 3
  const isFlipped = phase >= 4
  const showDetails = phase >= 5
  const isExiting = phase >= 6

  // Show Mr White guess UI inside the card when guessing phase is active
  const showGuessUI = isMrWhiteGuessing && showDetails && !isExiting

  return (
    <div className={`elimination-overlay ${mounted && !isExiting ? 'is-visible' : ''}`} style={{ pointerEvents: isExiting ? 'none' : 'auto' }}>
      
      {/* Title (Rendered outside the moving card) */}
      <div 
        className="elimination-ui-container"
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}
      >
        <div style={{ transform: 'translateY(-220px)', textAlign: 'center' }}>
          <h2 className="elimination-title" style={{ opacity: isMorphingOrLater && !isExiting ? 1 : 0, transition: 'opacity 450ms ease', margin: 0 }}>
            PLAYER <span className="elimination-title--danger">ELIMINATED</span>
          </h2>
          <p className="elimination-subtitle" style={{ opacity: isMorphingOrLater && !isExiting ? 1 : 0, transition: 'opacity 450ms ease', margin: '8px 0 0 0' }}>
            {playerName} has been eliminated from the game.
          </p>
        </div>

        {!isMrWhiteGuessing && (
          <div style={{ transform: 'translateY(220px)', width: '90%', maxWidth: '420px', textAlign: 'center' }}>
            <p className={`elimination-desc ${(showDetails && !isExiting) ? 'is-visible' : ''}`} style={{ margin: '0 0 24px 0' }}>
              {getRoleSentence(playerName, role)}
            </p>
          </div>
        )}

        {/* STATIC LAYER B: Mr White Guess UI completely independent from the animated card */}
        {showGuessUI && (
          <div style={{ transform: 'translateY(190px)', width: '90%', maxWidth: '340px', pointerEvents: 'auto' }}>
            <MrWhiteGuessPanel
              isMe={isMe}
              liveGuess={mrWhiteLiveGuess || ''}
              socketRef={socketRef}
              onSubmitted={() => setGuessSubmitted(true)}
            />
          </div>
        )}
      </div>

      {/* The Animated Travelling Card */}
      <div 
        ref={animatedCardRef}
        className="animated-elimination-card"
        style={{
          position: 'absolute'
        }}
      >
        <div className="elimination-card-scene" style={{ width: '100%', height: '100%', margin: 0 }}>
          <div className={`elimination-card-flipper ${isFlipped ? 'is-flipped' : ''}`}>
            
            {/* FRONT FACE */}
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
                  opacity: isMorphingOrLater ? 0 : 1,
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

            {/* BACK FACE */}
            <div className="elimination-card-face elimination-card-face--back" style={{ opacity: isMorphingOrLater ? 1 : 0, transition: 'opacity 400ms ease', overflow: 'hidden' }}>
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
