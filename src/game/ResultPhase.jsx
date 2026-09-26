import React, { useRef, useLayoutEffect } from 'react'
import Button from '../components/Button.jsx'
import gsap from 'gsap'
import { getRoleImage } from './roleImages.js'

export default function ResultPhase({ state, dispatch, onPlayAgain }) {
  const { winner, hostId, sessionId, players, wordPair } = state
  const me = players?.find(p => p.id === sessionId)
  const hasAcked = me?.playAgain
  const containerRef = useRef(null)

  let title = 'CIVILIANS WIN'
  let subtitle = 'All threats were identified and eliminated.'
  let color = '#4ade80'
  let borderColor = '#4ade80'
  let avatarBoxShadow = '0 4px 12px rgba(0,0,0,0.3)'
  
  const mrWhiteSurvived = players.some(p => p.role === 'MR_WHITE' && !p.eliminated)

  if (winner === 'MR_WHITE') {
    title = 'MR. WHITE WINS'
    subtitle = 'Mr. White correctly identified the civilian word.'
    color = '#FFFFFF'
    borderColor = '#D3D3D3'
    avatarBoxShadow = '0 4px 12px #D3D3D3'
  } else if (winner === 'UNDERCOVER') {
    title = 'UNDERCOVER WINS'
    subtitle = 'The Undercover evaded capture.'
    color = '#9E3A3A'
    borderColor = '#9E3A3A'
  } else if (winner === 'BOTH_IMPOSTERS') {
    title = 'IMPOSTERS WIN'
    subtitle = 'The Civilians were defeated.'
    color = '#9E3A3A'
    borderColor = '#9E3A3A'
  } else if (winner === 'CIVILIAN') {
    title = 'CIVILIANS WIN'
    subtitle = 'All threats eliminated.'
    color = '#4ade80'
    borderColor = '#4ade80'
  }

  const winnerImageRole = winner === 'BOTH_IMPOSTERS' ? 'UNDERCOVER' : winner

  useLayoutEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      
      if (prefersReduced) {
        gsap.set('.anim-item', { opacity: 1, y: 0 })
        return
      }

      gsap.set('.anim-item', { opacity: 0, y: 15 })
      
      tl.to('.anim-header', { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' })
      tl.to('.anim-word', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, '-=0.3')
      tl.to('.anim-role', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.1 }, '-=0.2')
      tl.to('.anim-action', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.1')

    }, containerRef)
    return () => ctx.revert()
  }, [])

  const gamePlayers = players.filter(p => !p.spectator || p.eliminated || p.role)

  const getRoleColor = (role) => {
    if (role === 'CIVILIAN') return '#6a8c6f' // muted emerald
    if (role === 'UNDERCOVER') return '#9E3A3A' // muted crimson
    if (role === 'MR_WHITE') return '#b5b0a1' // ivory grey
    return 'var(--text-secondary)'
  }

  return (
    <section className="online-panel" ref={containerRef} style={{ width: '100%', maxWidth: '900px', padding: '24px 16px', margin: '0 auto' }}>
      
      <div className="result-header anim-item anim-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
        <span className="online-kicker">Game Over</span>
        
        {winner && (
          <img 
            src={getRoleImage(winnerImageRole)} 
            alt="Winner" 
            style={{ 
              width: '100px', 
              height: '100px', 
              borderRadius: '50%', 
              objectFit: 'cover', 
              margin: '12px auto', 
              display: 'block', 
              border: `4px solid ${borderColor}`, 
              boxShadow: avatarBoxShadow 
            }} 
          />
        )}

        <h2 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-display)', color: color, marginBottom: '4px', letterSpacing: '0.05em' }}>
          {title}
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', margin: 0 }}>
          {subtitle}
        </p>
        {winner === 'CIVILIAN' && mrWhiteSurvived && (
          <p style={{ color: '#9E3A3A', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '6px' }}>
            MR. WHITE SURVIVED
          </p>
        )}
      </div>

      {wordPair && (
        <div className="anim-item anim-word">
          <div className="result-section-title" style={{ marginBottom: '12px' }}>Word Pair</div>
          <div className="result-words">
            <div className="result-word-card" style={{ backgroundColor: 'rgba(74, 222, 128, 0.15)', borderColor: 'rgba(74, 222, 128, 0.4)' }}>
              <div className="result-word-label" style={{ color: '#4ade80' }}>Civilian</div>
              <div className="result-word-value" style={{ color: '#ffffff' }}>{wordPair.civilianWord}</div>
            </div>
            <div className="result-word-card" style={{ backgroundColor: '#2A1718', borderColor: '#6F2C2F' }}>
              <div className="result-word-label" style={{ color: '#9E3A3A' }}>Undercover</div>
              <div className="result-word-value" style={{ color: '#ffffff' }}>{wordPair.undercoverWord}</div>
            </div>
          </div>
        </div>
      )}

      {state.specialRoleOutcomes && state.specialRoleOutcomes.length > 0 && (
        <div className="anim-item anim-role" style={{ marginBottom: '32px' }}>
          <div className="result-section-title" style={{ marginBottom: '12px' }}>Special Role Outcomes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {state.specialRoleOutcomes.map((outcome, idx) => (
              <div key={idx} style={{ 
                background: 'linear-gradient(145deg, rgba(30, 32, 40, 0.7), rgba(20, 22, 28, 0.6))',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '6px',
                padding: '12px 16px',
                color: '#d4af37',
                fontSize: '0.95rem',
                letterSpacing: '0.03em',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.2)',
                whiteSpace: 'pre-wrap'
              }}>
                {outcome.message}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="anim-item anim-role" style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px', paddingBottom: '8px' }}>
          <div className="result-section-title" style={{ margin: 0 }}>Investigators</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '100%', margin: '0 auto' }}>
          {gamePlayers.map((p, index) => {
            const roleName = p.role ? p.role.replace('_', ' ') : 'UNKNOWN'
            const roleColor = getRoleColor(p.role)
            const numStr = (index + 1).toString().padStart(2, '0')
            return (
              <div key={p.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                padding: '12px 16px', 
                background: 'rgba(35, 35, 35, 0.32)',
                borderRadius: '4px', 
                borderLeft: p.eliminated ? '2px solid #6F2C2F' : '2px solid transparent',
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', marginRight: '8px' }}>
                  <span style={{ fontFamily: 'monospace', opacity: 0.8 }}>{numStr}</span>
                  <span style={{ margin: '0 12px', opacity: 0.3 }}>│</span>
                </div>
                
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                  <span style={{ 
                    fontWeight: '500', 
                    fontSize: '1.05rem', 
                    color: 'var(--text-primary)', 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis' 
                  }}>
                    {p.name}
                  </span>
                  <span style={{ 
                    color: roleColor, 
                    fontSize: '0.7rem', 
                    fontFamily: "'Bebas Neue', 'Oswald', sans-serif",
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase'
                  }}>
                    {roleName}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  {p.points > 0 && (
                    <div style={{ fontSize: '0.8rem', color: '#d4af37', fontWeight: 'bold' }}>
                      {p.points} PTS
                    </div>
                  )}
                  {p.eliminated && (
                    <div style={{ fontSize: '0.7rem', color: '#9E3A3A', fontWeight: 'bold', marginLeft: '12px' }}>
                      ELIMINATED
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="result-actions anim-item anim-action">
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
