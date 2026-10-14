import React, { Component, useEffect, useState } from 'react'
import AssetTest from './asset-test/AssetTest.jsx'
import Navbar from './components/Navbar.jsx'
import Hero from './sections/Hero.jsx'
import CinematicSequence from './sections/CinematicSequence.jsx'
import Investigation from './sections/Investigation.jsx'
import FinalCTA from './sections/FinalCTA.jsx'
import OnlineGame from './game/OnlineGame.jsx'
import GameEntryTransition from './game/GameEntryTransition.jsx'
import ModeSelect from './components/ModeSelect.jsx'
import SkribblApp from './drawgame/SkribblApp.jsx'
import CodenamesApp from './codenames/CodenamesApp.jsx'
import { readIdentity, ensureIdentity, clearSession } from './game/identity.js'
import { connectSocket } from './game/socket.js'

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
  const [isAssetTest, setIsAssetTest] = useState(false)
  const [gameView, setGameView] = useState(getInitialGameView())

  useEffect(() => {
    const sync = () => setIsAssetTest(window.location.hash === '#asset-test')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  // Temporary Phase 1 asset-test page. Remove this branch and the import when done.
  if (isAssetTest) {
    return <AssetTest />
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
          onSelectUndercover={() => setGameView('undercover')}
          onSelectSkribbl={() => setGameView('skribbl')}
          onSelectCodenames={() => setGameView('codenames')}
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
      <Navbar onPlay={() => setGameView('transition')} />
      <main>
        <Hero onPlay={() => setGameView('transition')} />
        <Transition text="The truth is never simple" />
        <CinematicSequence />
        <Investigation />
        <FinalCTA onPlay={() => setGameView('transition')} />
      </main>
    </>
  )
}
