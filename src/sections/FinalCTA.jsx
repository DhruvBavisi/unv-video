import Button from '../components/Button.jsx'

export default function FinalCTA({ onPlay }) {
  return (
    <section className="final" id="play" aria-label="Play UNDERCOVER">
      <div className="section-inner">
        <p className="final__header">Classified File // Case 001</p>

        <h2 className="final__title">Undercover</h2>
        <p className="final__subtitle">Who can you trust?</p>

        <div className="final__actions">
          <Button type="button" variant="primary" onClick={onPlay}>
            Play Now
          </Button>
          <Button as="a" href="#discover" variant="ghost">
            Discover the Game
          </Button>
        </div>

        <footer className="final__footer">
          <p className="final__footer-note">
            Case <span>001</span> — Confidential
          </p>
          <nav className="final__footer-links" aria-label="Footer">
            <a href="#game">Game</a>
            <a href="#how-to-play">How to Play</a>
            <a href="#characters">Characters</a>
          </nav>
          <p className="final__footer-note">UNDERCOVER © {new Date().getFullYear()}</p>
        </footer>
      </div>
    </section>
  )
}
