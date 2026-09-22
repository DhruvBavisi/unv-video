import Button from './Button.jsx'

const NAV_LINKS = [
  { label: 'GAME', href: '#game' },
  { label: 'HOW TO PLAY', href: '#how-to-play' },
  { label: 'CHARACTERS', href: '#characters' },
]

export default function Navbar({ onPlay }) {
  return (
    <header className="nav">
      <div className="nav__inner">
        <a href="#" className="nav__brand" aria-label="UNDERCOVER — home">
          <span className="nav__brand-name">UNDERCOVER</span>
          <span className="nav__brand-sub">Classified File</span>
        </a>

        <nav className="nav__links" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className="nav__link">
              {link.label}
            </a>
          ))}
        </nav>

        <Button type="button" variant="primary" onClick={onPlay}>
          Play Now
        </Button>
      </div>
    </header>
  )
}
