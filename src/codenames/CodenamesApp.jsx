import React, { useEffect, useState } from 'react'
import { connectSocket } from '../game/socket.js'
import { readIdentity, ensureIdentity, clearSession } from '../game/identity.js'
import './styles/codenames.css'
import CodenamesLobby from './components/CodenamesLobby.jsx'
import CodenamesBoard from './components/CodenamesBoard.jsx'

export default function CodenamesApp({ onExit }) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)
  const [existingRoomId, setExistingRoomId] = useState(null)
  const [phase, setPhase] = useState('SETUP') // SETUP, CREATE, JOIN
  const [playerName, setPlayerName] = useState(() => readIdentity().playerName || '')
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
      if (res && res.error) {
        setError(res.error)
        setExistingRoomId(res.roomId || null)
      }
    })
  }

  const handleJoin = (e) => {
    e.preventDefault()
    if (!playerName.trim() || !joinRoomId.trim()) return
    const socket = connectSocket(sessionId)
    const { resumeToken } = readIdentity()
    socket.emit('codenames:join-room', { sessionId, playerName: playerName.trim(), roomId: joinRoomId.trim().toUpperCase(), resumeToken }, (res) => {
      if (res && res.error) {
        setError(res.error)
        setExistingRoomId(res.roomId || null)
      }
    })
  }

  const handleJoinExisting = () => {
    const socket = connectSocket(sessionId)
    const { resumeToken } = readIdentity()
    socket.emit('codenames:join-room', { sessionId, playerName: playerName.trim(), roomId: existingRoomId, resumeToken }, (res) => {
      if (res && res.error) {
        setError(res.error)
        setExistingRoomId(res.roomId || null)
      } else {
        setError(null)
        setExistingRoomId(null)
      }
    })
  }

  if (error) {
    const isAlreadyInRoom = error === 'ALREADY_IN_ROOM' || error === 'ALREADY_IN_ANOTHER_ROOM'
    return (
      <div className="codenames-app codenames-setup">
        <div className="codenames-setup-actions" style={{ textAlign: 'center' }}>
          <h2>{isAlreadyInRoom ? 'ALREADY IN ROOM' : 'Error'}</h2>
          <p style={{ margin: '10px 0 20px', color: '#fff' }}>
            {isAlreadyInRoom ? 'You are already in a room.' : error}
          </p>
          {isAlreadyInRoom && existingRoomId && (
            <button className="cn-btn" onClick={handleJoinExisting} style={{ marginBottom: 15 }}>
              JOIN ROOM
            </button>
          )}
          <button className="cn-btn danger" onClick={() => {
            setError(null)
            setExistingRoomId(null)
            if (!room) setPhase('SETUP')
          }}>Back</button>
        </div>
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
          <div className="codenames-setup-actions">
            <button className="cn-btn" onClick={() => setPhase('CREATE')}>Create Room</button>
            <button className="cn-btn" onClick={() => setPhase('JOIN')}>Join Room</button>
            <button className="cn-btn danger" onClick={onExit}>Back to Menu</button>
          </div>
        )}
        {phase === 'CREATE' && (
          <form className="codenames-setup-form" onSubmit={handleCreate}>
            <h2>Create Room</h2>
            <input 
              className="codenames-input"
              placeholder="Your Name" 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              autoFocus 
              maxLength={24}
            />
            <div className="codenames-setup-form-actions">
              <button type="button" className="cn-btn" onClick={() => setPhase('SETUP')}>Back</button>
              <button type="submit" className="cn-btn primary" disabled={!playerName.trim()}>Create</button>
            </div>
          </form>
        )}
        {phase === 'JOIN' && (
          <form className="codenames-setup-form" onSubmit={handleJoin}>
            <h2>Join Room</h2>
            <input 
              className="codenames-input"
              placeholder="Your Name" 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)} 
              autoFocus 
              maxLength={24}
            />
            <input 
              className="codenames-input"
              placeholder="Room ID" 
              value={joinRoomId} 
              onChange={e => setJoinRoomId(e.target.value.toUpperCase())} 
              maxLength={6}
            />
            <div className="codenames-setup-form-actions">
              <button type="button" className="cn-btn" onClick={() => setPhase('SETUP')}>Back</button>
              <button type="submit" className="cn-btn primary" disabled={!playerName.trim() || !joinRoomId.trim()}>Join</button>
            </div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className={(room.status === 'LOBBY' || room.status === 'SETUP') ? 'codenames-app' : 'codenames-app codenames-app--game'}>
      {(room.status === 'LOBBY' || room.status === 'SETUP') ? (
        <CodenamesLobby 
          room={room} 
          playerId={sessionId}
          onLeave={handleLeave} 
        />
      ) : (
        <CodenamesBoard room={room} playerId={sessionId} onLeave={handleLeave} />
      )}
    </div>
  )
}
