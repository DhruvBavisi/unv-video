import React from 'react'
import { getSocket } from '../../game/socket.js'
import { ensureIdentity } from '../../game/identity.js'

export default function WordChoice({ room, onLeave }) {
  const { sessionId } = ensureIdentity()
  const isDrawer = room.currentDrawerId === sessionId

  const handleChoose = (word) => {
    const socket = getSocket()
    socket.emit('draw:choose-word', { word })
  }

  // Get drawer's name
  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'

  return (
    <div className="sk-view" style={{ justifyContent: 'center' }}>
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>

      <div className="sk-container" style={{ alignItems: 'center', textAlign: 'center' }}>
        {isDrawer ? (
          <div style={{ width: '100%', animation: 'skFadeIn 400ms ease forwards' }}>
            <h2 style={{ fontFamily: 'var(--sk-font-display)', color: 'var(--sk-text)', marginBottom: '8px', fontSize: '2rem' }}>YOUR TURN TO DRAW</h2>
            <p style={{ color: 'var(--sk-muted)', fontFamily: 'var(--sk-font-body)', marginBottom: '32px' }}>Choose a word</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(room.wordChoices || []).map((word, idx) => (
                <div 
                  key={idx}
                  className="sk-card"
                  style={{ 
                    cursor: 'pointer', 
                    padding: '24px', 
                    animationDelay: `${idx * 100}ms`,
                    animation: 'skCardEnter 400ms ease both',
                    transition: 'transform 150ms ease, box-shadow 150ms ease'
                  }}
                  onClick={() => handleChoose(word)}
                  onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                  onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                  onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  <div style={{ fontSize: '1.6rem', fontFamily: 'var(--sk-font-display)', color: 'var(--sk-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {word}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ width: '100%', animation: 'skFadeIn 400ms ease forwards' }}>
            <div className="sk-card">
              <svg width="80" height="80" viewBox="0 0 100 100" style={{ opacity: 0.8, margin: '0 auto 20px', display: 'block' }}>
                <circle cx="50" cy="50" r="40" fill="var(--sk-canvas)" stroke="var(--sk-muted)" strokeWidth="4" strokeDasharray="10 6" />
                <path d="M35,45 Q40,35 45,45 T55,45 T65,45" fill="none" stroke="var(--sk-primary)" strokeWidth="4" strokeLinecap="round" />
              </svg>
              <h2 style={{ fontFamily: 'var(--sk-font-display)', color: 'var(--sk-text)', fontSize: '1.6rem', marginBottom: '12px' }}>
                WAITING FOR DRAWER
              </h2>
              <p style={{ color: 'var(--sk-muted)', fontFamily: 'var(--sk-font-body)', fontSize: '1.1rem' }}>
                <strong style={{ color: 'var(--sk-primary)' }}>{drawerName}</strong> is choosing a word...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
