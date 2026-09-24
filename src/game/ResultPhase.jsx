import Button from '../components/Button.jsx'

export default function ResultPhase({ state, dispatch, onPlayAgain }) {
  const { winner, hostId, sessionId, players } = state
  const isHost = hostId === sessionId
  const me = players?.find(p => p.id === sessionId)
  const hasAcked = me?.playAgain
  
  let title = 'Investigation Concluded'
  let subtitle = 'The results are in.'
  let color = 'var(--accent)'

  if (winner === 'MR_WHITE') {
    title = 'MR. WHITE WINS'
    subtitle = 'MR. WHITE GUESSED CORRECTLY'
    color = 'var(--danger)'
  } else if (winner === 'UNDERCOVER') {
    title = 'UNDERCOVER WINS'
    subtitle = 'THE UNDERCOVER EVADED CAPTURE'
    color = 'var(--danger)'
  } else if (winner === 'BOTH_IMPOSTERS') {
    title = 'IMPOSTERS WIN'
    subtitle = 'THE CIVILIANS WERE DEFEATED'
    color = 'var(--danger)'
  } else if (winner === 'CIVILIAN') {
    title = 'CIVILIANS WIN'
    subtitle = 'ALL THREATS ELIMINATED'
    color = 'var(--accent)'
  }

  return (
    <section className="online-panel">
      <span className="online-kicker">Game Over</span>
      <h2 style={{ fontSize: '1.8rem', color: color, marginBottom: '8px' }}>
        {title}
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        {subtitle}
      </p>
      
      <div className="online-actions" style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Button onClick={onPlayAgain} disabled={hasAcked}>
          {hasAcked ? 'Waiting for others...' : 'Play Again'}
        </Button>
        <Button variant="danger" onClick={() => dispatch({ type: 'LEAVE_ROOM' })}>
          Leave Room
        </Button>
      </div>
    </section>
  )
}
