import { useEffect, useState } from 'react'
import AssetTest from './asset-test/AssetTest.jsx'
import Navbar from './components/Navbar.jsx'
import Hero from './sections/Hero.jsx'
import CinematicSequence from './sections/CinematicSequence.jsx'
import Investigation from './sections/Investigation.jsx'
import FinalCTA from './sections/FinalCTA.jsx'
import OnlineGame from './game/OnlineGame.jsx'
import GameEntryTransition from './game/GameEntryTransition.jsx'
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
  const { resumeToken, roomId } = readIdentity()
  if (resumeToken && roomId) {
    return 'game'
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
    return <GameEntryTransition onComplete={() => setGameView('game')} />
  }

  if (gameView === 'game') {
    return <OnlineGame onExit={() => setGameView('landing')} />
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
