import { useState, useCallback } from 'react'
import Button from '../components/Button.jsx'
import { emitSubmitMrWhiteGuess } from './gameState.js'

export default function MrWhiteGuessPhase({ state, socketRef }) {
  const { sessionId, mrWhiteGuesserId, players } = state
  const isMe = sessionId === mrWhiteGuesserId
  const guesser = players.find(p => p.id === mrWhiteGuesserId)
  
  const [guess, setGuess] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!guess.trim() || submitting) return
    
    setSubmitting(true)
    setError('')
    
    const response = await emitSubmitMrWhiteGuess(socketRef.current, guess)
    if (!response?.success) {
      setError(response?.error || 'Failed to submit guess.')
      setSubmitting(false)
    }
  }, [guess, submitting, socketRef])

  if (!isMe) {
    return (
      <section className="online-panel">
        <span className="online-kicker">Elimination</span>
        <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Mr. White Found</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}><strong>{guesser?.name}</strong> was Mr. White!</p>
        <div style={{ padding: '24px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center', borderRadius: '4px' }}>
          <p className="online-joining" style={{ margin: 0 }}>Waiting for them to guess the Civilian word...</p>
        </div>
      </section>
    )
  }

  return (
    <section className="online-panel">
      <span className="online-kicker">Eliminated</span>
      <h2 style={{ fontSize: '1.8rem', color: 'var(--danger)', marginBottom: '8px' }}>MR. WHITE</h2>
      <p style={{ color: 'var(--text-secondary)' }}>You have one chance to guess the Civilian word.</p>
      
      <form onSubmit={handleSubmit} style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input 
          type="text" 
          placeholder="Enter the Civilian word..." 
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          disabled={submitting}
          maxLength="30"
          style={{ 
            padding: '16px', 
            fontSize: '1.1rem', 
            background: 'rgba(255,255,255,0.03)', 
            border: '1px solid rgba(255,255,255,0.15)', 
            color: 'white',
            borderRadius: '4px',
            fontFamily: 'var(--font-body)'
          }}
        />
        {error && <div className="clue-phase__error" role="alert">{error}</div>}
        <Button type="submit" variant="danger" disabled={!guess.trim() || submitting}>
          {submitting ? 'Checking...' : 'Submit Guess'}
        </Button>
      </form>
    </section>
  )
}
