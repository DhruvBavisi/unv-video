import React from 'react'
import { connectSocket } from '../../game/socket.js'

export default function CodenamesLobby({ room, playerId, onLeave }) {
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
                   room.spymasters?.red &&
                   room.spymasters?.blue &&
                   unassignedPlayers.length === 0

  const renderPlayer = (p) => {
    const isMe = p.id === playerId
    const roleLabel = p.role === 'SPYMASTER' ? '[Spymaster]' : (p.role === 'OPERATIVE' ? '[Operative]' : '')
    
    return (
      <li key={p.id} className={`player-item ${isMe ? 'player-me' : ''}`}>
        <span style={{ opacity: p.isConnected ? 1 : 0.5 }}>
          {p.name} {p.id === room.hostId && '(Host)'} {!p.isConnected && '(Offline)'} {roleLabel}
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
      <h2>Lobby</h2>
      <div className="lobby-room-code">
        <p style={{ margin: 0 }}>Room Code: <strong>{room.id}</strong></p>
        <button onClick={handleCopyUrl} style={{ marginTop: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>Copy Link</button>
      </div>

      <div className="lobby-controls">
        <div className="control-group">
          <h3>Team</h3>
          <button className={player.team === 'red' ? 'active red' : ''} onClick={() => handleSelectTeam('red')}>Red Team</button>
          <button className={player.team === 'blue' ? 'active blue' : ''} onClick={() => handleSelectTeam('blue')}>Blue Team</button>
          <button className={!player.team ? 'active' : ''} onClick={() => handleSelectTeam(null)}>Unassigned</button>
        </div>

        {player.team && (
          <div className="control-group">
            <h3>Role</h3>
            <button 
              className={player.role === 'OPERATIVE' ? 'active' : ''} 
              onClick={() => handleSelectRole('OPERATIVE')}
            >
              Operative
            </button>
            <button 
              className={player.role === 'SPYMASTER' ? 'active' : ''} 
              onClick={() => handleSelectRole('SPYMASTER')}
              disabled={room.spymasters && room.spymasters[player.team] && room.spymasters[player.team] !== playerId}
            >
              Spymaster {room.spymasters && room.spymasters[player.team] && room.spymasters[player.team] !== playerId ? '(Taken)' : ''}
            </button>
          </div>
        )}
      </div>
      
      <div className="team-panel">
        <div className="team-box team-red">
          <h3>Red Team</h3>
          <ul className="team-list">
            {redPlayers.map(renderPlayer)}
            {redPlayers.length === 0 && <li className="empty-slot">Empty</li>}
          </ul>
        </div>
        
        <div className="team-box team-blue">
          <h3>Blue Team</h3>
          <ul className="team-list">
            {bluePlayers.map(renderPlayer)}
            {bluePlayers.length === 0 && <li className="empty-slot">Empty</li>}
          </ul>
        </div>
      </div>

      {unassignedPlayers.length > 0 && (
        <div className="team-box team-unassigned">
          <h3>Unassigned ({unassignedPlayers.length})</h3>
          <ul className="team-list">
            {unassignedPlayers.map(renderPlayer)}
          </ul>
        </div>
      )}
      
      <div className="lobby-actions">
        {isHost && (
          <button 
            className="start-btn" 
            onClick={handleStartGame} 
            disabled={!canStart}
          >
            Start Game
          </button>
        )}
        <button onClick={onLeave} style={{ padding: '10px 20px', cursor: 'pointer' }}>Leave Game</button>
      </div>
    </div>
  )
}
