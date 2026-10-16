import React, { useState, useEffect, useRef } from 'react'
import { connectSocket, getSocket } from '../game/socket.js'
import { ensureIdentity, readIdentity, clearSession, setResumeToken } from '../game/identity.js'
import Lobby from './components/Lobby.jsx'
import DrawingPhase from './components/DrawingPhase.jsx'
import QRScannerModal from '../game/QRScannerModal.jsx'
import SkribblNetworkStatus from './components/SkribblNetworkStatus.jsx'

import SkribblError from './components/SkribblError.jsx'
export { SkribblError }

export function getFriendlyError(errCode) {
  const map = {
    'ROOM_NOT_FOUND': "We couldn't find that room.",
    'NAME_TAKEN': "That name is already being used.",
    'ROOM_FULL': "This room is full.",
    'ALREADY_IN_DRAW_ROOM': "You're already in a game.",
    'INVALID_NAME': "Enter a name to continue.",
    'NO_SESSION': "Your connection session expired. Please reconnect.",
    'GAME_ALREADY_STARTED': "The game has already started.",
    'NOT_ENOUGH_PLAYERS': "At least 2 players are required to start.",
    'NO_WORDS_AVAILABLE': "No unused words are available for this game.",
    'START_GAME_FAILED': "The game could not be started. Please reconnect and try again.",
    'KICKED_FROM_ROOM': "You have been kicked from this room.",
    'NOT_HOST': "Only the host can kick players.",
    'TARGET_NOT_FOUND': "That player is no longer in the room.",
    'PLAYER_NOT_FOUND': "Player not found.",
    'CANNOT_TARGET_SELF': "You cannot kick yourself.",
    'CANNOT_KICK_HOST': "The host cannot be kicked.",
    'INVALID_TARGET': "Invalid player selected."
  }
  return map[errCode] || errCode || 'Something went wrong.'
}

function SkribblPhaseShell({ phase, onLeave, error }) {
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
        <SkribblError message={error} />
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

import { useMobileKeyboardFocus } from '../hooks/useMobileKeyboardFocus.js'
import { usePageBackground } from '../hooks/usePageBackground.js'
import { getSkribblActiveComponent, shouldRenderIndividualLobby } from './skribblRouting.js'

export { getSkribblActiveComponent, shouldRenderIndividualLobby }

export default function SkribblApp({ onExit }) {
  usePageBackground('#EEF5FF')
  const [roomState, setRoomState] = useState(null)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(() => {
    const socket = getSocket()
    if (socket?.connected) return 'Connected'
    return 'Connecting'
  })
  const connectPromiseRef = useRef(null)
  const createNameRef = useRef(null)
  const joinIdRef = useRef(null)
  const joinNameRef = useRef(null)

  useMobileKeyboardFocus(createNameRef)
  useMobileKeyboardFocus(joinIdRef)
  useMobileKeyboardFocus(joinNameRef)

  const [showScanner, setShowScanner] = useState(false)

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const urlRoom = params.get('room')
    const urlMode = params.get('mode')
    
    const { resumeToken, roomId, gameMode } = readIdentity()
    
    if (urlRoom && urlRoom.toUpperCase() !== (roomId || '').toUpperCase()) {
      if (urlMode === 'skribbl') return 'join'
    }

    if (resumeToken && roomId && gameMode === 'skribbl') return 'restoring'
    
    if (urlMode === 'skribbl' && urlRoom) return 'join'
    return 'menu'
  })

  const clearSkribblSession = () => {
    const id = readIdentity()
    if (id.gameMode === 'skribbl') {
      clearSession()
    }
  }

  const updateRoomStateSafe = (nextState) => {
    if (!nextState) return
    setRoomState(prev => {
      if (!prev) return nextState
      if (prev.id === nextState.id) {
        const prevVer = prev.version || 0
        const nextVer = nextState.version || 0
        if (nextVer < prevVer) {
          return prev
        }
        if (nextVer === prevVer && prev.updatedAt && nextState.updatedAt && nextState.updatedAt < prev.updatedAt) {
          return prev
        }

        // Preserve local player's opt-in during GAME_RESULT transition if an intermediate update is missing it
        const { sessionId } = ensureIdentity()
        const prevMe = prev.players?.find(p => p.id === sessionId)
        const nextMe = nextState.players?.find(p => p.id === sessionId)
        if (prev.phase === 'GAME_RESULT' && nextState.phase === 'GAME_RESULT' && prevMe?.playAgain && nextMe && !nextMe.playAgain) {
          return {
            ...nextState,
            players: nextState.players.map(p => p.id === sessionId ? { ...p, playAgain: true } : p)
          }
        }
      }
      return nextState
    })
  }

  useEffect(() => {
    const { sessionId } = ensureIdentity()
    const socket = connectSocket(sessionId)

    if (socket.connected) {
      setConnectionStatus('Connected')
    } else {
      setConnectionStatus('Connecting')
    }

    const handleRoomState = (state) => {
      if (!state || !state.id) return
      const identity = readIdentity()
      const currentSessionId = identity.sessionId || sessionId
      const storedRoomId = (identity.roomId || '').toUpperCase()
      const incomingRoomId = (state.id || '').toUpperCase()

      const inPlayers = state.players?.some(p => p.id === currentSessionId || p.id === sessionId)
      const inRecords = state.playerRecords && (state.playerRecords[currentSessionId] || state.playerRecords[sessionId])
      const isExpectedRoom = (roomState && roomState.id.toUpperCase() === incomingRoomId) || 
                             (storedRoomId && storedRoomId === incomingRoomId)

      // Only discard if there is no indication whatsoever that this update is for this client
      if (!inPlayers && !inRecords && !isExpectedRoom) {
        return
      }

      updateRoomStateSafe(state)
      setError(null)
      setView('lobby')
    }

    const handleConnect = () => {
      setConnectionStatus('Connected')
      setError((prev) => (
        prev === 'Unable to connect to the game server. Please try again.' ||
        prev === 'Connection lost. Reconnecting...'
      ) ? null : prev)
    }

    const handleError = (err) => {
      setError(getFriendlyError(err?.error || err?.message || err))
      setView(prev => prev === 'restoring' ? 'menu' : prev)
    }

    const handleConnectError = () => {
      const isAttempting = socket.active || Boolean(socket.io?._reconnecting)
      if (isAttempting) {
        setConnectionStatus('Connecting')
      } else {
        setConnectionStatus('Disconnected')
      }
      setError('Unable to connect to the game server. Please try again.')
      setView(prev => prev === 'restoring' ? 'menu' : prev)
    }

    const handleDisconnect = (reason) => {
      if (reason === 'io client disconnect') {
        setConnectionStatus('Disconnected')
      } else {
        setConnectionStatus('Connecting')
        setError('Connection lost. Reconnecting...')
      }
    }

    const handleReconnectAttempt = () => {
      setConnectionStatus('Connecting')
    }

    const handleReconnectError = () => {
      const isAttempting = socket.active || Boolean(socket.io?._reconnecting)
      if (isAttempting) {
        setConnectionStatus('Connecting')
      } else {
        setConnectionStatus('Disconnected')
      }
    }

    const handleReconnectFailed = () => {
      setConnectionStatus('Disconnected')
    }

    const handleNoRoom = () => {
      clearSkribblSession()
      setRoomState(null)
      setView(prev => {
        if (prev === 'restoring') {
          setError('The previous room is no longer available.')
          return 'menu'
        }
        return prev
      })
    }

    const handleExpired = () => {
      clearSkribblSession()
      setRoomState(null)
      setView(prev => {
        if (prev === 'restoring') {
          setError('Your previous session has expired.')
          return 'menu'
        }
        return prev
      })
    }

    const handleRoomClosed = (data) => {
      clearSkribblSession()
      setRoomState(null)
      setError(data?.message || 'Room closed.')
      setView('menu')
    }

    const handleSessionToken = ({ resumeToken, roomId, playerName, gameMode }) => {
      if (gameMode !== 'skribbl') return
      setResumeToken(resumeToken, roomId, playerName, 'skribbl')
    }

    const handleKicked = () => {
      clearSkribblSession()
      setRoomState(null)
      setError('You have been kicked from the room.')
      setView('menu')
    }

    const handleChatMessage = (message) => {
      if (!message?.id) return

      setRoomState(prev => {
        if (!prev) return prev

        const messages = prev.chatMessages || []
        if (messages.some(item => item.id === message.id)) return prev

        return {
          ...prev,
          chatMessages: [...messages, message].slice(-100)
        }
      })
    }

    socket.on('draw:room-state', handleRoomState)
    socket.on('draw:chat-message', handleChatMessage)
    socket.on('draw:error', handleError)
    socket.on('draw:kicked', handleKicked)
    socket.on('room-closed', handleRoomClosed)
    socket.on('connect', handleConnect)
    socket.on('connect_error', handleConnectError)
    socket.on('disconnect', handleDisconnect)
    socket.io?.on('reconnect_attempt', handleReconnectAttempt)
    socket.io?.on('reconnect_error', handleReconnectError)
    socket.io?.on('reconnect_failed', handleReconnectFailed)
    socket.on('session-no-room', handleNoRoom)
    socket.on('session-expired', handleExpired)
    socket.on('session-token', handleSessionToken)

    if (!socket.connected) {
      setConnectionStatus('Connecting')
      socket.connect()
    }

    return () => {
      socket.off('draw:room-state', handleRoomState)
      socket.off('draw:chat-message', handleChatMessage)
      socket.off('draw:error', handleError)
      socket.off('draw:kicked', handleKicked)
      socket.off('room-closed', handleRoomClosed)
      socket.off('connect', handleConnect)
      socket.off('connect_error', handleConnectError)
      socket.off('disconnect', handleDisconnect)
      socket.io?.off('reconnect_attempt', handleReconnectAttempt)
      socket.io?.off('reconnect_error', handleReconnectError)
      socket.io?.off('reconnect_failed', handleReconnectFailed)
      socket.off('session-no-room', handleNoRoom)
      socket.off('session-expired', handleExpired)
      socket.off('session-token', handleSessionToken)
    }
  }, [])

  useEffect(() => {
    if (view === 'restoring') {
      const identity = readIdentity()
      if (identity.resumeToken && identity.roomId && identity.gameMode === 'skribbl') {
        const socket = getSocket() || connectSocket(identity.sessionId)
        if (socket?.connected) {
          socket.emit('register', {
            sessionId: identity.sessionId,
            resumeToken: identity.resumeToken,
            roomId: identity.roomId
          })
        }
      } else {
        setView('menu')
      }
    }
  }, [])

  useEffect(() => {
    if (view === 'restoring') {
      const timer = setTimeout(() => {
        setView(prev => {
          if (prev === 'restoring') {
            clearSkribblSession()
            setError('Could not restore previous session. Please create or join a room.')
            return 'menu'
          }
          return prev
        })
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [view])

  const ensureSocketConnected = async () => {
    const socket = getSocket()
    if (!socket) throw new Error('SOCKET_UNAVAILABLE')
    if (socket.connected) return socket

    if (!connectPromiseRef.current) {
      connectPromiseRef.current = new Promise((resolve, reject) => {
        let timeoutId = null

        const cleanup = () => {
          socket.off('connect', onConnect)
          socket.off('connect_error', onConnectError)
          if (timeoutId) clearTimeout(timeoutId)
        }

        const onConnect = () => {
          cleanup()
          resolve(socket)
        }

        const onConnectError = () => {
          cleanup()
          reject(new Error('CONNECT_ERROR'))
        }

        timeoutId = setTimeout(() => {
          cleanup()
          reject(new Error('CONNECT_TIMEOUT'))
        }, 10000)

        socket.on('connect', onConnect)
        socket.on('connect_error', onConnectError)
        if (!socket.connected) socket.connect()
      }).finally(() => {
        connectPromiseRef.current = null
      })
    }

    return connectPromiseRef.current
  }

  const handleCreateRoom = async (playerName) => {
    const { sessionId } = ensureIdentity()
    let socket
    try {
      socket = await ensureSocketConnected()
    } catch {
      setError('Unable to connect to the game server. Please try again.')
      return
    }
    socket.emit('draw:create-room', { sessionId, playerName }, (res) => {
      if (res?.error) setError(getFriendlyError(res.error))
      else if (res?.room) {
        setError(null)
        updateRoomStateSafe(res.room)
        setView('lobby')
      }
    })
  }

  const handleJoinRoom = async (roomId, playerName) => {
    const { sessionId, resumeToken } = ensureIdentity()
    let socket
    try {
      socket = await ensureSocketConnected()
    } catch {
      setError('Unable to connect to the game server. Please try again.')
      return
    }
    socket.emit('draw:join-room', { sessionId, resumeToken, roomId, playerName }, (res) => {
      if (res?.error) {
        setError(getFriendlyError(res.error))
      } else if (res?.room) {
        setError(null)
        updateRoomStateSafe(res.room)
        setView('lobby')
      }
    })
  }

  const handleLeaveRoom = () => {
    const finish = (() => {
      let done = false
      return () => {
        if (done) return
        done = true
        clearSkribblSession()
        setRoomState(null)
        setView('menu')
      }
    })()

    const socket = getSocket()
    if (!socket) { finish(); return }

    // If the server never answers (offline / reconnecting), leave locally anyway after 3s
    const fallback = setTimeout(finish, 3000)
    socket.emit('draw:leave-room', (res) => {
      clearTimeout(fallback)
      if (res && res.error && res.error !== 'NOT_IN_ROOM') {
        setError(getFriendlyError(res.error)) // shown on the menu screen
      }
      finish()
    })
  }

  const handleUpdateConfig = (config) => {
    const socket = getSocket()
    socket.emit('draw:update-config', config)
  }

  const isInGame = Boolean(
    view === 'lobby' &&
    roomState &&
    ['WORD_CHOICE', 'DRAWING', 'ROUND_REVEAL', 'GAME_RESULT'].includes(roomState.phase)
  )

  const networkStatusElement = (
    <SkribblNetworkStatus status={connectionStatus} inGame={isInGame} />
  )

  if (view === 'lobby' && roomState) {
    const { sessionId } = ensureIdentity()
    const activeComponent = getSkribblActiveComponent(view, roomState, sessionId)

    if (activeComponent === 'LOBBY') {
      return (
        <>
          {networkStatusElement}
          <Lobby 
            room={roomState} 
            onLeave={handleLeaveRoom}
            onUpdateConfig={handleUpdateConfig}
            error={error}
          />
        </>
      )
    }
    if (activeComponent === 'DRAWING_PHASE') {
      return (
        <DrawingPhase 
          room={roomState} 
          onLeave={handleLeaveRoom} 
          onUpdateConfig={handleUpdateConfig}
          error={error} 
          connectionStatus={connectionStatus}
        />
      )
    }
    return (
      <>
        {networkStatusElement}
        <SkribblPhaseShell phase={roomState.phase} onLeave={handleLeaveRoom} error={error} />
      </>
    )
  }

  // ENTRY EXPERIENCE
  return (
    <>
      {networkStatusElement}
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
              <button 
                className="sk-btn sk-btn--secondary" 
                onClick={() => {
                  clearSkribblSession()
                  setError(null)
                  setView('menu')
                }}
                style={{ marginTop: '20px', maxWidth: '200px', marginInline: 'auto' }}
              >
                CANCEL
              </button>
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
                ref={createNameRef}
                type="text" 
                id="sk-create-name" 
                name="name"
                placeholder="Enter your name" 
                className="sk-input"
                autoFocus
                maxLength={24}
                autoComplete="name"
                autoCapitalize="words"
                autoCorrect="on"
                spellCheck={true}
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
              <div className="sk-join-input-wrapper">
                <input 
                  ref={joinIdRef}
                  type="text" 
                  id="sk-join-id" 
                  name="roomCode"
                  placeholder="ROOM CODE" 
                  className="sk-input"
                  autoFocus
                  maxLength={6}
                  defaultValue={new URLSearchParams(window.location.search).get('room') || ''}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="sk-join-qr-icon"
                  title="Scan QR Code"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6H4z" /><path d="M14 14h6v6h-6z" /></svg>
                </button>
              </div>
              <input 
                ref={joinNameRef}
                type="text" 
                id="sk-join-name" 
                name="name"
                placeholder="YOUR NAME" 
                className="sk-input"
                maxLength={24}
                style={{ marginTop: '12px' }}
                autoComplete="name"
                autoCapitalize="words"
                autoCorrect="on"
                spellCheck={true}
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
        
        {showScanner && (
          <QRScannerModal 
            onClose={(focus) => {
              setShowScanner(false)
              if (focus && joinIdRef.current) joinIdRef.current.focus()
            }}
            onScan={(code) => {
              if (joinIdRef.current) {
                joinIdRef.current.value = code
              }
            }}
            expectedMode="skribbl"
          />
        )}
      </div>
    </div>
  </>
)
}
