import React, { useState, useRef, useEffect } from 'react'
import { ensureIdentity } from '../../../shared/session/identity.js'
import { getSocket } from '../../../shared/realtime/socket.js'
import QRModal from '../../../shared/components/QRModal.jsx'
import SkribblError from './SkribblError.jsx'
import SkribblAvatar from './SkribblAvatar.jsx'
import HostCrown from '../../../shared/components/HostCrown.jsx'
import { getCrownStyle, getCrownSize } from '../utils/skribblAvatarLayout.js'
import CrownManualControls from './CrownManualControls.jsx'

function SegmentControl({ label, value, options, onChange, disabled }) {
  return (
    <div className="sk-lobby-setting-row">
      <span className="sk-lobby-setting-label">{label}</span>
      <div className="sk-lobby-segments">
        {options.map(opt => {
          const isSelected = opt.value === value
          return (
            <button
              type="button"
              key={opt.value}
              className={`sk-lobby-segment ${isSelected ? 'is-active' : ''} ${disabled ? 'is-disabled' : ''}`}
              onClick={() => { if (!disabled && !isSelected) onChange(opt.value) }}
              disabled={disabled}
            >
              {opt.label}
            </button>
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
    <div className="sk-lobby-custom-words-wrap">
      <div 
        className="sk-lobby-custom-words-header" 
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
      >
        <div>
          <div className="sk-lobby-custom-words-title">CUSTOM WORDS</div>
          <div className="sk-lobby-custom-words-subtitle">{wordsCount} words added</div>
        </div>
        <div 
          className="sk-lobby-custom-words-chevron"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>
      
      {expanded && (
        <div className="sk-lobby-custom-words-body">
          <div 
            className="sk-lobby-toggle" 
            onClick={handleToggle}
            role="button"
            tabIndex={0}
          >
            <span className="sk-lobby-toggle-label">Use Custom Words Only</span>
            <div className={`sk-lobby-toggle-track ${useCustomOnly ? 'is-active' : ''}`}>
              <div className="sk-lobby-toggle-thumb" />
            </div>
          </div>
          <textarea 
            className="sk-lobby-textarea"
            placeholder="Type custom words here, separated by commas..."
            value={room.configuration.customWords}
            onChange={handleTextChange}
            disabled={!isHost}
            rows={3}
          />
          <div className="sk-lobby-textarea-hint">
            Separate multiple words with commas
          </div>
        </div>
      )}
    </div>
  )
}

const START_ERRORS = {
  NO_SESSION: 'Your connection session expired. Please reconnect.',
  ROOM_NOT_FOUND: 'Room not found.',
  GAME_ALREADY_STARTED: 'The game has already started.',
  NOT_ENOUGH_PLAYERS: 'At least 2 players are required to start.',
  NO_WORDS_AVAILABLE: 'No unused words are available for this game.',
  START_GAME_FAILED: 'The game could not be started. Please try again.',
  KICKED_FROM_ROOM: 'You have been kicked from this room.'
}

export default function Lobby({ room, onLeave, onUpdateConfig, error }) {
  const { sessionId } = ensureIdentity()
  const isHost = room.hostId === sessionId
  const [startError, setStartError] = useState('')
  const [, setCrownTick] = useState(0)
  useEffect(() => {
    const onCrownUpdate = (e) => {
      if (!e.detail || e.detail.mode === 'lobby') setCrownTick(t => t + 1)
    }
    window.addEventListener('skribbl:crown-update', onCrownUpdate)
    return () => window.removeEventListener('skribbl:crown-update', onCrownUpdate)
  }, [])
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
    } catch {
      setCopyFailed(true)
      setTimeout(() => setCopyFailed(false), 2000)
    }
  }

  const hostDisabled = !isHost

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

  const eligibleCount = room.players.filter(p => !p.spectator).length

  return (
    <div className="sk-lobby-view">
      {/* Top Header Logo */}
      <header className="sk-lobby-header">
        <div className="sk-lobby-logo-wrap">
          <img 
            src="/images/characters/skribbl/logo.webp" 
            alt="skribbl.io" 
            className="sk-lobby-logo-img"
            draggable={false}
          />
        </div>
        <div className="sk-lobby-status-pill">
          LOBBY &bull; {room.players.length} {room.players.length === 1 ? 'PLAYER' : 'PLAYERS'}
        </div>
      </header>

      {/* Main Glass Card */}
      <main className="sk-lobby-card">
        {(error || startError) && (
          <SkribblError 
            message={error || startError} 
            onDismiss={() => setStartError('')} 
          />
        )}

        {/* 1. ROOM CODE SECTION */}
        <section className="sk-lobby-section">
          <div className="sk-lobby-section-title">
            <span>ROOM CODE</span>
            <button 
              ref={qrBtnRef}
              type="button"
              className="sk-lobby-qr-btn" 
              onClick={() => setShowQR(true)}
              title="Show QR Code"
              aria-label="Show QR Code"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h6v6H4z" />
                <path d="M14 4h6v6h-6z" />
                <path d="M4 14h6v6H4z" />
                <path d="M14 14h6v6h-6z" />
              </svg>
            </button>
          </div>

          <div 
            className={`sk-lobby-code-box ${copied ? 'is-copied' : ''}`} 
            onClick={handleCopyCode}
            role="button"
            tabIndex={0}
            aria-label={`Room code: ${room.id}. Click to copy`}
          >
            <div className="sk-lobby-code-val">{room.id}</div>
            <div className="sk-lobby-code-hint">
              {copied ? '✓ COPIED TO CLIPBOARD!' : copyFailed ? 'COPY FAILED' : 'TAP TO COPY ROOM CODE'}
            </div>
          </div>
        </section>

        {showQR && (
          <QRModal 
            joinUrl={window.location.origin + '/?mode=skribbl&room=' + encodeURIComponent(room.id)}
            roomId={room.id}
            onClose={() => setShowQR(false)}
            buttonRect={qrBtnRef.current?.getBoundingClientRect()}
            mode="skribbl"
          />
        )}

        {/* 2. PLAYERS SECTION */}
        <section className="sk-lobby-section">
          <div className="sk-lobby-section-title">
            <span>PLAYERS</span>
            <span className="sk-lobby-player-counter">
              {room.players.length} / {room.configuration.maxPlayers}
            </span>
          </div>

          <div className="sk-lobby-players-list">
            {room.players.map((p) => {
              const isCurrentPlayer = p.id === sessionId
              return (
                <div key={p.id} className="sk-lobby-player-row">
                  <div className="sk-lobby-player-avatar-wrap">
                    <SkribblAvatar avatar={p.avatar} size={38} bouncy={true} />
                    {p.isHost && (
                      <HostCrown 
                        size={getCrownSize('lobby')} 
                        className="sk-lobby-host-crown" 
                        style={getCrownStyle('lobby')}
                      />
                    )}
                  </div>

                  <div className="sk-lobby-player-info">
                    <span 
                      className="sk-lobby-player-name" 
                      style={{ opacity: p.isConnected ? 1 : 0.45 }}
                    >
                      {p.name}
                      {isCurrentPlayer && <span className="sk-lobby-you-tag"> (You)</span>}
                      {!p.isConnected && <span className="sk-lobby-offline-tag"> (Offline)</span>}
                    </span>
                  </div>

                  <div className="sk-lobby-player-actions">
                    {p.isHost ? (
                      <span className="sk-lobby-badge-host">HOST</span>
                    ) : (
                      isHost && (
                        <div className="sk-lobby-host-tools">
                          <button 
                            type="button"
                            onClick={() => getSocket().emit('draw:make-host', { targetId: p.id })}
                            className="sk-lobby-btn-sm sk-lobby-btn-sm--host"
                            title="Pass host role to this player"
                          >
                            Make Host
                          </button>
                          <button 
                            type="button"
                            onClick={() => getSocket().emit('draw:kick-player', { targetId: p.id })}
                            className="sk-lobby-btn-sm sk-lobby-btn-sm--kick"
                            title="Kick player from room"
                          >
                            Kick
                          </button>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* 3. GAME SETTINGS SECTION */}
        <section className="sk-lobby-section">
          <div className="sk-lobby-section-title">
            <span>GAME SETTINGS</span>
            {hostDisabled && <span className="sk-lobby-badge-muted">HOST ONLY</span>}
          </div>
          
          <div className="sk-lobby-settings-box">
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
        </section>

        {/* 4. ACTIONS: START GAME & LEAVE ROOM */}
        <section className="sk-lobby-actions">
          <button 
            type="button" 
            className="sk-lobby-btn-start"
            disabled={!isHost || eligibleCount < 2 || room.phase !== 'LOBBY'} 
            onClick={handleStartGame}
          >
            {isHost ? (
              room.phase !== 'LOBBY' 
                ? 'Waiting for Players...' 
                : (eligibleCount < 2 ? 'Need 2+ Players to Start' : 'Start Game!')
            ) : 'Waiting for Host to Start...'}
          </button>

          <button 
            type="button"
            className="sk-lobby-btn-leave"
            onClick={onLeave}
          >
            Leave Room
          </button>
        </section>
      </main>

      {/* Manual Crown Position Controls */}
      <CrownManualControls defaultMode="lobby" />
    </div>
  )
}

export function getAvatarColorClass(id) {
  if (!id) return 'sk-avatar--1'
  const charCode = id.charCodeAt(id.length - 1)
  const num = (charCode % 4) + 1
  return `sk-avatar--${num}`
}
