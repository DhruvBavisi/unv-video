import { useEffect, useState } from 'react'
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
import { readIdentity, ensureIdentity, clearSession } from './game/identity.js'
import { connectSocket } from './game/socket.js'

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

    const handleSessionToken = ({ gameMode }) => {
      onResolved(gameMode === 'skribbl' ? 'skribbl' : 'undercover')
    }
    const handleExpiredOrNoRoom = () => {
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
      socket.off('session-token', handleSessionToken)
      socket.off('session-no-room', handleExpiredOrNoRoom)
      socket.off('session-expired', handleExpiredOrNoRoom)
    }
  }, [onResolved])

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'black', color: 'white' }}>
      <p>Resolving session...</p>
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
    return 'undercover'
  }

  if (resumeToken && roomId) {
    if (gameMode === 'skribbl') return 'skribbl'
    if (gameMode === 'undercover') return 'undercover'
    return 'resolving-session' 
  }
  
  if (room) {
    if (mode === 'skribbl') return 'skribbl'
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
    return <SessionResolver onResolved={setGameView} />
  }

  if (gameView === 'mode-select') {
    return (
      <ModeSelect 
        onSelectUndercover={() => setGameView('undercover')}
        onSelectSkribbl={() => setGameView('skribbl')}
      />
    )
  }

  if (gameView === 'undercover') {
    return <OnlineGame onExit={() => setGameView('mode-select')} />
  }

  if (gameView === 'skribbl') {
    return <SkribblApp onExit={() => setGameView('mode-select')} />
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
