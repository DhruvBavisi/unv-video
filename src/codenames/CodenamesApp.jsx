import React, { useEffect, useState } from 'react'
import { connectSocket } from '../game/socket.js'
import { readIdentity, ensureIdentity, clearSession } from '../game/identity.js'
import './styles/codenames.css'
import CodenamesLobby from './components/CodenamesLobby.jsx'
import CodenamesBoard from './components/CodenamesBoard.jsx'

export default function CodenamesApp({ onExit }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  const [phase, setPhase] = useState('SETUP') // SETUP, CREATE, JOIN
  const [playerName, setPlayerName] = useState('')
  const [joinRoomId, setJoinRoomId] = useState('')

  const { sessionId } = ensureIdentity()
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    if (urlRoom) {
      setJoinRoomId(urlRoom)
      setPhase('JOIN')
    }
  }, [])

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

  const handleCreate = (e) => {
    e.preventDefault()
    if (!playerName.trim()) return
    const socket = connectSocket(sessionId)
    socket.emit('codenames:create-room', { sessionId, playerName: playerName.trim() }, (res) => {
      if (res && res.error) setError(res.error)
    })
  }

  const handleJoin = (e) => {
    e.preventDefault()
    if (!playerName.trim() || !joinRoomId.trim()) return
    const socket = connectSocket(sessionId)
    socket.emit('codenames:join-room', { sessionId, playerName: playerName.trim(), roomId: joinRoomId.trim().toUpperCase() }, (res) => {
      if (res && res.error) setError(res.error)
    })
  }

  if (error) {
    return (
      <div className="codenames-app">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => {
          setError(null)
          if (!room) setPhase('SETUP')
        }}>Back</button>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="codenames-app codenames-setup">
        <div className="codenames-header">
          <h1>CODENAMES</h1>
        </div>
        {phase === 'SETUP' && (
          <div className="codenames-setup-actions" style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '2rem' }}>
            <button onClick={() => setPhase('CREATE')} style={{ padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer' }}>Create Room</button>
            <button onClick={() => setPhase('JOIN')} style={{ padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer' }}>Join Room</button>
            <button onClick={onExit} style={{ padding: '10px 20px', fontSize: '1.2rem', cursor: 'pointer' }}>Back to Menu</button>
          </div>
        )}
        {phase === 'CREATE' && (
          <form className="codenames-setup-form" onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '2rem' }}>
            <h2>Create Room</h2>
            <input 
              placeholder="Your Name" 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              autoFocus 
              maxLength={24}
              style={{ padding: '10px', fontSize: '1.2rem', textAlign: 'center' }}
            />
            <div className="codenames-setup-form-actions" style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setPhase('SETUP')} style={{ padding: '10px', cursor: 'pointer' }}>Back</button>
              <button type="submit" disabled={!playerName.trim()} style={{ padding: '10px', cursor: 'pointer' }}>Create</button>
            </div>
          </form>
        )}
        {phase === 'JOIN' && (
          <form className="codenames-setup-form" onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginTop: '2rem' }}>
            <h2>Join Room</h2>
            <input 
              placeholder="Your Name" 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              autoFocus 
              maxLength={24}
              style={{ padding: '10px', fontSize: '1.2rem', textAlign: 'center' }}
            />
            <input 
              placeholder="Room ID" 
              value={joinRoomId} 
              onChange={e => setJoinRoomId(e.target.value.toUpperCase())} 
              maxLength={6}
              style={{ padding: '10px', fontSize: '1.2rem', textAlign: 'center' }}
            />
            <div className="codenames-setup-form-actions" style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={() => setPhase('SETUP')} style={{ padding: '10px', cursor: 'pointer' }}>Back</button>
              <button type="submit" disabled={!playerName.trim() || !joinRoomId.trim()} style={{ padding: '10px', cursor: 'pointer' }}>Join</button>
            </div>
          </form>
        )}
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
          onStart={() => {}} // not implemented in phase 2
        />
      ) : (
        <CodenamesBoard board={room.board} />
      )}
    </div>
  )
}
