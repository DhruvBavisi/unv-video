import React from 'react'
import { getAvatarColorClass } from './Lobby.jsx'

export default function PlayerStrip({ room, currentDrawerId, sessionId }) {
  // Sort players by score descending to determine ranks without mutating original array
  const sortedPlayers = [...(room.players || [])].sort((a, b) => (b.score || 0) - (a.score || 0))
  
  // Create a rank map (handling ties with competition ranking: 1, 2, 2, 4)
  const rankMap = {}
  let currentRank = 1
  for (let i = 0; i < sortedPlayers.length; i++) {
    if (i > 0 && sortedPlayers[i].score < sortedPlayers[i - 1].score) {
      currentRank = i + 1
    }
    rankMap[sortedPlayers[i].id] = currentRank
  }

  const guessedIds = room.guessedPlayerIds || []

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
        const isGuessed = guessedIds.includes(p.id)
        
        return (
          <div key={p.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px',
            padding: '2px 4px',
            opacity: p.isConnected ? 1 : 0.5,
            borderBottom: '1px solid rgba(0,0,0,0.05)',
            background: isGuessed ? 'rgba(85, 214, 176, 0.25)' : (isCurrent ? 'rgba(97, 116, 244, 0.1)' : 'transparent')
          }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--sk-muted)', width: '16px', flexShrink: 0, textAlign: 'center' }}>
              #{rankMap[p.id] || 1}
            </div>
            <div className={`sk-avatar ${getAvatarColorClass(p.id)}`} style={{ 
              width: '24px', height: '24px', fontSize: '0.8rem', flexShrink: 0,
              border: isDrawer ? '2px solid var(--sk-primary)' : 'none' 
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', lineHeight: '1.1' }}>
              <div style={{ fontSize: '0.75rem', fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: 'var(--sk-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name} {isDrawer && <span style={{ fontSize: '10px', marginLeft: '2px' }}>✏️</span>}
              </div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--sk-font-body)', color: 'var(--sk-muted)', fontWeight: 700 }}>
                {p.score} pts
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
