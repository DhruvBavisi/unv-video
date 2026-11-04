import React, { useState } from 'react'
import { connectSocket } from '../../../shared/realtime/socket.js'
import QRModal from '../../../shared/components/QRModal.jsx'
import { getPlayerAvatarUrl } from '../utils/cardTiles.js'

export function Icon({ type, size = 16 }) {
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

  if (type === 'up') {
    return (
      <svg {...common}>
        <path d="m18 15-6-6-6 6"/>
      </svg>
    )
  }

  if (type === 'restart' || type === 'refresh') {
    return (
      <svg {...common}>
        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24L21 8" />
        <path d="M21 3v5h-5" />
      </svg>
    )
  }

  if (type === 'settings' || type === 'gear') {
    return (
      <svg {...common}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  )
}

export function TopBar({ count, onPlayers, onSettings, onRestart }) {
  return (
    <div className="cn-game-nav">
      <div className="cn-nav-left">
        <button type="button" className="cn-nav-btn players-btn" aria-label={`${count} players`} onClick={onPlayers}>
          <Icon type="users" />
          <span className="cn-players-badge">{count}</span>
        </button>
      </div>
      <div className="cn-nav-right">
        {onRestart && (
          <button
            type="button"
            className="cn-nav-btn restart-btn"
            aria-label="Reset table"
            title="Reset table (new words & move to spectators)"
            onClick={onRestart}
          >
            <Icon type="restart" />
          </button>
        )}
        <button type="button" className="cn-nav-btn settings-btn" aria-label="Settings" onClick={onSettings}>
          <Icon type="settings" />
        </button>
      </div>
    </div>
  )
}

export function SettingsModal({ room, playerId, onClose, onLeave }) {
  const isHost = room?.hostId === playerId
  const handleDevAddBots = (count = 3) => {
    connectSocket(playerId).emit('codenames:dev-add-bots', { count })
  }
  const handleDevRemoveBots = () => {
    connectSocket(playerId).emit('codenames:dev-remove-bots')
  }

  return (
    <div className="cn-modal-overlay" onClick={onClose}>
      <div className="cn-modal" onClick={e => e.stopPropagation()}>
        <div className="cn-modal-header">Settings</div>
        <div className="cn-modal-content">
          {import.meta.env.DEV && isHost && (
            <div style={{ marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#888', textTransform: 'uppercase' }}>Development Bots</div>
              <button type="button" className="cn-modal-btn" onClick={() => handleDevAddBots(3)}>🤖 Add 3 Bots (Fill Teams)</button>
              <button type="button" className="cn-modal-btn" onClick={() => handleDevAddBots(1)}>🤖 Add 1 Bot</button>
              <button type="button" className="cn-modal-btn" onClick={handleDevRemoveBots}>🚫 Remove Bots</button>
            </div>
          )}
          <button className="cn-modal-btn danger" onClick={onLeave}>Leave Game</button>
          <button className="cn-modal-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

const avatarUrl = (id) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}&backgroundColor=transparent`

export function PlayersModal({ room, playerId, onClose }) {
  const [showQR, setShowQR] = useState(false)
  const isHost = room.hostId === playerId
  const act = (event, targetId) => connectSocket(playerId).emit(event, { targetId })
  const groups = [
    { key: 'blue', title: 'Blue team', list: room.players.filter(p => p.team === 'blue') },
    { key: 'red', title: 'Red team', list: room.players.filter(p => p.team === 'red') },
    { key: 'spec', title: 'Spectators', list: room.players.filter(p => !p.team) },
  ]
  return (
    <>
      <div className="cn-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
        <div className="cn-modal cn-pm">
          <div className="cn-pm-head">
            <h3>PLAYERS <span>{room.players.length}</span></h3>
            <button type="button" className="cn-pm-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="cn-pm-room">
            <div><small>ROOM CODE</small><strong>{room.id}</strong></div>
            <button type="button" className="cn-pm-qr" onClick={() => setShowQR(true)}>QR / INVITE</button>
          </div>
          <div className="cn-pm-body">
            {groups.map(g => g.list.length > 0 && (
              <div key={g.key} className={`cn-pm-group ${g.key}`}>
                <div className="cn-pm-group-title">{g.title} · {g.list.length}</div>
                {g.list.map(p => (
                  <div key={p.id} className="cn-pm-row">
                    <img className="cn-pm-avatar" src={getPlayerAvatarUrl(p)} alt="" />
                    <div className="cn-pm-info">
                      <span className="cn-pm-name">{p.name}{p.id === room.hostId ? ' 👑' : ''}{p.id === playerId && <em> (you)</em>}{p.isBot && <em> [bot]</em>}</span>
                      <span className="cn-pm-role">{p.role === 'SPYMASTER' ? 'Spymaster' : p.role === 'OPERATIVE' ? 'Operative' : 'Spectating'}</span>
                    </div>
                    {isHost && p.id !== playerId && (
                      <div className="cn-pm-actions">
                        <button type="button" onClick={() => act('codenames:host-make-host', p.id)}>Make host</button>
                        <button type="button" className="danger" onClick={() => act('codenames:host-kick-player', p.id)}>Kick</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      {showQR && (
        <QRModal joinUrl={`${window.location.origin}/?mode=codenames&room=${room.id}`} roomId={room.id} onClose={() => setShowQR(false)} mode="codenames" />
      )}
    </>
  )
}

export function RulesModal({ onClose }) {
  return (
    <div className="cn-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="cn-modal cn-rules-modal" onClick={e => e.stopPropagation()}>
        <div className="cn-pm-head">
          <h3>HOW TO PLAY CODENAMES</h3>
          <button type="button" className="cn-pm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="cn-rules-body">
          <div className="cn-rule-section">
            <h4>OBJECTIVE</h4>
            <p>Two rival spymasters know the secret identities of 25 agents. Their teammates (Operatives) know the agents only by their CODENAMES. The first team to contact all their agents wins.</p>
          </div>
          <div className="cn-rule-section">
            <h4>GIVING CLUES</h4>
            <p>Spymasters take turns giving a one-word clue and a number (e.g. <strong>"ANIMAL 2"</strong>). The number tells Operatives how many word cards relate to that clue.</p>
          </div>
          <div className="cn-rule-section">
            <h4>GUESSING & CONFIRMING</h4>
            <p>Operatives discuss, tap a card to target it, and confirm their guess. Operatives can make up to <strong>[Number + 1]</strong> guesses, or tap <strong>END GUESSING</strong> to pass.</p>
          </div>
          <div className="cn-rule-section">
            <h4>CARD TYPES</h4>
            <ul className="cn-rule-types">
              <li><span className="cn-dot red" /> <strong>Red Agent:</strong> Revealed for Red Team.</li>
              <li><span className="cn-dot blue" /> <strong>Blue Agent:</strong> Revealed for Blue Team.</li>
              <li><span className="cn-dot neutral" /> <strong>Innocent Bystander:</strong> Ends your turn immediately.</li>
              <li><span className="cn-dot assassin" /> <strong>Assassin:</strong> Immediate loss! Opponent team wins.</li>
            </ul>
          </div>
        </div>
        <div className="cn-modal-footer">
          <button type="button" className="cn-modal-btn" onClick={onClose}>GOT IT</button>
        </div>
      </div>
    </div>
  )
}

export function VictoryModal({ room, playerId, onPlayAgain, onInspectBoard }) {
  if (room.status !== 'FINISHED' || !room.winner) return null
  const isHost = room.hostId === playerId
  const isRedWin = room.winner === 'red'
  const reasonText = room.endReason === 'ASSASSIN'
    ? `${isRedWin ? 'Blue' : 'Red'} team contacted the Assassin!`
    : `All ${room.winner.toUpperCase()} agents were identified!`

  const totalTurns = Array.isArray(room.turnHistory) ? room.turnHistory.length : 0

  return (
    <div className="cn-modal-overlay cn-victory-overlay">
      <div className={`cn-modal cn-victory-modal ${isRedWin ? 'victory--red' : 'victory--blue'}`}>
        <div className="cn-victory-crown">👑</div>
        <h2 className="cn-victory-title">{room.winner.toUpperCase()} TEAM WINS!</h2>
        <p className="cn-victory-reason">{reasonText}</p>
        
        <div className="cn-victory-stats">
          <div className="cn-victory-stat">
            <span className="stat-value">{totalTurns}</span>
            <span className="stat-label">TOTAL TURNS</span>
          </div>
        </div>

        <div className="cn-victory-actions">
          <button type="button" className="cn-inspect-board-btn" onClick={onInspectBoard}>
            INSPECT BOARD
          </button>
          {isHost ? (
            <button type="button" className="cn-rematch-btn" onClick={onPlayAgain}>
              PLAY AGAIN
            </button>
          ) : (
            <div className="cn-rematch-waiting">WAITING FOR HOST TO RESTART</div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ResetConfirmModal({ isOpen, onConfirm, onCancel, isSubmitting = false }) {
  if (!isOpen) return null

  return (
    <div className="cn-modal-overlay cn-reset-overlay" onClick={e => { if (e.target === e.currentTarget && !isSubmitting) onCancel() }}>
      <div className="cn-modal cn-reset-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="cn-reset-dialog-title">
        <div className="cn-reset-header">
          <div className="cn-reset-header-icon-wrap" aria-hidden="true">
            <Icon type="restart" size={26} />
          </div>
          <h3 id="cn-reset-dialog-title" className="cn-reset-title">RESET TABLE?</h3>
        </div>
        <div className="cn-reset-body">
          <p className="cn-reset-lead">Are you sure you want to reset this table?</p>
          <ul className="cn-reset-list">
            <li>Deal a brand-new 25-word board</li>
            <li>Move all players back to Spectators</li>
            <li>Clear current clues and turn progress</li>
          </ul>
        </div>
        <div className="cn-reset-actions">
          <button
            type="button"
            className="cn-reset-btn cn-reset-btn-cancel"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cn-reset-btn cn-reset-btn-confirm"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Resetting...' : 'Reset Table'}
          </button>
        </div>
      </div>
    </div>
  )
}
