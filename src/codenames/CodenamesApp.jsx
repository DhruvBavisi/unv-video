import React, { useEffect, useState } from 'react'
import { connectSocket } from '../game/socket.js'
import { readIdentity, ensureIdentity, clearSession } from '../game/identity.js'
import './styles/codenames.css'
import CodenamesLobby from './components/CodenamesLobby.jsx'
import CodenamesBoard from './components/CodenamesBoard.jsx'

export default function CodenamesApp({ onExit }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)

  const { sessionId } = ensureIdentity()
  
  useEffect(() => {
    const socket = connectSocket(sessionId)

    const handleRoomState = (state) => {
      setRoom(state)
    }

    const handleError = (msg) => {
      setError(msg)
    }

    const handleClosed = () => {
      clearSession()
      onExit()
    }

    socket.on('codenames:room-state', handleRoomState)
    socket.on('codenames:error', handleError)
    socket.on('room-closed', handleClosed)

    if (!socket.connected) {
      socket.connect()
    }

    // Join or create flow (simplified for Phase 1)
    const { roomId } = readIdentity()
    if (roomId) {
      socket.emit('codenames:join-room', { roomId })
    } else {
      socket.emit('codenames:create-room')
    }

    return () => {
      socket.off('codenames:room-state', handleRoomState)
      socket.off('codenames:error', handleError)
      socket.off('room-closed', handleClosed)
    }
  }, [sessionId, onExit])

  const handleLeave = () => {
    const socket = connectSocket(sessionId)
    socket.emit('codenames:leave-room')
    clearSession()
    onExit()
  }

  if (error) {
    return (
      <div className="codenames-app">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={handleLeave}>Back</button>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="codenames-app">
        <p>Connecting...</p>
      </div>
    )
  }

  return (
    <div className="codenames-app">
      <div className="codenames-header">
        <h1>CODENAMES</h1>
      </div>
      
      {room.status === 'LOBBY' ? (
        <CodenamesLobby 
          room={room} 
          playerId={sessionId}
          onLeave={handleLeave} 
          onStart={() => {}} // not implemented in phase 1
        />
      ) : (
        <CodenamesBoard board={room.board} />
      )}
    </div>
  )
}
