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
import { readIdentity } from './game/identity.js'

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

function getInitialGameView() {
  const { resumeToken, roomId, gameMode } = readIdentity()
  if (resumeToken && roomId) {
    if (gameMode === 'skribbl') return 'skribbl'
    if (gameMode === 'undercover') return 'undercover'
    // fallback for old sessions
    return 'undercover' 
  }
  
  const params = new URLSearchParams(window.location.search)
  if (params.get('room')) {
    // We don't necessarily know the mode if joining via URL yet, 
    // but the original logic assumed undercover. We'll leave it as undercover for now,
    // or maybe landing? Wait, if they have a URL parameter, the actual game view 
    // probably handles the joining. We'll keep it as 'undercover' for backward compatibility.
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
