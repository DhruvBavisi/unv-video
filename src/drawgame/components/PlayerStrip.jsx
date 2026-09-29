import React from 'react'
import { getAvatarColorClass } from './Lobby.jsx'

export default function PlayerStrip({ room, currentDrawerId, sessionId }) {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      overflowY: 'auto', 
      height: '100%',
      width: '100%',
      background: 'rgba(255, 255, 255, 0.5)',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      {room.players.map(p => {
        const isDrawer = p.id === currentDrawerId
        const isCurrent = p.id === sessionId
        return (
          <div key={p.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 12px',
            opacity: p.isConnected ? 1 : 0.5,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            background: isCurrent ? 'rgba(97, 116, 244, 0.1)' : 'transparent'
          }}>
            <div className={`sk-avatar ${getAvatarColorClass(p.id)}`} style={{ 
              width: '36px', height: '36px', fontSize: '1.1rem', flexShrink: 0,
              border: isDrawer ? '2px solid var(--sk-primary)' : 'none' 
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ fontSize: '0.85rem', fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: 'var(--sk-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name} {isDrawer && <span style={{ fontSize: '12px' }}>✏️</span>}
              </div>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--sk-font-body)', color: 'var(--sk-muted)', fontWeight: 700 }}>
                {p.score} pts
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
