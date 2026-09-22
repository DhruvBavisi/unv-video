import Button from '../components/Button.jsx'

const HERO_BACKDROP = '/images/investigation-room/hero-frame.png'

export default function Hero({ onPlay }) {
  return (
    <section className="hero" aria-label="UNDERCOVER — introduction">
      <div className="hero__backdrop">
        <img
          src={HERO_BACKDROP}
          alt="The investigation room with three characters around a table covered in confidential material"
        />
      </div>

      <div className="hero__content">
        <span className="hero__classified label">
          <span className="hero__classified-line" aria-hidden="true" />
          <span className="label--danger">Classified</span>
          <span>Case File</span>
        </span>

        <h1 className="hero__title">Undercover</h1>

        <p className="hero__tagline">Who can you trust?</p>

        <div className="hero__actions">
          <Button type="button" variant="primary" onClick={onPlay}>
            Play Now
          </Button>
          <Button as="a" href="#discover" variant="ghost">
            Discover the Game
          </Button>
        </div>
      </div>
    </section>
  )
}
