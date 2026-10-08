import React from 'react'
import { connectSocket } from '../../game/socket.js'

export default function CodenamesLobby({ room, playerId, onStart, onLeave }) {
  const isHost = room.hostId === playerId
  
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

  const getJoinUrl = () => {
    const origin = window.location.origin
    return `${origin}/?mode=codenames&room=${room.id}`
  }

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getJoinUrl())
    }
  }

  return (
    <div className="codenames-lobby" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center', marginTop: '2rem' }}>
      <h2>Lobby</h2>
      <div style={{ padding: '10px', background: '#eee', borderRadius: '4px', color: '#333' }}>
        <p style={{ margin: 0 }}>Room Code: <strong>{room.id}</strong></p>
        <button onClick={handleCopyUrl} style={{ marginTop: '5px', fontSize: '0.9rem', cursor: 'pointer' }}>Copy Link</button>
      </div>
      
      <div className="players-list" style={{ width: '100%', maxWidth: '400px', border: '1px solid #ccc', padding: '10px' }}>
        <h3>Players ({room.players.length})</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {room.players.map(p => (
            <li key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #eee' }}>
              <span style={{ opacity: p.isConnected ? 1 : 0.5 }}>
                {p.name} {p.id === room.hostId && '(Host)'} {!p.isConnected && '(Offline)'} {p.id === playerId && '(You)'}
              </span>
              {isHost && p.id !== playerId && (
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button onClick={() => handleMakeHost(p.id)} style={{ fontSize: '0.8rem', cursor: 'pointer' }}>Make Host</button>
                  <button onClick={() => handleKick(p.id)} style={{ fontSize: '0.8rem', color: 'red', cursor: 'pointer' }}>Kick</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        {isHost && (
          <button onClick={onStart} disabled style={{ padding: '10px 20px', background: '#333', color: '#fff', border: 'none', opacity: 0.5, cursor: 'not-allowed' }}>
            Start Game (Phase 3)
          </button>
        )}
        <button onClick={onLeave} style={{ padding: '10px 20px', cursor: 'pointer' }}>Leave Game</button>
      </div>
    </div>
  )
}
