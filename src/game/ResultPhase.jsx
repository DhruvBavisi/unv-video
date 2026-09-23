import Button from '../components/Button.jsx'

export default function ResultPhase({ state, dispatch }) {
  const { winner, hostId, sessionId } = state
  const isHost = hostId === sessionId
  
  return (
    <section className="online-panel">
      <span className="online-kicker">Game Over</span>
      <h2 style={{ fontSize: '1.8rem', color: winner === 'MR_WHITE' ? 'var(--danger)' : 'var(--accent)', marginBottom: '8px' }}>
        {winner === 'MR_WHITE' ? 'MR. WHITE WINS' : 'Investigation Concluded'}
      </h2>
      <p style={{ color: 'var(--text-secondary)' }}>
        {winner === 'MR_WHITE' 
          ? 'MR. WHITE GUESSED CORRECTLY'
          : 'The results are in.'}
      </p>
      
      <div className="online-actions" style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isHost ? (
           <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Return to lobby to play again (Feature pending).</p>
        ) : (
           <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Waiting for host...</p>
        )}
        <Button variant="danger" onClick={() => dispatch({ type: 'LEAVE_ROOM' })}>
          Leave Room
        </Button>
      </div>
    </section>
  )
}
