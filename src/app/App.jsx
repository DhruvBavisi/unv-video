import React, { Component, useEffect, useState } from 'react'
import Navbar from '../landing/components/Navbar.jsx'
import Hero from '../landing/sections/Hero.jsx'
import CinematicSequence from '../landing/sections/CinematicSequence.jsx'
import Investigation from '../landing/sections/Investigation.jsx'
import FinalCTA from '../landing/sections/FinalCTA.jsx'
import OnlineGame from '../games/undercover/OnlineGame.jsx'
import GameEntryTransition from '../games/undercover/components/GameEntryTransition.jsx'
import ModeSelect from '../shared/components/ModeSelect.jsx'
import SkribblApp from '../games/skribbl/SkribblApp.jsx'
import CodenamesApp from '../games/codenames/CodenamesApp.jsx'
import SkribblWinningPreview from '../games/skribbl/components/SkribblWinningPreview.jsx'
import { readIdentity, ensureIdentity, clearSession } from '../shared/session/identity.js'
import ServerSkeletonScreen from '../shared/components/ServerSkeletonScreen.jsx'
import { connectSocket, isServerConnected, subscribeServerConnection, initBackgroundServerConnection, pingServerHealth } from '../shared/realtime/socket.js'
import { preloadSpecialRoles } from '../games/undercover/utils/preloadUndercoverAssets.js'

class GameErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GameErrorBoundary] Rendering failure caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0c0d',
          color: '#ffffff',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '12px', color: '#ff6f70' }}>
            Something went wrong
          </h2>
          <p style={{ maxWidth: '420px', color: '#a0a0a0', marginBottom: '24px', fontSize: '0.95rem', lineHeight: 1.5 }}>
            An unexpected error occurred while loading this view. You can return to mode selection or reload the page.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                background: '#6174f4',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Return to Mode Selection
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 20px',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload Page
            </button>
          </div>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: '24px',
              padding: '12px',
              background: 'rgba(255, 0, 0, 0.1)',
              border: '1px solid rgba(255, 0, 0, 0.3)',
              borderRadius: '6px',
              color: '#ff9999',
              fontSize: '0.8rem',
              maxWidth: '90vw',
              overflowX: 'auto',
              textAlign: 'left'
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

function Transition({ text }) {
  return (
    <div className="transition">
      <div className="section-inner">
        <div className="transition__inner">
          <span className="transition__line" aria-hidden="true" />
          <span className="transition__text">{text}</span>
          <span className="transition__line" aria-hidden="true" />
        </div>
      </div>
    </div>
  )
}

function SessionResolver({ onResolved }) {
  useEffect(() => {
    const { sessionId } = ensureIdentity()
    const socket = connectSocket(sessionId)

    const timer = setTimeout(() => {
      console.warn('[SessionResolver] timeout resolving session, returning to mode-select')
      clearSession()
      onResolved('mode-select')
    }, 5000)

    const handleSessionToken = ({ gameMode }) => {
      clearTimeout(timer)
      if (gameMode === 'skribbl') onResolved('skribbl')
      else if (gameMode === 'codenames') onResolved('codenames')
      else onResolved('undercover')
    }
    const handleExpiredOrNoRoom = () => {
      clearTimeout(timer)
      clearSession()
      onResolved('mode-select')
    }

    socket.on('session-token', handleSessionToken)
    socket.on('session-no-room', handleExpiredOrNoRoom)
    socket.on('session-expired', handleExpiredOrNoRoom)

    if (!socket.connected) {
      socket.connect()
    }

    return () => {
      clearTimeout(timer)
      socket.off('session-token', handleSessionToken)
      socket.off('session-no-room', handleExpiredOrNoRoom)
      socket.off('session-expired', handleExpiredOrNoRoom)
    }
  }, [onResolved])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', alignItems: 'center', justifyContent: 'center', background: '#0b0c0d', color: 'white', gap: '16px' }}>
      <div className="restore-spinner" aria-label="Loading" />
      <p style={{ color: 'var(--text-secondary)' }}>Resolving previous session...</p>
      <button
        style={{
          padding: '8px 16px',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white',
          borderRadius: '6px',
          cursor: 'pointer'
        }}
        onClick={() => {
          clearSession()
          onResolved('mode-select')
        }}
      >
        Cancel
      </button>
    </div>
  )
}

function getInitialGameView() {
  const params = new URLSearchParams(window.location.search)
  const room = params.get('room')
  const mode = params.get('mode')
  const preview = (params.get('preview') || params.get('view') || '').toLowerCase()
  const path = (window.location.pathname || '').toLowerCase()

  // Dev preview route for Skribbl winning page
  if (
    preview === 'skribbl-winning' ||
    preview === 'winning' ||
    mode === 'skribbl-winning' ||
    path.includes('/preview/skribbl-winning')
  ) {
    return 'skribbl-winning-preview'
  }

  const { resumeToken, roomId, gameMode } = readIdentity()

  if (room && room.toUpperCase() !== (roomId || '').toUpperCase()) {
    if (mode === 'skribbl') return 'skribbl'
    if (mode === 'codenames') return 'codenames'
    return 'undercover'
  }

  if (resumeToken && roomId) {
    if (gameMode === 'skribbl') return 'skribbl'
    if (gameMode === 'codenames') return 'codenames'
    if (gameMode === 'undercover') return 'undercover'
    return 'resolving-session' 
  }
  
  if (room) {
    if (mode === 'skribbl') return 'skribbl'
    if (mode === 'codenames') return 'codenames'
    return 'undercover'
  }
  
  return 'landing'
}

export default function App() {
  const [initialView] = useState(() => getInitialGameView())
  const [gameView, setGameView] = useState(initialView)
  const [isConnected, setIsConnected] = useState(() => isServerConnected())
  const [hasResolvedInitialConnection, setHasResolvedInitialConnection] = useState(() => {
    const init = getInitialGameView()
    // Dev preview bypasses server check
    return init === 'skribbl-winning-preview' || isServerConnected()
  })
  const [pendingDestination, setPendingDestination] = useState(null)

  // Start background connection to the server immediately on mount & warm Undercover assets
  useEffect(() => {
    const { sessionId } = ensureIdentity()
    initBackgroundServerConnection(sessionId)
    preloadSpecialRoles()

    const unsubscribe = subscribeServerConnection((connected) => {
      setIsConnected(connected)
    })

    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setGameView(getInitialGameView())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  // Intercept navigation to check if server is currently connecting
  const handleNavigateOrWait = (target) => {
    if (target === 'undercover') {
      preloadSpecialRoles()
    }
    // Proactively ping health and ensure socket connection is triggered
    pingServerHealth()
    const { sessionId } = ensureIdentity()
    const sock = connectSocket(sessionId)
    if (sock && !sock.connected) {
      sock.connect()
    }

    const connectedNow = isServerConnected()
    setIsConnected(connectedNow)

    if (!connectedNow) {
      setPendingDestination(target === 'transition' ? 'mode-select' : target)
      setHasResolvedInitialConnection(false)
    } else {
      setGameView(target)
    }
  }

  // Display high-polish skeleton loading screen whenever the server is connecting behind
  if (!hasResolvedInitialConnection && initialView !== 'skribbl-winning-preview') {
    return (
      <ServerSkeletonScreen
        initialView={pendingDestination || initialView}
        targetDestination={pendingDestination}
        onSelectDestination={setPendingDestination}
        isConnected={isConnected}
        onConnectRedirect={(destination) => {
          setHasResolvedInitialConnection(true)
          setPendingDestination(null)
          setGameView(destination)
        }}
      />
    )
  }

  if (gameView === 'skribbl-winning-preview') {
    return (
      <GameErrorBoundary onReset={() => {
        window.history.replaceState({}, '', window.location.pathname)
        setGameView('landing')
      }}>
        <SkribblWinningPreview onExit={() => {
          window.history.replaceState({}, '', window.location.pathname)
          setGameView('landing')
        }} />
      </GameErrorBoundary>
    )
  }

  if (gameView === 'transition') {
    return <GameEntryTransition onComplete={() => setGameView('mode-select')} />
  }

  if (gameView === 'resolving-session') {
    return (
      <GameErrorBoundary onReset={() => setGameView('mode-select')}>
        <SessionResolver onResolved={setGameView} />
      </GameErrorBoundary>
    )
  }

  if (gameView === 'mode-select') {
    return (
      <GameErrorBoundary onReset={() => setGameView('landing')}>
        <ModeSelect 
          onSelectUndercover={() => handleNavigateOrWait('undercover')}
          onSelectSkribbl={() => handleNavigateOrWait('skribbl')}
          onSelectCodenames={() => handleNavigateOrWait('codenames')}
          onBack={() => setGameView('landing')}
        />
      </GameErrorBoundary>
    )
  }

  if (gameView === 'undercover') {
    return (
      <GameErrorBoundary onReset={() => setGameView('mode-select')}>
        <OnlineGame onExit={() => setGameView('mode-select')} />
      </GameErrorBoundary>
    )
  }

  if (gameView === 'skribbl') {
    return (
      <GameErrorBoundary onReset={() => setGameView('mode-select')}>
        <SkribblApp onExit={() => setGameView('mode-select')} />
      </GameErrorBoundary>
    )
  }

  if (gameView === 'codenames') {
    return (
      <GameErrorBoundary onReset={() => setGameView('mode-select')}>
        <CodenamesApp onExit={() => setGameView('mode-select')} />
      </GameErrorBoundary>
    )
  }

  return (
    <>
      <Navbar onPlay={() => handleNavigateOrWait('transition')} />
      <main>
        <Hero onPlay={() => handleNavigateOrWait('transition')} />
        <Transition text="The truth is never simple" />
        <CinematicSequence />
        <Investigation />
        <FinalCTA onPlay={() => handleNavigateOrWait('transition')} />
      </main>
    </>
  )
}
