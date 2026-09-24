import { useState } from 'react'
import { getRoleImage } from './roleImages.js'

function getInitial(name) {
  if (!name) return '?'
  const match = name.match(/[a-zA-Z0-9]/)
  return match ? match[0].toUpperCase() : name.charAt(0).toUpperCase()
}

export default function PlayersPanel({ state, onClose }) {
  const { players, roomId } = state
  const [copied, setCopied] = useState(false)

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

  return (
    <div className="players-panel-overlay" onClick={onClose}>
      <div className="players-panel" onClick={e => e.stopPropagation()}>
        <header className="players-panel-header">
          <h2>Players</h2>
          <button className="players-panel-close" onClick={onClose} aria-label="Close panel">&times;</button>
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
