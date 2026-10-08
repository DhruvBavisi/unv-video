import React from 'react'
import CodenamesCard from './CodenamesCard'
import { connectSocket } from '../../game/socket.js'
import { readIdentity } from '../../game/identity.js'

export default function CodenamesBoard({ room }) {
  const { sessionId } = readIdentity()
  const board = room.board
  if (!board || board.length !== 25) {
    return <div className="codenames-board-empty">Waiting for board...</div>
  }

  // Calculate scores based on unrevealed cards
  const blueTotal = board.filter(c => c.category === 'blue').length || 8
  const redTotal = board.filter(c => c.category === 'red').length || 9
  const blueRevealed = board.filter(c => c.category === 'blue' && c.revealed).length
  const redRevealed = board.filter(c => c.category === 'red' && c.revealed).length
  const blueScore = blueTotal - blueRevealed
  const redScore = redTotal - redRevealed

  const player = room.players.find(p => p.id === sessionId) || {}
  
  const blueOps = room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE')
  const redOps = room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE')
  const blueSpys = room.players.filter(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redSpys = room.players.filter(p => p.team === 'red' && p.role === 'SPYMASTER')

  const renderAvatarSmall = (p) => {
    return (
      <div key={p.id} className="cn-avatar-wrapper small">
        {p.id === room.hostId && <div className="cn-avatar-crown">👑</div>}
        <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}&backgroundColor=transparent`} alt="avatar" className="cn-avatar-img" />
        <div className="cn-avatar-name">{p.name}{p.isBot ? ' [BOT]' : ''}</div>
      </div>
    )
  }

  const handleSelectTeam = (team, role) => {
    const socket = connectSocket(sessionId)
    socket.emit('codenames:join-team-role', { team, role })
  }

  return (
    <div className="cn-game-page">
      {/* 2. TOP NAVIGATION BAR */}
      <div className="cn-game-nav">
        <div className="cn-nav-left">
          <button className="cn-nav-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            <span className="cn-nav-badge">1</span>
          </button>
          <button className="cn-nav-btn" style={{fontSize: '1.2rem', fontWeight: 'bold'}}>
            ↺
          </button>
        </div>
        <div className="cn-nav-right">
          <button className="cn-nav-pill">
            News
            <span className="cn-news-badge">25</span>
          </button>
          <button className="cn-nav-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path><line x1="12" y1="11" x2="12" y2="17"></line><line x1="9" y1="14" x2="15" y2="14"></line></svg>
            Rules
          </button>
          <button className="cn-nav-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>
      </div>

      {/* 3. TEAM + GAME LOG AREA */}
      <div className="cn-game-info-row">
        {/* LEFT: BLUE TEAM */}
        <div className="cn-team-col blue">
          <div className="cn-team-panel">
            <div className="cn-team-title">OPERATIVES</div>
            <div className="cn-team-players">
              {blueOps.map(renderAvatarSmall)}
            </div>
            <div className="cn-team-score-wrapper">
              <span className="cn-team-score">{blueScore}</span>
            </div>
          </div>
          <div className="cn-spy-panel">
            <div className="cn-team-title">SPYMASTERS</div>
            {blueSpys.length > 0 ? (
              <div className="cn-team-players">{blueSpys.map(renderAvatarSmall)}</div>
            ) : (
              <button className="cn-spy-join-btn" onClick={() => handleSelectTeam('blue', 'SPYMASTER')}>JOIN TEAM</button>
            )}
          </div>
        </div>

        {/* CENTER: GAME LOG */}
        <div className="cn-game-log">
          <div className="cn-log-title">GAME LOG</div>
        </div>

        {/* RIGHT: RED TEAM */}
        <div className="cn-team-col red">
          <div className="cn-team-panel">
            <div className="cn-team-title">OPERATIVES</div>
            <div className="cn-team-players">
              {redOps.map(renderAvatarSmall)}
            </div>
            <div className="cn-team-score-wrapper">
              <div className="cn-agent-portrait red"></div>
              <span className="cn-team-score">{redScore}</span>
            </div>
          </div>
          <div className="cn-spy-panel">
            <div className="cn-team-title">SPYMASTERS</div>
            {redSpys.length > 0 ? (
              <div className="cn-team-players">{redSpys.map(renderAvatarSmall)}</div>
            ) : (
              <button className="cn-spy-join-btn" onClick={() => handleSelectTeam('red', 'SPYMASTER')}>JOIN TEAM</button>
            )}
          </div>
        </div>
      </div>

      {/* 4. CURRENT GAME STATUS / TURN MESSAGE */}
      <div className="cn-status-row">
        <div className="cn-status-text">
          {(!room.players.some(p => p.team === 'blue' && p.role === 'SPYMASTER')) ? "BLUE TEAM NEEDS A SPYMASTER" :
           (!room.players.some(p => p.team === 'red' && p.role === 'SPYMASTER')) ? "RED TEAM NEEDS A SPYMASTER" :
           `${room.currentTeam || 'BLUE'} TEAM'S TURN`}
        </div>
        <button className="cn-help-btn">?</button>
      </div>

      {/* 5. 5 × 5 CODENAMES BOARD */}
      <div className="cn-board-grid">
        {board.map(card => (
          <CodenamesCard key={card.id} card={card} />
        ))}
      </div>

      {/* 6. LOWER SPACE / NEWS TICKER AREA */}
      <div className="cn-ticker-area">
        <div className="cn-ticker-label">NEWS</div>
        <div className="cn-ticker-text">
          <span>CODENAMES even when your friends are offline? Try Codenames Daily</span>
        </div>
      </div>
    </div>
  )
}
