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
      background: 'white',
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none'
    }}>
      {room.players.map((p, i) => {
        const isDrawer = p.id === currentDrawerId
        const isCurrent = p.id === sessionId
        const isGuessed = guessedIds.includes(p.id)
        
        const baseBg = i % 2 === 0 ? '#FFFFFF' : '#f1f1f1ff'
        const bg = isGuessed ? '#CFFFBD' : baseBg

        return (
          <div key={p.id} style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '10px 6px',
            minHeight: '36px',
            opacity: p.isConnected ? 1 : 0.5,
            background: bg
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'black', width: '24px', flexShrink: 0, textAlign: 'center' }}>
              #{rankMap[p.id] || 1}
            </div>
            <div className={`sk-avatar ${getAvatarColorClass(p.id)}`} style={{ 
              width: '28px', height: '28px', fontSize: '0.9rem', flexShrink: 0, borderRadius: '50%',
              border: isDrawer ? '2px solid var(--sk-primary)' : '1px solid rgba(0,0,0,0.1)',
              boxShadow: 'none'
            }}>
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', lineHeight: '1.1' }}>
              <div style={{ fontSize: '0.8rem', fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: isCurrent ? '#3366cc' : 'black', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name} {isCurrent} {isDrawer && <span style={{ fontSize: '10px', marginLeft: '2px' }}>✏️</span>}
              </div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--sk-font-body)', color: '#333333', fontWeight: 600 }}>
                {p.score} points
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
