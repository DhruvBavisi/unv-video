import React from 'react'
import CodenamesCard from './CodenamesCard'

function Icon({ type, size = 16 }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  }

  if (type === 'users') {
    return (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )
  }

  if (type === 'undo') {
    return (
      <svg {...common}>
        <path d="M9 14 4 9l5-5" />
        <path d="M4 9h10a6 6 0 0 1 6 6v1" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06A1.7 1.7 0 0 0 16 18.44a1.7 1.7 0 0 0-1.03 1.56V20h-2.7v-.09A1.7 1.7 0 0 0 11.24 18.35a1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 7.56 15a1.7 1.7 0 0 0-1.56-1.03H5.9v-2.7h.1A1.7 1.7 0 0 0 7.56 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06A1.7 1.7 0 0 0 11 6.56a1.7 1.7 0 0 0 1.03-1.56V4.9h2.7V5A1.7 1.7 0 0 0 16 6.56a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 19.44 10a1.7 1.7 0 0 0 1.56 1.03h.1v2.7h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

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

  const blueSpymasters = room.players.filter(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redSpymasters = room.players.filter(p => p.team === 'red' && p.role === 'SPYMASTER')
  const needsBlueSpy = room.phase === 'BOARD_READY' && blueSpymasters.length === 0
  const isActive = (team, kind) => needsBlueSpy ? (team === 'blue' && kind === 'spy') : (team === room.currentTeam && kind === 'ops')

  const statusMessage = room.phase === 'BOARD_READY' && blueSpymasters.length === 0
    ? 'BLUE TEAM NEEDS A SPYMASTER'
    : room.currentTeam ? `${room.currentTeam.toUpperCase()} TEAM'S TURN` : 'GAME STARTED'

  const renderAvatar = (p) => (
    <div key={p.id} className="cn-board-avatar">
      {p.id === room.hostId && <div className="cn-board-crown">👑</div>}
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}&backgroundColor=transparent`} alt="avatar" />
      <div className="cn-board-avatar-name">{p.name.substring(0, 5)}</div>
    </div>
  )

  return (
    <div className="cn-game-page">
      <div className="cn-game-nav">
        <div className="cn-nav-left">
          <button className="cn-nav-btn players-btn" aria-label="Players">
            <Icon type="users" />
            <span className="cn-players-badge">{room.players.length}</span>
          </button>
          <button className="cn-nav-btn undo-btn" aria-label="Undo">
            <Icon type="undo" />
          </button>
        </div>
        <div className="cn-nav-right">
          <button className="cn-nav-btn settings-btn" aria-label="Settings">
            <Icon type="settings" />
          </button>
        </div>
      </div>

      <div className="cn-game-info-row">
        <div className="cn-team-col blue-col">
          <div className={`cn-top-panel blue-panel${isActive('blue','ops') ? ' is-active' : ''}`}>
            <div className="cn-panel-header">OPERATIVES</div>
            <div className="cn-panel-content">
              {room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE').map(renderAvatar)}
            </div>
          </div>
          <div className="cn-score-section blue-score">
            <div className="cn-score-number">{blueScore}</div>
            <div className="cn-score-thumb" aria-hidden="true" />
          </div>
          <div className={`cn-bottom-panel blue-spy${isActive('blue','spy') ? ' is-active' : ''}`}>
            <div className="cn-panel-header">SPYMASTERS</div>
            <div className={`cn-panel-content${blueSpymasters.length ? '' : ' cn-panel-content--join'}`}>
              {blueSpymasters.length > 0 ? blueSpymasters.map(renderAvatar) : (
                <button className="cn-spy-join-btn"><span>JOIN TEAM</span></button>
              )}
            </div>
          </div>
        </div>

        <div className="cn-game-log-col">
          <div className="cn-game-log">
            <div className="cn-log-header">GAME LOG</div>
            <div className="cn-log-content"></div>
          </div>
        </div>

        <div className="cn-team-col red-col">
          <div className={`cn-top-panel red-panel${isActive('red','ops') ? ' is-active' : ''}`}>
            <div className="cn-panel-header">OPERATIVES</div>
            <div className="cn-panel-content">
              {room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE').map(renderAvatar)}
            </div>
          </div>
          <div className="cn-score-section red-score">
            <div className="cn-score-number">{redScore}</div>
            <div className="cn-score-thumb" aria-hidden="true" />
          </div>
          <div className={`cn-bottom-panel red-spy${isActive('red','spy') ? ' is-active' : ''}`}>
            <div className="cn-panel-header">SPYMASTERS</div>
            <div className="cn-panel-content">
              {redSpymasters.length > 0 ? redSpymasters.map(renderAvatar) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="cn-status-row">
        <div className="cn-status-text">{statusMessage}</div>
        <button className="cn-help-btn" aria-label="Help"><span>?</span></button>
      </div>

      <div className="cn-board-grid">
        {board.map(card => (
          <CodenamesCard key={card.id} card={card} />
        ))}
      </div>
    </div>
  )
}
