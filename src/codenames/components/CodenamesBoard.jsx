import React from 'react'
import CodenamesCard from './CodenamesCard'
import { Settings, Undo2, Users } from 'lucide-react'

export default function CodenamesBoard({ room }) {
  const board = room.board
  if (!board || board.length !== 25) {
    return <div className="codenames-board-empty">Waiting for board...</div>
  }

  let blueScore = '-'
  let redScore = '-'
  if (board) {
    const canSeeHidden = board.some(c => c.category && !c.revealed)
    if (canSeeHidden) {
      blueScore = board.filter(c => c.category === 'blue' && !c.revealed).length
      redScore = board.filter(c => c.category === 'red' && !c.revealed).length
    } else if (room.startingTeam) {
      const totalBlue = room.startingTeam === 'blue' ? 9 : 8
      const totalRed = room.startingTeam === 'red' ? 9 : 8
      const revealedBlue = board.filter(c => c.revealed && c.category === 'blue').length
      const revealedRed = board.filter(c => c.revealed && c.category === 'red').length
      blueScore = totalBlue - revealedBlue
      redScore = totalRed - revealedRed
    }
  }
  
  const blueOpCount = room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE').length
  const redOpCount = room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE').length

  const blueSpymasters = room.players.filter(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redSpymasters = room.players.filter(p => p.team === 'red' && p.role === 'SPYMASTER')

  // Example status message based on state
  const statusMessage = room.phase === 'BOARD_READY' && blueSpymasters.length === 0 
    ? 'BLUE TEAM NEEDS A SPYMASTER' 
    : room.currentTeam ? `${room.currentTeam.toUpperCase()} TEAM'S TURN` : 'GAME STARTED'

  const renderAvatar = (p) => {
    return (
      <div key={p.id} className="cn-board-avatar">
        {p.id === room.hostId && <div className="cn-board-crown">👑</div>}
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}&backgroundColor=transparent`} alt="avatar" />
        <div className="cn-board-avatar-name">{p.name.substring(0, 5)}</div>
      </div>
    )
  }

  return (
    <div className="cn-game-page">
      {/* 1. TOP NAVIGATION */}
      <div className="cn-game-nav">
        <div className="cn-nav-left">
          <button className="cn-nav-btn players-btn">
            <Users size={16} />
            <span className="cn-players-badge">{room.players.length}</span>
          </button>
          <button className="cn-nav-btn undo-btn">
            <Undo2 size={16} />
          </button>
        </div>
        <div className="cn-nav-right">
          <button className="cn-nav-btn settings-btn">
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* 2. TEAM & GAME LOG AREA */}
      <div className="cn-game-info-row">
        {/* BLUE TEAM (LEFT) */}
        <div className="cn-team-col blue-col">
          <div className="cn-top-panel blue-panel">
            <div className="cn-panel-header">OPERATIVES</div>
            <div className="cn-panel-content">
              {room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE').map(renderAvatar)}
            </div>
          </div>
          <div className="cn-score-section blue-score">
            <div className="cn-score-number">{blueScore}</div>
            {/* If there's an active operative or something, render them here. For now just placeholder avatar logic if needed */}
          </div>
          <div className="cn-bottom-panel blue-spy">
            <div className="cn-panel-header">SPYMASTERS</div>
            <div className="cn-panel-content">
              {blueSpymasters.length > 0 ? blueSpymasters.map(renderAvatar) : (
                <button className="cn-spy-join-btn">JOIN TEAM</button>
              )}
            </div>
          </div>
        </div>

        {/* GAME LOG (CENTER) */}
        <div className="cn-game-log-col">
          <div className="cn-game-log">
            <div className="cn-log-header">GAME LOG</div>
            <div className="cn-log-content"></div>
          </div>
        </div>

        {/* RED TEAM (RIGHT) */}
        <div className="cn-team-col red-col">
          <div className="cn-top-panel red-panel">
            <div className="cn-panel-header">OPERATIVES</div>
            <div className="cn-panel-content">
              {room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE').map(renderAvatar)}
            </div>
          </div>
          <div className="cn-score-section red-score">
            {/* The reference has a small portrait next to score */}
            <div className="cn-score-number">{redScore}</div>
          </div>
          <div className="cn-bottom-panel red-spy">
            <div className="cn-panel-header">SPYMASTERS</div>
            <div className="cn-panel-content">
              {redSpymasters.length > 0 ? redSpymasters.map(renderAvatar) : null}
            </div>
          </div>
        </div>
      </div>

      {/* 3. STATUS ROW */}
      <div className="cn-status-row">
        <div className="cn-status-text">{statusMessage}</div>
        <button className="cn-help-btn">?</button>
      </div>

      {/* 4. BOARD */}
      <div className="cn-board-grid">
        {board.map(card => (
          <CodenamesCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
