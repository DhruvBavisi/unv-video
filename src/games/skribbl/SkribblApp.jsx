import React, { useState, useEffect, useRef } from 'react'
import { connectSocket, getSocket } from '../../shared/realtime/socket.js'
import { ensureIdentity, readIdentity, clearSession, setResumeToken } from '../../shared/session/identity.js'
import Lobby from './components/Lobby.jsx'
import DrawingPhase from './components/DrawingPhase.jsx'
import QRScannerModal from '../../shared/components/QRScannerModal.jsx'
import SkribblNetworkStatus from './components/SkribblNetworkStatus.jsx'

import SkribblError from './components/SkribblError.jsx'
import SkribblHome from './components/SkribblHome.jsx'
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

import { useMobileKeyboardFocus } from '../../shared/hooks/useMobileKeyboardFocus.js'
import { usePageBackground } from '../../shared/hooks/usePageBackground.js'
import { getSkribblActiveComponent, shouldRenderIndividualLobby } from './skribblRouting.js'

export { getSkribblActiveComponent, shouldRenderIndividualLobby }

export default function SkribblApp({ onExit }) {
  const [roomState, setRoomState] = useState(null)
  const [error, setError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState(() => {
    const socket = getSocket()
    if (socket?.connected) return 'Connected'
    return 'Connecting'
  })
  const connectPromiseRef = useRef(null)

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

  // Dynamic status bar / page background: pure white (#ffffff) during main drawing game so safe area
  // blends seamlessly with the white DrawingTopBar; authentic dark blue (#0d3284) in menus & lobby.
  const activeComponent = (view === 'lobby' && roomState)
    ? getSkribblActiveComponent(view, roomState, readIdentity()?.sessionId)
    : view

  const isInGame = activeComponent === 'DRAWING_PHASE'
  const activePageBg = isInGame ? '#ffffff' : '#0d3284'
  usePageBackground(activePageBg)

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

  const handleCreateRoom = async (playerName, avatar) => {
    const { sessionId } = ensureIdentity()
    let socket
    try {
      socket = await ensureSocketConnected()
    } catch {
      setError('Unable to connect to the game server. Please try again.')
      return
    }
    socket.emit('draw:create-room', { sessionId, playerName, avatar }, (res) => {
      if (res?.error) setError(getFriendlyError(res.error))
      else if (res?.room) {
        setError(null)
        updateRoomStateSafe(res.room)
        setView('lobby')
      }
    })
  }

  const handleJoinRoom = async (roomId, playerName, avatar) => {
    const { sessionId, resumeToken } = ensureIdentity()
    let socket
    try {
      socket = await ensureSocketConnected()
    } catch {
      setError('Unable to connect to the game server. Please try again.')
      return
    }
    socket.emit('draw:join-room', { sessionId, resumeToken, roomId, playerName, avatar }, (res) => {
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

  const networkStatusElement = (
    <SkribblNetworkStatus status={connectionStatus} inGame={isInGame} />
  )

  if (view === 'lobby' && roomState) {
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
      {view === 'restoring' ? (
        <div className="sk-home-view">
          <div className="sk-home-card" style={{ textAlign: 'center', margin: '40px auto' }}>
            <h2 className="sk-card-title" style={{ justifyContent: 'center' }}>RESTORING SESSION...</h2>
            <div className="restore-spinner" aria-label="Loading" style={{ margin: '20px auto' }} />
            <p style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Recovering your Skribbl session. Please wait.</p>
            <button 
              className="sk-home-btn sk-home-btn--create" 
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
        </div>
      ) : (
        <SkribblHome
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onExit={onExit}
          error={error}
          clearError={() => setError(null)}
        />
      )}
    </>
  )
}
