import React, { useState } from 'react'
import { connectSocket } from '../../game/socket.js'
import QRModal from '../../game/QRModal.jsx'
import { Users, Settings } from 'lucide-react' // Use standard icons if lucide is available or raw SVGs

// We will use raw SVGs to ensure they match "existing project UI" 
// but wait, let's just use raw SVG for player and settings.

const PlayerIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
)

const SettingsIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
  </svg>
)

export default function CodenamesLobby({ room, playerId, onLeave }) {
  const [showQR, setShowQR] = useState(false)
  
  const isHost = room.hostId === playerId
  const player = room.players.find(p => p.id === playerId) || {}
  
  const handleSelectTeam = (team, role) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:select-team', { team })
    setTimeout(() => {
      socket.emit('codenames:select-role', { role })
    }, 50)
  }

  const handleStartGame = () => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:start-game', (res) => {
      if (res && res.error) alert(res.error)
    })
  }

  const getJoinUrl = () => {
    const origin = window.location.origin
    return `${origin}/?mode=codenames&room=${room.id}`
  }

  // Spectators (unassigned)
  const unassignedPlayers = room.players.filter(p => !p.team)

  const canStart = room.teams?.red?.length > 0 && 
                   room.teams?.blue?.length > 0 &&
                   room.spymasterSlots?.redTaken &&
                   room.spymasterSlots?.blueTaken

  // Team counts for display
  const blueOpCount = room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE').length
  const redOpCount = room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE').length

  const blueSpy = room.players.find(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redSpy = room.players.find(p => p.team === 'red' && p.role === 'SPYMASTER')

  const isBlueSpyTaken = room.spymasterSlots?.blueTaken
  const isRedSpyTaken = room.spymasterSlots?.redTaken

  const renderAvatar = (p) => {
    return (
      <div key={p.id} className="cn-avatar-wrapper">
        {p.id === room.hostId && <div className="cn-avatar-crown">👑</div>}
        <div className={`cn-avatar-circle ${p.id === playerId ? 'is-me' : ''}`}>
          {/* Placeholder for future artwork */}
          <div className="cn-avatar-placeholder"></div>
        </div>
        <div className="cn-avatar-name">{p.name}</div>
      </div>
    )
  }

  return (
    <div className="cn-lobby-fullscreen">
      {/* 1. TOP SAFE AREA + TOP BAR */}
      <div className="cn-top-bar">
        <div className="cn-top-left">
          <button className="cn-icon-button" onClick={() => setShowQR(true)} title="Room Info / QR">
            <PlayerIcon />
            <span className="cn-player-count">{room.players.length}</span>
          </button>
        </div>
        <div className="cn-top-center">
          <h1 className="cn-top-title">CODENAMES</h1>
        </div>
        <div className="cn-top-right">
          <button className="cn-icon-button" onClick={onLeave} title="Settings / Leave">
            <SettingsIcon />
          </button>
        </div>
      </div>

      {/* 2. SPECTATORS BAR */}
      <div className="cn-spectator-strip">
        <div className="cn-spectator-content">
          <div className="cn-spectator-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </div>
          <div className="cn-spectator-list">
            {unassignedPlayers.map(renderAvatar)}
          </div>
        </div>
      </div>

      {/* 3. GAME SETTINGS PANEL */}
      <div className="cn-settings-panel">
        <div className="cn-settings-header">GAME SETTINGS</div>
        
        <div className="cn-settings-modes">
          <div className="cn-settings-card active">
            <div className="cn-settings-card-content">
              <h4>CLASSIC</h4>
              <p>4+ PLAYERS</p>
            </div>
          </div>
          <div className="cn-settings-card disabled">
            <div className="cn-settings-card-content">
              <h4>DUET</h4>
              <p>2+ PLAYERS</p>
            </div>
          </div>
        </div>

        <div className="cn-settings-row">
          <div className="cn-settings-icon-box">ENGLISH</div>
          <div className="cn-settings-text">
            <h4>WORD PACKS & LANGUAGE</h4>
            <p>CODENAMES, CODENAMES: DUET</p>
          </div>
        </div>

        <div className="cn-settings-row">
          <div className="cn-settings-icon-box timer">🕒</div>
          <div className="cn-settings-text">
            <h4>TIMER</h4>
            <p>OFF</p>
          </div>
        </div>

        {/* 4. RESET / RANDOMIZE */}
        <div className="cn-settings-actions">
          <button className="cn-outline-btn">Reset teams</button>
          <button className="cn-outline-btn">Randomize teams</button>
        </div>
      </div>

      {/* 5. TEAM JOIN PANELS */}
      <div className="cn-team-grid">
        <div className={`cn-team-card blue ${player.team === 'blue' && player.role === 'OPERATIVE' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">OPERATIVES</div>
          <div className="cn-team-card-content">
            <div className="cn-team-count">{blueOpCount > 0 ? blueOpCount : ''}</div>
          </div>
          <button className="cn-join-btn" onClick={() => handleSelectTeam('blue', 'OPERATIVE')}>
            JOIN TEAM
          </button>
        </div>

        <div className={`cn-team-card red ${player.team === 'red' && player.role === 'OPERATIVE' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">OPERATIVES</div>
          <div className="cn-team-card-content">
            <div className="cn-team-count">{redOpCount > 0 ? redOpCount : ''}</div>
          </div>
          <button className="cn-join-btn" onClick={() => handleSelectTeam('red', 'OPERATIVE')}>
            JOIN TEAM
          </button>
        </div>

        <div className={`cn-team-card blue spymaster ${player.team === 'blue' && player.role === 'SPYMASTER' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">SPYMASTERS</div>
          <div className="cn-team-card-content">
             {blueSpy && <div className="cn-spy-name">{blueSpy.name}</div>}
          </div>
          <button 
            className="cn-join-btn" 
            onClick={() => handleSelectTeam('blue', 'SPYMASTER')}
            disabled={isBlueSpyTaken && player.role !== 'SPYMASTER'}
          >
            JOIN TEAM
          </button>
        </div>

        <div className={`cn-team-card red spymaster ${player.team === 'red' && player.role === 'SPYMASTER' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">SPYMASTERS</div>
          <div className="cn-team-card-content">
             {redSpy && <div className="cn-spy-name">{redSpy.name}</div>}
          </div>
          <button 
            className="cn-join-btn" 
            onClick={() => handleSelectTeam('red', 'SPYMASTER')}
            disabled={isRedSpyTaken && player.role !== 'SPYMASTER'}
          >
            JOIN TEAM
          </button>
        </div>
      </div>

      {/* 7. START GAME */}
      {isHost && (
        <button 
          className="cn-start-game-btn" 
          onClick={handleStartGame}
          disabled={!canStart}
        >
          START GAME
        </button>
      )}
      {!isHost && (
        <div className="cn-waiting-text">Waiting for host to start...</div>
      )}

      {showQR && (
        <QRModal 
          joinUrl={getJoinUrl()} 
          roomId={room.id} 
          onClose={() => setShowQR(false)} 
          mode="codenames" 
        />
      )}
    </div>
  )
}
