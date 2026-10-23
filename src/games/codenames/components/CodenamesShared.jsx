import React, { useState } from 'react'
import { connectSocket } from '../../../shared/realtime/socket.js'
import QRModal from '../../../shared/components/QRModal.jsx'

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

  return (
    <svg {...common}>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06A1.7 1.7 0 0 0 16 18.44a1.7 1.7 0 0 0-1.03 1.56V20h-2.7v-.09A1.7 1.7 0 0 0 11.24 18.35a1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 7.56 15a1.7 1.7 0 0 0-1.56-1.03H5.9v-2.7h.1A1.7 1.7 0 0 0 7.56 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06A1.7 1.7 0 0 0 11 6.56a1.7 1.7 0 0 0 1.03-1.56V4.9h2.7V5A1.7 1.7 0 0 0 16 6.56a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 19.44 10a1.7 1.7 0 0 0 1.56 1.03h.1v2.7h-.1A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

export function TopBar({ count, onPlayers, onSettings }) {
  return (
    <div className="cn-game-nav">
      <div className="cn-nav-left">
        <button type="button" className="cn-nav-btn players-btn" aria-label={`${count} players`} onClick={onPlayers}>
          <Icon type="users" />
          <span className="cn-players-badge">{count}</span>
        </button>
      </div>
      <div className="cn-nav-right">
        <button type="button" className="cn-nav-btn settings-btn" aria-label="Settings" onClick={onSettings}>
          <Icon type="settings" />
        </button>
      </div>
    </div>
  )
}

export function SettingsModal({ onClose, onLeave }) {
  return (
    <div className="cn-modal-overlay" onClick={onClose}>
      <div className="cn-modal" onClick={e => e.stopPropagation()}>
        <div className="cn-modal-header">Settings</div>
        <div className="cn-modal-content">
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
                    <img className="cn-pm-avatar" src={avatarUrl(p.id)} alt="" />
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
