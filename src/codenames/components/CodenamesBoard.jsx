import React from 'react'
import CodenamesCard from './CodenamesCard'
import { connectSocket } from '../../game/socket.js'
import { readIdentity } from '../../game/identity.js'

export default function CodenamesBoard({ room, onLeave }) {
  const board = room.board
  if (!board || board.length !== 25) {
    return <div className="codenames-board-empty">Waiting for board...</div>
  }

  const renderAvatar = (p) => {
    return (
      <div key={p.id} className="cn-avatar-wrapper">
        {p.id === room.hostId && <div className="cn-avatar-crown">👑</div>}
        <div className="cn-avatar-circle" style={{ backgroundColor: p.color || '#555' }}>
          <span className="cn-avatar-emoji">{p.avatar || '😎'}</span>
        </div>
        <div className="cn-avatar-name">{p.name}{p.isBot ? ' [BOT]' : ''}</div>
      </div>
    )
  }

  const blueOps = room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE')
  const redOps = room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE')
  
  const blueSpys = room.players.filter(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redSpys = room.players.filter(p => p.team === 'red' && p.role === 'SPYMASTER')

  const blueScore = 9
  const redScore = 8

  const handleSelectTeam = (team, role) => {
    const { sessionId } = readIdentity()
    const socket = connectSocket(sessionId)
    socket.emit('codenames:join-team-role', { team, role })
  }


  return (
    <div className="cn-game-page">
      {/* 2. TOP NAVIGATION BAR */}
      <div className="cn-game-nav">
        <div className="cn-nav-left">
          <button className="cn-nav-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>{room.players.length}</span>
          </button>
          <button className="cn-nav-btn" onClick={onLeave}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M3 11l5-5M3 11l5 5M3 11h11a5 5 0 0 1 5 5v0a5 5 0 0 1-5 5H9"/></svg>
          </button>
        </div>
        <div className="cn-nav-right">
          <button className="cn-icon-button" style={{ position: 'relative' }}>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>News</span>
            <div className="cn-news-badge">25</div>
          </button>
          <button className="cn-icon-button">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M5 3v18l7-5 7 5V3H5z"/></svg>
            <span style={{ fontWeight: 'bold', fontSize: '0.8rem' }}>Rules</span>
          </button>
          <button className="cn-nav-btn" style={{ width: '28px', height: '28px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          </button>
        </div>
      </div>

      {/* 3. TEAM + GAME LOG AREA */}
      <div className="cn-game-info-row">
        {/* LEFT COLUMN: BLUE TEAM */}
        <div className="cn-team-col blue">
          <div className="cn-team-panel">
            <div className="cn-team-title">OPERATIVES</div>
            <div className="cn-team-players">
              {blueOps.map(renderAvatar)}
            </div>
          </div>
          <div className="cn-team-score" style={{ textAlign: 'center' }}>{blueScore}</div>
          <div className="cn-spy-panel blue">
            <div className="cn-team-title">SPYMASTERS</div>
            <div className="cn-team-players" style={{ minHeight: 'auto', marginBottom: '4px' }}>
              {blueSpys.map(renderAvatar)}
            </div>
            {!room.players.some(p => p.team === 'blue' && p.role === 'SPYMASTER') && (
              <button className="cn-spy-join-btn" onClick={() => handleSelectTeam('blue', 'SPYMASTER')}>JOIN TEAM</button>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: GAME LOG */}
        <div className="cn-game-log">
          <div className="cn-log-title">GAME LOG</div>
        </div>

        {/* RIGHT COLUMN: RED TEAM */}
        <div className="cn-team-col red">
          <div className="cn-team-panel">
            <div className="cn-team-title">OPERATIVES</div>
            <div className="cn-team-players">
              {redOps.map(renderAvatar)}
            </div>
          </div>
          <div className="cn-team-score" style={{ textAlign: 'center', color: '#ff5c5c' }}>{redScore}</div>
          <div className="cn-spy-panel red">
            <div className="cn-team-title">SPYMASTERS</div>
            <div className="cn-team-players" style={{ minHeight: 'auto', marginBottom: '4px' }}>
              {redSpys.map(renderAvatar)}
            </div>
            {!room.players.some(p => p.team === 'red' && p.role === 'SPYMASTER') && (
              <button className="cn-spy-join-btn" onClick={() => handleSelectTeam('red', 'SPYMASTER')}>JOIN TEAM</button>
            )}
          </div>
        </div>
      </div>

      {/* 4. CURRENT GAME STATUS / TURN MESSAGE */}
      <div className="cn-status-row">
        <div className="cn-status-text">
          {room.currentTeam === 'blue' ? 'BLUE TEAM NEEDS A SPYMASTER' : 'RED TEAM NEEDS A SPYMASTER'}
        </div>
        <div className="cn-help-btn">?</div>
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
          <marquee scrollamount="4">PLAY CODENAMES EVEN WHEN YOUR FRIENDS ARE OFFLINE? TRY CODENAMES AI...</marquee>
        </div>
      </div>
    </div>
  )
}
