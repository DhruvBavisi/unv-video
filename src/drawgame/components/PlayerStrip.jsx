import React from 'react'
import { getAvatarColorClass } from './Lobby.jsx'

export default function PlayerStrip({ room, currentDrawerId }) {
  return (
    <div style={{ 
      display: 'flex', 
      overflowX: 'auto', 
      gap: '12px', 
      padding: '12px 16px', 
      background: 'rgba(255, 255, 255, 0.5)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid rgba(255,255,255,0.8)',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      zIndex: 10
    }}>
      {room.players.map(p => {
        const isDrawer = p.id === currentDrawerId
        return (
          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '60px', opacity: p.isConnected ? 1 : 0.5 }}>
            <div className={`sk-avatar ${getAvatarColorClass(p.id)}`} style={{ width: '40px', height: '40px', fontSize: '1.2rem', marginBottom: '4px', margin: '0 0 4px 0', border: isDrawer ? '3px solid var(--sk-primary)' : 'none' }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: 'var(--sk-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '60px', textAlign: 'center' }}>
              {p.name}
            </div>
            <div style={{ fontSize: '0.65rem', fontFamily: 'var(--sk-font-body)', color: 'var(--sk-muted)', fontWeight: 700 }}>
              {p.score} pt
            </div>
          </div>
        )
      })}
    </div>
  )
}
