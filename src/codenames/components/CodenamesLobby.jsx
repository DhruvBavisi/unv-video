import React, { useState } from 'react'
import { connectSocket } from '../../game/socket.js'
import QRModal from '../../game/QRModal.jsx'

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
  const [showSettingsMenu, setShowSettingsMenu] = useState(false)
  const [showPlayerMenu, setShowPlayerMenu] = useState(false)
  
  // Fake state for modals without real implementation yet
  const [showTimerMenu, setShowTimerMenu] = useState(false)
  const [showWordPackMenu, setShowWordPackMenu] = useState(false)

  const isHost = room.hostId === playerId
  const player = room.players.find(p => p.id === playerId) || {}
  
  const handleSelectTeam = (team, role) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:join-team-role', { team, role })
  }

  const handleStartGame = () => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:start-game', (res) => {
      if (res && res.error) alert(res.error)
    })
  }
  
  const handleResetTeams = () => {
    if (!isHost) return
    const socket = connectSocket(playerId)
    socket.emit('codenames:reset-teams')
  }

  const handleRandomizeTeams = () => {
    if (!isHost) return
    const socket = connectSocket(playerId)
    socket.emit('codenames:randomize-teams')
  }

  const handleDevAddBots = (count = 1) => {
    if (!isHost) return
    const socket = connectSocket(playerId)
    socket.emit('codenames:dev-add-bots', { count })
  }

  const handleDevRemoveBots = () => {
    if (!isHost) return
    const socket = connectSocket(playerId)
    socket.emit('codenames:dev-remove-bots')
  }

  const handleUpdateTimer = (val) => {
    if (!isHost) return
    const socket = connectSocket(playerId)
    socket.emit('codenames:update-settings', { timer: val })
    setShowTimerMenu(false)
  }

  const handleMakeHost = (targetId) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:host-make-host', { targetId })
  }

  const handleKickPlayer = (targetId) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:host-kick-player', { targetId })
  }

  const getJoinUrl = () => {
    const origin = window.location.origin
    return `${origin}/?mode=codenames&room=${room.id}`
  }

  // Spectators (unassigned)
  const unassignedPlayers = room.players.filter(p => !p.team)

  const redTeamCount = room.players.filter(p => p.team === 'red').length
  const blueTeamCount = room.players.filter(p => p.team === 'blue').length

  const canStart = redTeamCount > 0 && 
                   blueTeamCount > 0 &&
                   room.players.some(p => p.team === 'red' && p.role === 'SPYMASTER') &&
                   room.players.some(p => p.team === 'blue' && p.role === 'SPYMASTER') &&
                   unassignedPlayers.length === 0

  // Team counts for display
  const blueOpCount = room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE').length
  const redOpCount = room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE').length

  const currentTimer = room.timer || 'OFF'

  const renderAvatar = (p) => {
    return (
      <div key={p.id} className="cn-avatar-wrapper">
        {p.id === room.hostId && <div className="cn-avatar-crown">👑</div>}
        <div className={`cn-avatar-circle ${p.id === playerId ? 'is-me' : ''}`}>
          <div className="cn-avatar-placeholder"></div>
        </div>
        <div className="cn-avatar-name">{p.name} {p.isBot && <span style={{ color: '#aaa', fontSize: '0.6rem' }}>[BOT]</span>}</div>
      </div>
    )
  }

  return (
    <div className="cn-lobby-fullscreen">
      <div className="cn-top-bar">
        <div className="cn-top-left">
          <button className="cn-icon-button" onClick={() => setShowPlayerMenu(true)} title="Room Info / Players">
            <PlayerIcon />
            <span className="cn-player-count">{room.players.length}</span>
          </button>
        </div>
        <div className="cn-top-center"></div>
        <div className="cn-top-right">
          <button className="cn-icon-button" onClick={() => setShowSettingsMenu(true)} title="Settings / Leave">
            <SettingsIcon />
          </button>
        </div>
      </div>

      <div className="cn-spectator-strip">
        <div className="cn-spectator-content">
          <div className="cn-spectator-icon" onClick={() => handleSelectTeam(null, null)} style={{ cursor: 'pointer', border: '2px solid white', borderRadius: '50%', padding: '2px', display: 'flex' }}>
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

      <div className="cn-settings-panel">
        <div className="cn-settings-header">GAME SETTINGS</div>
        
        <div className="cn-settings-modes">
          <div className="cn-settings-card active">
            <div className="cn-settings-card-content">
              <h4>CLASSIC</h4>
              <p>4+ PLAYERS</p>
            </div>
          </div>
          <div className="cn-settings-card disabled" title="Duet mode not yet supported">
            <div className="cn-settings-card-content">
              <h4>DUET</h4>
              <p>2+ PLAYERS</p>
            </div>
          </div>
        </div>

        <div className="cn-settings-row" onClick={() => setShowWordPackMenu(true)} style={{ cursor: 'pointer' }}>
          <div className="cn-settings-icon-box">ENGLISH</div>
          <div className="cn-settings-text">
            <h4>WORD PACKS & LANGUAGE</h4>
            <p>CODENAMES</p>
          </div>
        </div>

        <div className="cn-settings-row" onClick={() => setShowTimerMenu(true)} style={{ cursor: 'pointer' }}>
          <div className="cn-settings-icon-box timer">🕒</div>
          <div className="cn-settings-text">
            <h4>TIMER</h4>
            <p>{currentTimer}</p>
          </div>
        </div>

        <div className="cn-settings-actions">
          <button className="cn-outline-btn" onClick={handleResetTeams} disabled={!isHost}>Reset teams</button>
          <button className="cn-outline-btn" onClick={handleRandomizeTeams} disabled={!isHost}>Randomize teams</button>
        </div>
        {import.meta.env.DEV && (
          <div className="cn-settings-actions" style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '10px' }}>
            <button className="cn-outline-btn" style={{ borderColor: '#555', color: '#999', fontSize: '0.7rem' }} onClick={() => handleDevAddBots(1)} disabled={!isHost}>DEV: Add Bot</button>
            <button className="cn-outline-btn" style={{ borderColor: '#555', color: '#999', fontSize: '0.7rem' }} onClick={() => handleDevAddBots(3)} disabled={!isHost}>DEV: Add 3 Bots</button>
            <button className="cn-outline-btn" style={{ borderColor: '#555', color: '#999', fontSize: '0.7rem' }} onClick={handleDevRemoveBots} disabled={!isHost}>DEV: Remove Bots</button>
          </div>
        )}
      </div>

      <div className="cn-team-grid">
        <div className={`cn-team-card blue ${player.team === 'blue' && player.role === 'OPERATIVE' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">OPERATIVES</div>
          <div className="cn-team-card-content cn-team-card-players">
            {room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE').map(renderAvatar)}
          </div>
          <button className="cn-join-btn" onClick={() => handleSelectTeam('blue', 'OPERATIVE')}>
            JOIN TEAM
          </button>
        </div>

        <div className={`cn-team-card red ${player.team === 'red' && player.role === 'OPERATIVE' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">OPERATIVES</div>
          <div className="cn-team-card-content cn-team-card-players">
            {room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE').map(renderAvatar)}
          </div>
          <button className="cn-join-btn" onClick={() => handleSelectTeam('red', 'OPERATIVE')}>
            JOIN TEAM
          </button>
        </div>

        <div className={`cn-team-card blue spymaster ${player.team === 'blue' && player.role === 'SPYMASTER' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">SPYMASTERS</div>
          <div className="cn-team-card-content cn-team-card-players">
            {room.players.filter(p => p.team === 'blue' && p.role === 'SPYMASTER').map(renderAvatar)}
          </div>
          <button 
            className="cn-join-btn" 
            onClick={() => handleSelectTeam('blue', 'SPYMASTER')}
          >
            JOIN TEAM
          </button>
        </div>

        <div className={`cn-team-card red spymaster ${player.team === 'red' && player.role === 'SPYMASTER' ? 'selected' : ''}`}>
          <div className="cn-team-card-header">SPYMASTERS</div>
          <div className="cn-team-card-content cn-team-card-players">
            {room.players.filter(p => p.team === 'red' && p.role === 'SPYMASTER').map(renderAvatar)}
          </div>
          <button 
            className="cn-join-btn" 
            onClick={() => handleSelectTeam('red', 'SPYMASTER')}
          >
            JOIN TEAM
          </button>
        </div>
      </div>

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

      {/* MODALS */}
      {showSettingsMenu && (
        <div className="cn-modal-overlay" onClick={() => setShowSettingsMenu(false)}>
          <div className="cn-modal" onClick={e => e.stopPropagation()}>
            <div className="cn-modal-header">Settings</div>
            <div className="cn-modal-content">
              <button className="cn-modal-btn danger" onClick={onLeave}>Leave Game</button>
              <button className="cn-modal-btn" onClick={() => setShowSettingsMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showPlayerMenu && (
        <div className="cn-modal-overlay" onClick={() => setShowPlayerMenu(false)}>
          <div className="cn-modal" onClick={e => e.stopPropagation()}>
            <div className="cn-modal-header">Room Players</div>
            <div className="cn-modal-content">
              <button className="cn-modal-btn" onClick={() => { setShowPlayerMenu(false); setShowQR(true); }}>Show QR Join</button>
              <div className="cn-player-list">
                {room.players.map(p => (
                  <div key={p.id} className="cn-player-list-item">
                    <div style={{ transform: 'scale(0.8)', transformOrigin: 'left center' }}>
                      {renderAvatar(p)}
                    </div>
                    {isHost && p.id !== playerId && (
                      <div className="cn-player-actions">
                        <button onClick={() => handleMakeHost(p.id)}>Make Host</button>
                        <button onClick={() => handleKickPlayer(p.id)}>Kick</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="cn-modal-btn" onClick={() => setShowPlayerMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showTimerMenu && (
        <div className="cn-modal-overlay" onClick={() => setShowTimerMenu(false)}>
          <div className="cn-modal" onClick={e => e.stopPropagation()}>
            <div className="cn-modal-header">Set Timer</div>
            <div className="cn-modal-content">
              {['OFF', '1:00', '2:00', '3:00'].map(val => (
                <button 
                  key={val} 
                  className={`cn-modal-btn ${currentTimer === val ? 'active' : ''}`}
                  onClick={() => handleUpdateTimer(val)}
                  disabled={!isHost}
                >
                  {val}
                </button>
              ))}
              <button className="cn-modal-btn" onClick={() => setShowTimerMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showWordPackMenu && (
        <div className="cn-modal-overlay" onClick={() => setShowWordPackMenu(false)}>
          <div className="cn-modal" onClick={e => e.stopPropagation()}>
            <div className="cn-modal-header">Word Packs</div>
            <div className="cn-modal-content">
              <button className="cn-modal-btn active">English (Classic)</button>
              <button className="cn-modal-btn disabled" disabled>Other Languages (Coming Soon)</button>
              <button className="cn-modal-btn" onClick={() => setShowWordPackMenu(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
