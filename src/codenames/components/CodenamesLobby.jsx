import React from 'react'

export default function CodenamesLobby({ room, playerId, onStart, onLeave }) {
  const isHost = room.hostId === playerId
  
  return (
    <div className="codenames-lobby">
      <h2>Lobby</h2>
      <p>Room Code: <strong>{room.roomId}</strong></p>
      
      <div className="team-panel">
        <div className="team-box team-red">
          <h3>Red Team</h3>
          {room.teams?.red?.length === 0 ? <p>Empty</p> : null}
          {room.teams?.red?.map(p => <div key={p.id}>{p.name}</div>)}
        </div>
        <div className="team-box team-blue">
          <h3>Blue Team</h3>
          {room.teams?.blue?.length === 0 ? <p>Empty</p> : null}
          {room.teams?.blue?.map(p => <div key={p.id}>{p.name}</div>)}
        </div>
      </div>
      
      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        {isHost && (
          <button onClick={onStart} style={{ padding: '10px', background: '#333', color: '#fff', border: 'none', cursor: 'pointer' }}>
            Start Game
          </button>
        )}
        <button onClick={onLeave} style={{ padding: '10px' }}>Leave Game</button>
      </div>
    </div>
  )
}
