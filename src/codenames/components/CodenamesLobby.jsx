import React, { useState } from 'react'
import { connectSocket } from '../../game/socket.js'
import QRModal from '../../game/QRModal.jsx'

export default function CodenamesLobby({ room, playerId, onLeave }) {
  const [showQR, setShowQR] = useState(false)
  
  const isHost = room.hostId === playerId
  const player = room.players.find(p => p.id === playerId) || {}
  
  const handleMakeHost = (targetId) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:host-make-host', { targetId })
  }

  const handleKick = (targetId) => {
    if (window.confirm("Are you sure you want to kick this player?")) {
      const socket = connectSocket(playerId)
      socket.emit('codenames:host-kick-player', { targetId })
    }
  }

  const handleSelectTeam = (team) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:select-team', { team })
  }

  const handleSelectRole = (role) => {
    const socket = connectSocket(playerId)
    socket.emit('codenames:select-role', { role })
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

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getJoinUrl())
    }
  }

  const redPlayers = room.players.filter(p => p.team === 'red')
  const bluePlayers = room.players.filter(p => p.team === 'blue')
  const unassignedPlayers = room.players.filter(p => !p.team)

  const canStart = room.teams?.red?.length > 0 && 
                   room.teams?.blue?.length > 0 &&
                   room.spymasterSlots?.redTaken &&
                   room.spymasterSlots?.blueTaken &&
                   unassignedPlayers.length === 0

  const renderPlayer = (p) => {
    const isMe = p.id === playerId
    const roleLabel = p.role === 'SPYMASTER' ? 'SpyMaster' : (p.role === 'OPERATIVE' ? 'Operative' : '')
    
    return (
      <li key={p.id} className={`cn-player-item ${isMe ? 'cn-player-me' : ''}`}>
        <span style={{ opacity: p.isConnected ? 1 : 0.5 }}>
          {p.name} {p.id === room.hostId && '(Host)'} {!p.isConnected && '(Offline)'} {roleLabel && <span className="cn-role-badge">{roleLabel}</span>}
        </span>
        {isHost && !isMe && (
          <div className="player-actions">
            <button onClick={() => handleMakeHost(p.id)}>Make Host</button>
            <button onClick={() => handleKick(p.id)} style={{ color: 'red' }}>Kick</button>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="codenames-lobby">
      <div className="lobby-header-row">
        <h2>Lobby</h2>
        <div className="lobby-room-code">
          <span>ROOM</span>
          <strong>{room.id}</strong>
          <button className="room-copy" onClick={handleCopyUrl} title="Copy Link" aria-label="Copy Link">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1zm3 4H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
            </svg>
          </button>
          <button className="room-copy" onClick={() => setShowQR(true)} title="Show QR Code" aria-label="Show QR Code">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 3h8v8H3V3zm2 2v4h4V5H5zm8-2h8v8h-8V3zm2 2v4h4V5h-4zM3 13h8v8H3v-8zm2 2v4h4v-4H5zm13-2h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2zm3 3h3v2h-3v-2zm-3 0h2v2h-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {room.status === 'LOBBY' ? (
        <div className="lobby-controls">
          <div className="control-group">
            <h3>Team</h3>
            <button className={`cn-toggle-btn ${player.team === 'red' ? 'active red' : ''}`} onClick={() => handleSelectTeam('red')}>Red Team</button>
            <button className={`cn-toggle-btn ${player.team === 'blue' ? 'active blue' : ''}`} onClick={() => handleSelectTeam('blue')}>Blue Team</button>
            <button className={`cn-toggle-btn ${!player.team ? 'active' : ''}`} onClick={() => handleSelectTeam(null)}>Unassigned</button>
          </div>

          {player.team && (
            <div className="control-group">
              <h3>Role</h3>
              <button 
                className={`cn-toggle-btn ${player.role === 'OPERATIVE' ? 'active' : ''}`} 
                onClick={() => handleSelectRole('OPERATIVE')}
              >
                Operative
              </button>
              {(() => {
                const isTaken = room.spymasterSlots && room.spymasterSlots[`${player.team}Taken`]
                const isMine = player.role === 'SPYMASTER'
                return (
                  <button 
                    className={`cn-toggle-btn ${isMine ? 'active' : ''}`} 
                    onClick={() => handleSelectRole('SPYMASTER')}
                    disabled={isTaken && !isMine}
                  >
                    Spymaster {isTaken && !isMine ? '(Taken)' : ''}
                  </button>
                )
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="lobby-controls" style={{ textAlign: 'center' }}>
          <h3>Game Setup (Phase 4 Pending)</h3>
          <p>The game has started. Waiting for the board to generate...</p>
        </div>
      )}
      
      <div className="team-panel-container">
        <div className="cn-team-box team-red">
          <h3>Red Team</h3>
          <ul className="cn-team-list">
            {redPlayers.map(renderPlayer)}
            {redPlayers.length === 0 && <li className="empty-slot">Empty</li>}
          </ul>
        </div>
        
        <div className="cn-team-box team-blue">
          <h3>Blue Team</h3>
          <ul className="cn-team-list">
            {bluePlayers.map(renderPlayer)}
            {bluePlayers.length === 0 && <li className="empty-slot">Empty</li>}
          </ul>
        </div>
      </div>

      {unassignedPlayers.length > 0 && (
        <div className="cn-team-box" style={{ borderTopColor: 'var(--cn-neutral-base)' }}>
          <h3 style={{ color: 'var(--cn-text-muted)' }}>Unassigned ({unassignedPlayers.length})</h3>
          <ul className="cn-team-list">
            {unassignedPlayers.map(renderPlayer)}
          </ul>
        </div>
      )}
      
      <div className="lobby-actions">
        {isHost && room.status === 'LOBBY' && (
          <button 
            className="cn-btn primary" 
            onClick={handleStartGame} 
            disabled={!canStart}
          >
            Start Game
          </button>
        )}
        <button className="cn-btn danger" onClick={onLeave}>Leave Game</button>
      </div>

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
