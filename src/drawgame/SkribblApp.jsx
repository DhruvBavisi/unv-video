import React, { useState, useEffect } from 'react'
import { connectSocket, getSocket } from '../game/socket.js'
import { ensureIdentity } from '../game/identity.js'
import Lobby from './components/Lobby.jsx'

export default function SkribblApp({ onExit }) {
  const [roomState, setRoomState] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const { sessionId } = ensureIdentity()
    const socket = connectSocket(sessionId)

    socket.on('draw:room-state', (state) => {
      setRoomState(state)
    })

    socket.on('draw:error', (err) => {
      setError(err.message || 'An error occurred')
    })

    return () => {
      socket.off('draw:room-state')
      socket.off('draw:error')
    }
  }, [])

  const handleCreateRoom = (playerName) => {
    const { sessionId } = ensureIdentity()
    const socket = getSocket()
    socket.emit('draw:create-room', { sessionId, playerName }, (res) => {
      if (res.error) setError(res.error)
      else if (res.room) setRoomState(res.room)
    })
  }

  const handleJoinRoom = (roomId, playerName) => {
    const { sessionId } = ensureIdentity()
    const socket = getSocket()
    socket.emit('draw:join-room', { sessionId, roomId, playerName }, (res) => {
      if (res.error) setError(res.error)
      else if (res.room) setRoomState(res.room)
    })
  }

  const handleLeaveRoom = () => {
    const socket = getSocket()
    socket.emit('draw:leave-room', () => {
      setRoomState(null)
    })
  }

  const handleUpdateConfig = (config) => {
    const socket = getSocket()
    socket.emit('draw:update-config', config)
  }

  // Very basic landing for skribbl if no roomState
  if (!roomState) {
    return (
      <div className="skribbl-landing">
        <div className="section-inner" style={{ paddingTop: '100px' }}>
          <h1 className="mode-select__title">SKRIBBL</h1>
          {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="mode-select__cards" style={{ flexDirection: 'column' }}>
            <div className="mode-select__card" style={{ width: '100%' }}>
              <h2>CREATE ROOM</h2>
              <input type="text" id="skribbl-create-name" placeholder="Your Name" className="skribbl-input" />
              <button className="btn btn--primary" onClick={() => {
                const name = document.getElementById('skribbl-create-name').value
                if (name) handleCreateRoom(name)
              }}>CREATE</button>
            </div>
            <div className="mode-select__card" style={{ width: '100%' }}>
              <h2>JOIN ROOM</h2>
              <input type="text" id="skribbl-join-name" placeholder="Your Name" className="skribbl-input" />
              <input type="text" id="skribbl-join-id" placeholder="Room ID" className="skribbl-input" />
              <button className="btn btn--primary" onClick={() => {
                const name = document.getElementById('skribbl-join-name').value
                const roomId = document.getElementById('skribbl-join-id').value
                if (name && roomId) handleJoinRoom(roomId, name)
              }}>JOIN</button>
            </div>
          </div>
          <button className="btn btn--ghost" onClick={onExit} style={{ marginTop: '20px' }}>BACK TO MODE SELECT</button>
        </div>
      </div>
    )
  }

  if (roomState.phase === 'LOBBY') {
    return (
      <Lobby 
        room={roomState} 
        onLeave={handleLeaveRoom}
        onUpdateConfig={handleUpdateConfig}
      />
    )
  }

  // Placeholder for other phases
  return (
    <div className="skribbl-game">
      <div className="section-inner" style={{ paddingTop: '100px' }}>
        <h1>SKRIBBL PHASE: {roomState.phase}</h1>
        <button className="btn btn--ghost" onClick={handleLeaveRoom}>LEAVE ROOM</button>
      </div>
    </div>
  )
}
