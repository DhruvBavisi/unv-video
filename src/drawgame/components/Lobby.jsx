import React, { useState, useRef } from 'react'
import { ensureIdentity } from '../../game/identity.js'
import { getSocket } from '../../game/socket.js'
import QRModal from '../../game/QRModal.jsx'

function SegmentControl({ label, value, options, onChange, disabled }) {
  return (
    <div className="sk-setting-row">
      <span className="sk-setting-label">{label}</span>
      <div className="sk-segments" style={{ flexWrap: 'wrap' }}>
        {options.map(opt => {
          const isSelected = opt.value === value
          return (
            <div 
              key={opt.value}
              className={`sk-segment ${isSelected ? 'active' : ''} ${disabled ? 'sk-segment--disabled' : ''}`}
              onClick={() => { if (!disabled && !isSelected) onChange(opt.value) }}
            >
              {opt.label}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CustomWordsSettings({ room, isHost, onUpdateConfig }) {
  const [expanded, setExpanded] = useState(false)
  const [useCustomOnly, setUseCustomOnly] = useState(room.configuration.useCustomOnly)
  
  const handleTextChange = (e) => {
    if (!isHost) return
    onUpdateConfig({ customWords: e.target.value })
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    if (!isHost) return
    const newVal = !useCustomOnly
    setUseCustomOnly(newVal)
    onUpdateConfig({ useCustomOnly: newVal })
  }

  const wordsCount = room.configuration.customWords.split(',').filter(w => w.trim().length > 0).length

  return (
    <div>
      <div className="sk-custom-words-header" onClick={() => setExpanded(!expanded)}>
        <div>
          <div className="sk-custom-words-title">CUSTOM WORDS</div>
          <div className="sk-custom-words-subtitle">{wordsCount} words added</div>
        </div>
        <div style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 300ms ease', color: 'var(--sk-primary)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      
      <div className="sk-custom-words-body" style={{ height: expanded ? '240px' : '0px', opacity: expanded ? 1 : 0, overflow: expanded ? 'visible' : 'hidden' }}>
        <div className="sk-toggle" onClick={handleToggle}>
          <span className="sk-toggle-label">Use Custom Words Only</span>
          <div className={`sk-toggle-track ${useCustomOnly ? 'active' : ''}`}>
            <div className="sk-toggle-thumb" />
          </div>
        </div>
        <textarea 
          className="sk-textarea"
          placeholder="Type custom words here, separated by commas..."
          value={room.configuration.customWords}
          onChange={handleTextChange}
          disabled={!isHost}
        />
        <div style={{ fontSize: '0.8rem', color: 'var(--sk-muted)', marginTop: '8px', textAlign: 'center' }}>
          Separate words with commas
        </div>
      </div>
    </div>
  )
}

export default function Lobby({ room, onLeave, onUpdateConfig }) {
  const { sessionId } = ensureIdentity()
  const isHost = room.hostId === sessionId
  const [startError, setStartError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const qrBtnRef = useRef(null)

  const handleConfigChange = (key, value) => {
    if (!isHost) return
    onUpdateConfig({ [key]: value })
  }

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(room.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (e) {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 2000)
    }
  }

  const hostDisabled = !isHost

  const START_ERRORS = {
    NO_SESSION: 'Your connection session expired. Please reconnect.',
    ROOM_NOT_FOUND: 'Room not found.',
    GAME_ALREADY_STARTED: 'The game has already started.',
    NOT_ENOUGH_PLAYERS: 'At least 2 players are required to start.',
    NO_WORDS_AVAILABLE: 'No unused words are available for this game.',
    START_GAME_FAILED: 'The game could not be started. Please try again.'
  }

  const handleStartGame = () => {
    if (!isHost) return
    setStartError('')
    const socket = getSocket()
    socket.emit('draw:start-game', (res) => {
      if (res && res.success === false) {
        setStartError(
          START_ERRORS[res.error] ||
          'Something went wrong starting the game.'
        )
      }
    })
  }

  const handleAddBots = () => {
    if (!isHost) return
    const socket = getSocket()
    socket.emit('draw:add-dev-bots')
  }

  const handleRemoveBots = () => {
    if (!isHost) return
    const socket = getSocket()
    socket.emit('draw:remove-dev-bots')
  }

  return (
    <div className="sk-view">
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>
      
      <div className="sk-header" style={{ paddingBottom: '12px' }}>
        <h1 className="sk-logo" style={{ fontSize: '2.4rem' }}>SKRIBBL</h1>
      </div>

      <div className="sk-container">
        
        {/* ROOM CODE */}
        <div className="sk-card sk-card--animated" style={{ animationDelay: '0ms', padding: '16px' }}>
          <div className="sk-card-title" style={{ justifyContent: 'space-between', marginBottom: '12px' }}>
            <span>ROOM CODE</span>
            <button 
              ref={qrBtnRef}
              className="sk-btn sk-btn--secondary" 
              style={{ padding: '0', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onClick={() => setShowQR(true)}
              title="Show QR Code"
              aria-label="Show QR Code"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4z" /><path d="M14 4h6v6h-6z" /><path d="M4 14h6v6H4z" /><path d="M14 14h6v6h-6z" /></svg>
            </button>
          </div>
          <div className={`sk-code-box ${copied ? 'copied' : ''}`} onClick={handleCopyCode}>
            <div className="sk-code-val">{room.id}</div>
            <div className="sk-code-hint">{copied ? 'COPIED!' : copyFailed ? 'COPY FAILED' : 'TAP TO COPY'}</div>
          </div>
        </div>

        {showQR && (
          <QRModal 
            joinUrl={window.location.origin + '/?mode=skribbl&room=' + encodeURIComponent(room.id)}
            roomId={room.id}
            onClose={() => setShowQR(false)}
            buttonRect={qrBtnRef.current?.getBoundingClientRect()}
            mode="skribbl"
          />
        )}

        {/* PLAYERS */}
        <div className="sk-card sk-card--animated" style={{ animationDelay: '100ms', padding: '20px 24px' }}>
          <div className="sk-card-title">
            PLAYERS 
            <span style={{ color: 'var(--sk-primary)', fontSize: '1.4rem' }}>{room.players.length}/{room.configuration.maxPlayers}</span>
          </div>
          <div>
            {room.players.map((p, i) => (
              <div 
                key={p.id} 
                className="sk-player-row"
              >
                <div className={`sk-avatar ${getAvatarColorClass(p.id)} ${p.isHost ? 'sk-avatar--host' : ''}`}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="sk-player-name" style={{ opacity: p.isConnected ? 1 : 0.4 }}>
                  {p.name}
                  {!p.isConnected && ' (Offline)'}
                </div>
                {p.isHost ? (
                  <div className="sk-badge sk-badge--host">HOST</div>
                ) : (
                  isHost && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        onClick={() => getSocket().emit('draw:make-host', { targetId: p.id })}
                        style={{ background: 'transparent', border: '1px solid var(--sk-primary)', color: 'var(--sk-primary)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--sk-font-display)', letterSpacing: '0.05em' }}
                      >
                        MAKE HOST
                      </button>
                      <button 
                        onClick={() => getSocket().emit('draw:kick-player', { targetId: p.id })}
                        style={{ background: 'transparent', border: '1px solid var(--sk-coral)', color: 'var(--sk-coral)', borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--sk-font-display)', letterSpacing: '0.05em' }}
                      >
                        KICK
                      </button>
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        </div>

        {/* SETTINGS */}
        <div className="sk-card sk-card--animated" style={{ animationDelay: '200ms' }}>
          <div className="sk-card-title">
            GAME SETTINGS
            {hostDisabled && <span className="sk-badge">HOST ONLY</span>}
          </div>
          
          <SegmentControl 
            label="DRAW TIME"
            value={room.configuration.drawTimeSec}
            options={[
              { label: '45s', value: 45 },
              { label: '60s', value: 60 },
              { label: '80s', value: 80 },
              { label: '100s', value: 100 }
            ]}
            onChange={(val) => handleConfigChange('drawTimeSec', val)}
            disabled={hostDisabled}
          />
          
          <SegmentControl 
            label="ROUNDS"
            value={room.configuration.rounds}
            options={[
              { label: '2', value: 2 },
              { label: '3', value: 3 },
              { label: '4', value: 4 },
              { label: '5', value: 5 }
            ]}
            onChange={(val) => handleConfigChange('rounds', val)}
            disabled={hostDisabled}
          />

          <SegmentControl 
            label="WORD CHOICES"
            value={room.configuration.wordCount}
            options={[
              { label: '2', value: 2 },
              { label: '3', value: 3 },
              { label: '4', value: 4 }
            ]}
            onChange={(val) => handleConfigChange('wordCount', val)}
            disabled={hostDisabled}
          />

          <SegmentControl 
            label="WORD MODE"
            value={room.configuration.gameMode}
            options={[
              { label: 'Normal', value: 'NORMAL' },
              { label: 'Hidden', value: 'HIDDEN' },
              { label: 'Combo', value: 'COMBINATION' }
            ]}
            onChange={(val) => handleConfigChange('gameMode', val)}
            disabled={hostDisabled}
          />

          <CustomWordsSettings 
            room={room}
            isHost={isHost}
            onUpdateConfig={onUpdateConfig}
          />
        </div>
      </div>

      <div className="sk-action-area">
        {import.meta.env.VITE_DEV_BOTS_ENABLED === 'true' && isHost && (
          <div className="sk-action-inner" style={{ marginBottom: '8px' }}>
            <button className="sk-btn sk-btn--secondary" onClick={handleAddBots}>
              ADD DEV BOTS
            </button>
            <button className="sk-btn sk-btn--secondary" onClick={handleRemoveBots}>
              REMOVE DEV BOTS
            </button>
          </div>
        )}
        <div className="sk-action-inner">
          <button className="sk-btn-icon" onClick={onLeave} aria-label="Leave Room">
            <svg viewBox="0 0 24 24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
            </svg>
          </button>
          <button className="sk-btn" disabled={!isHost || room.players.length < 2} onClick={handleStartGame}>
            {isHost ? (room.players.length < 2 ? 'NEED MORE PLAYERS' : 'START GAME') : 'WAITING FOR HOST'}
          </button>
        </div>
        {startError && (
          <div role="alert" className="sk-error">
            {startError}
          </div>
        )}
      </div>
    </div>
  )
}

export function getAvatarColorClass(id) {
  if (!id) return 'sk-avatar--1'
  const charCode = id.charCodeAt(id.length - 1)
  const num = (charCode % 4) + 1
  return `sk-avatar--${num}`
}
