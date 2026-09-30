import React, { useState, useEffect, useRef } from 'react'
import { connectSocket, getSocket } from '../game/socket.js'
import { ensureIdentity, readIdentity, clearSession } from '../game/identity.js'
import Lobby from './components/Lobby.jsx'
import DrawingPhase from './components/DrawingPhase.jsx'

function SkribblError({ message }) {
  if (!message) return null
  return (
    <div style={{
      background: 'var(--sk-coral)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '12px',
      textAlign: 'center',
      fontFamily: 'var(--sk-font-body)',
      fontWeight: 'bold',
      fontSize: '0.9rem',
      marginBottom: '20px',
      animation: 'skFadeIn 300ms ease forwards'
    }}>
      {message}
    </div>
  )
}

function getFriendlyError(errCode) {
  const map = {
    'ROOM_NOT_FOUND': "We couldn't find that room.",
    'NAME_TAKEN': "That name is already being used.",
    'ROOM_FULL': "This room is full.",
    'ALREADY_IN_DRAW_ROOM': "You're already in a game.",
    'INVALID_NAME': "Enter a name to continue."
  }
  return map[errCode] || errCode || 'Something went wrong.'
}

function SkribblPhaseShell({ phase, onLeave }) {
  return (
    <div className="sk-view">
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>
      <div className="sk-header">
        <h1 className="sk-logo">SKRIBBL</h1>
        <p className="sk-tagline" style={{ transform: 'none', color: 'var(--sk-primary)' }}>PHASE: {phase}</p>
      </div>
      <div className="sk-container" style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        <div className="sk-card" style={{ width: '100%', textAlign: 'center' }}>
          <h2 className="sk-card-title" style={{ justifyContent: 'center' }}>GAME IN PROGRESS</h2>
          <p style={{ color: 'var(--sk-muted)', marginBottom: '24px' }}>This phase is coming in the next update!</p>
          <button className="sk-btn" onClick={onLeave}>LEAVE ROOM</button>
        </div>
      </div>
    </div>
  )
}

function SkribblScreenTransition({ view, children }) {
  // Simple re-mount animation
  return (
    <div key={view} style={{ animation: 'skFadeIn 300ms ease forwards', width: '100%' }}>
      {children}
    </div>
  )
}

export default function SkribblApp({ onExit }) {
  const [roomState, setRoomState] = useState(null)
  const [error, setError] = useState(null)
  const [view, setView] = useState(() => {
    const { resumeToken, roomId, gameMode } = readIdentity()
    return (resumeToken && roomId && gameMode === 'skribbl') ? 'restoring' : 'menu'
  })

  useEffect(() => {
    const { sessionId } = ensureIdentity()
    const socket = connectSocket(sessionId)

    const handleRoomState = (state) => {
      setRoomState(state)
      setView('lobby')
    }

    const handleError = (err) => {
      setError(getFriendlyError(err.error || err.message))
      setView(prev => prev === 'restoring' ? 'menu' : prev)
    }

    const handleNoRoom = () => {
      clearSession()
      setView(prev => (prev === 'restoring' || prev === 'lobby') ? 'menu' : prev)
    }

    const handleExpired = () => {
      clearSession()
      setView(prev => (prev === 'restoring' || prev === 'lobby') ? 'menu' : prev)
    }

    const handleSessionToken = ({ resumeToken, roomId, playerName, gameMode }) => {
      if (gameMode !== 'skribbl') return
      import('../game/identity.js').then(({ setResumeToken }) => {
        setResumeToken(resumeToken, roomId, playerName, 'skribbl')
      })
    }

    socket.on('draw:room-state', handleRoomState)
    socket.on('draw:error', handleError)
    socket.on('session-no-room', handleNoRoom)
    socket.on('session-expired', handleExpired)
    socket.on('session-token', handleSessionToken)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      socket.off('draw:room-state', handleRoomState)
      socket.off('draw:error', handleError)
      socket.off('session-no-room', handleNoRoom)
      socket.off('session-expired', handleExpired)
      socket.off('session-token', handleSessionToken)
    }
  }, [])
  const handleCreateRoom = (playerName) => {
    const { sessionId } = ensureIdentity()
    const socket = getSocket()
    socket.emit('draw:create-room', { sessionId, playerName }, (res) => {
      if (res.error) setError(getFriendlyError(res.error))
      else if (res.room) {
        setRoomState(res.room)
        setView('lobby')
      }
    })
  }

  const handleJoinRoom = (roomId, playerName) => {
    const { sessionId } = ensureIdentity()
    const socket = getSocket()
    socket.emit('draw:join-room', { sessionId, roomId, playerName }, (res) => {
      if (res.error) setError(getFriendlyError(res.error))
      else if (res.room) {
        setRoomState(res.room)
        setView('lobby')
      }
    })
  }

  const handleLeaveRoom = () => {
    const socket = getSocket()
    socket.emit('draw:leave-room', (res) => {
      if (res && res.error) {
        setError(getFriendlyError(res.error))
      } else {
        clearSession()
        setRoomState(null)
        setView('menu')
      }
    })
  }

  const handleUpdateConfig = (config) => {
    const socket = getSocket()
    socket.emit('draw:update-config', config)
  }

  if (view === 'lobby' && roomState) {
    if (roomState.phase === 'LOBBY') {
      return (
        <Lobby 
          room={roomState} 
          onLeave={handleLeaveRoom}
          onUpdateConfig={handleUpdateConfig}
        />
      )
    }
    if (['WORD_CHOICE', 'DRAWING', 'ROUND_REVEAL', 'GAME_RESULT'].includes(roomState.phase)) {
      return <DrawingPhase room={roomState} onLeave={handleLeaveRoom} />
    }
    return <SkribblPhaseShell phase={roomState.phase} onLeave={handleLeaveRoom} />
  }

  // ENTRY EXPERIENCE
  return (
    <div className="sk-view">
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>
      
      <div className="sk-header">
        <h1 className="sk-logo">SKRIBBL</h1>
        <p className="sk-tagline">DRAW IT. GUESS IT. HAVE FUN.</p>
      </div>

      <div className="sk-container">
        <SkribblError message={error} />

        <SkribblScreenTransition view={view}>
          {view === 'restoring' && (
            <div style={{ textAlign: 'center', marginTop: '40px' }}>
              <h2 className="sk-card-title" style={{ justifyContent: 'center' }}>RESTORING SESSION...</h2>
              <div className="restore-spinner" aria-label="Loading" style={{ margin: '20px auto' }} />
              <p style={{ color: 'var(--sk-muted)' }}>Recovering your Skribbl session. Please wait.</p>
            </div>
          )}

          {view === 'menu' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <svg width="120" height="120" viewBox="0 0 100 100" style={{ opacity: 0.8 }}>
                  <circle cx="50" cy="50" r="40" fill="var(--sk-canvas)" stroke="var(--sk-muted)" strokeWidth="4" strokeDasharray="10 6" />
                  <path d="M35,45 Q40,35 45,45 T55,45 T65,45" fill="none" stroke="var(--sk-primary)" strokeWidth="4" strokeLinecap="round" />
                  <circle cx="40" cy="40" r="4" fill="var(--sk-text)" />
                  <circle cx="60" cy="40" r="4" fill="var(--sk-text)" />
                  <path d="M40,65 Q50,75 60,65" fill="none" stroke="var(--sk-coral)" strokeWidth="5" strokeLinecap="round" />
                </svg>
              </div>
              
              <button className="sk-btn" onClick={() => { setError(null); setView('create') }}>
                CREATE ROOM
              </button>
              <button className="sk-btn sk-btn--secondary" onClick={() => { setError(null); setView('join') }}>
                JOIN ROOM
              </button>
              <div style={{ textAlign: 'center', marginTop: '24px' }}>
                <button 
                  onClick={onExit} 
                  style={{ background: 'none', border: 'none', color: 'var(--sk-muted)', fontFamily: 'var(--sk-font-body)', fontWeight: 700, fontSize: '0.95rem', padding: '10px', textDecoration: 'underline', cursor: 'pointer' }}
                >
                  Back to Game Modes
                </button>
              </div>
            </div>
          )}

          {view === 'create' && (
            <div className="sk-card">
              <h2 className="sk-card-title">YOUR NAME</h2>
              <input 
                type="text" 
                id="sk-create-name" 
                placeholder="Enter your name" 
                className="sk-input"
                autoFocus
                maxLength={24}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button className="sk-btn sk-btn--secondary" style={{ flex: 1, padding: '16px 12px' }} onClick={() => { setError(null); setView('menu') }}>
                  CANCEL
                </button>
                <button className="sk-btn" style={{ flex: 1.5, padding: '16px 12px' }} onClick={() => {
                  const name = document.getElementById('sk-create-name').value
                  if (name) handleCreateRoom(name)
                  else setError(getFriendlyError('INVALID_NAME'))
                }}>
                  CREATE
                </button>
              </div>
            </div>
          )}

          {view === 'join' && (
            <div className="sk-card">
              <h2 className="sk-card-title">JOIN GAME</h2>
              <input 
                type="text" 
                id="sk-join-id" 
                placeholder="ROOM CODE" 
                className="sk-input"
                autoFocus
                maxLength={6}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
              />
              <input 
                type="text" 
                id="sk-join-name" 
                placeholder="YOUR NAME" 
                className="sk-input"
                maxLength={24}
                style={{ marginTop: '12px' }}
              />
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button className="sk-btn sk-btn--secondary" style={{ flex: 1, padding: '16px 12px' }} onClick={() => { setError(null); setView('menu') }}>
                  CANCEL
                </button>
                <button className="sk-btn" style={{ flex: 1.5, padding: '16px 12px' }} onClick={() => {
                  const name = document.getElementById('sk-join-name').value
                  const roomId = document.getElementById('sk-join-id').value
                  if (name && roomId) handleJoinRoom(roomId, name)
                  else setError(getFriendlyError('INVALID_NAME'))
                }}>
                  JOIN
                </button>
              </div>
            </div>
          )}
        </SkribblScreenTransition>
      </div>
    </div>
  )
}
