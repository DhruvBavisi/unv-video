import { useState, useEffect, useRef, useCallback } from 'react'
import { getRoleImage } from './roleImages.js'

function getInitial(name) {
  if (!name) return '?'
  const match = name.match(/[a-zA-Z0-9]/)
  return match ? match[0].toUpperCase() : name.charAt(0).toUpperCase()
}

// Animation states:  ENTERING → OPEN → EXITING → (unmount)
const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function PlayersPanel({ state, onClose, buttonRect }) {
  const { players, roomId } = state
  const [copied, setCopied] = useState(false)
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const panelRef = useRef(null)
  const overlayRef = useRef(null)

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
    if (e.target === overlayRef.current) {
      handleClose()
    }
  }, [handleClose])

  const gamePlayers = players.filter(p => !p.spectator)
  const spectators = players.filter(p => p.spectator)

  const handleCopy = () => {
    navigator.clipboard.writeText(roomId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const renderCard = (p, statusClass, index) => {
    const isDisconnected = !p.isConnected
    return (
      <li 
        key={p.id} 
        className={`player-card ${statusClass} ${isDisconnected ? 'player-card--disconnected' : ''}`}
        style={{ animationDelay: `${index * 30}ms` }}
      >
        {isDisconnected && <span className="player-card__disconnected-badge">!</span>}
        {p.eliminated && p.role ? (
          <img src={getRoleImage(p.role)} alt={p.role} className="player-card__avatar" />
        ) : (
          <div className="player-card__initial">{getInitial(p.name)}</div>
        )}
        <div className="player-card__name" title={p.name}>{p.name}</div>
        {p.eliminated && p.role && (
          <div className="player-card__role">{p.role.replace('_', ' ')}</div>
        )}
      </li>
    )
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
    <div 
      className={overlayClass} 
      onClick={handleOverlayClick}
      ref={overlayRef}
    >
      <div 
        className={panelClass} 
        onClick={e => e.stopPropagation()}
        ref={panelRef}
        style={flyVars}
      >
        <header className="players-panel-header">
          <h2>Players</h2>
          <button className="players-panel-close" onClick={handleClose} aria-label="Close panel">&times;</button>
        </header>

        <div className="players-panel-content">
          <div className="players-panel-section">
            <span className="online-kicker">Room Code</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', letterSpacing: '0.1em' }}>{roomId}</span>
              <button className="players-copy-btn" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <div className="players-panel-section" style={{ marginTop: '12px' }}>
            <span className="online-kicker">Participants ({gamePlayers.length})</span>
            <ul className="players-grid">
              {gamePlayers.map((p, i) => renderCard(p, p.eliminated ? 'player-card--eliminated' : 'player-card--active', i))}
            </ul>
          </div>

          {spectators.length > 0 && (
            <div className="players-panel-section" style={{ marginTop: '12px' }}>
              <span className="online-kicker">Spectators ({spectators.length})</span>
              <ul className="players-grid">
                {spectators.map((p, i) => renderCard(p, 'player-card--spectator', i))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
