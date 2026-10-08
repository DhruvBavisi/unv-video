import React from 'react'
import CodenamesCard from './CodenamesCard'

export default function CodenamesBoard({ room }) {
  const board = room.board
  if (!board || board.length !== 25) {
    return <div className="codenames-board-empty">Waiting for board...</div>
  }

  // Calculate scores (unrevealed cards for each team)
  // Since Operatives don't have the category key for unrevealed cards, we need the server to send remaining scores.
  // Wait, if Phase 4 doesn't have scoring implemented yet, we just show placeholders or 0s for now,
  // or we don't calculate them. The prompt says "Do not implement future clue/guess mechanics yet."
  
  return (
    <div className="codenames-board-container">
      {/* Foundational game header structure */}
      <div className="cn-game-header">
        <div className="cn-team-score-panel red">
          <span className="cn-team-name">Red Team</span>
          <span className="cn-team-score">9</span>
        </div>
        
        <div className={`cn-game-status-banner ${room.currentTeam || 'blue'}`}>
          {room.currentTeam ? `${room.currentTeam}'s Turn` : "Game Started"}
        </div>
        
        <div className="cn-team-score-panel blue">
          <span className="cn-team-name">Blue Team</span>
          <span className="cn-team-score">8</span>
        </div>
      </div>

      <div className="codenames-board">
        {board.map(card => (
          <CodenamesCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
