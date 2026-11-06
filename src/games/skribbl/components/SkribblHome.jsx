import React, { useState, useEffect, useRef } from 'react'
import SkribblAvatar, { TOTAL_COLORS, TOTAL_EYES, TOTAL_MOUTHS, getRandomAvatar } from './SkribblAvatar.jsx'
import SkribblError from './SkribblError.jsx'
import QRScannerModal from '../../../shared/components/QRScannerModal.jsx'
import useSkribblBoilingAnimation from '../hooks/useSkribblBoilingAnimation.js'

// 8 Mascot Avatars displayed beneath the logo matching the reference design
const MASCOT_AVATARS = [
  { color: 3, eyes: 16, mouth: 14 }, // 1: Red
  { color: 5, eyes: 3, mouth: 2 },   // 2: Orange
  { color: 6, eyes: 6, mouth: 3 },   // 3: Yellow
  { color: 7, eyes: 10, mouth: 6 },  // 4: Green
  { color: 9, eyes: 7, mouth: 7 },   // 5: Cyan
  { color: 1, eyes: 8, mouth: 8 },   // 6: Blue
  { color: 11, eyes: 11, mouth: 10 }, // 7: Purple
  { color: 10, eyes: 12, mouth: 12 }, // 8: Pink
]

function ChunkyArrow({ direction = 'left', onClick, label }) {
  const isLeft = direction === 'left'
  return (
    <button
      type="button"
      className="sk-chunky-arrow"
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg 
        width="22" 
        height="26" 
        viewBox="0 0 22 26" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        style={{ transform: isLeft ? 'none' : 'scaleX(-1)' }}
      >
        {/* Outer thick black border */}
        <path 
          d="M15 3 L6 13 L15 23" 
          stroke="#000000" 
          strokeWidth="7" 
          strokeLinecap="square" 
          strokeLinejoin="miter" 
        />
        {/* Inner white fill chevron */}
        <path 
          d="M15 3 L6 13 L15 23" 
          stroke="#ffffff" 
          strokeWidth="3.2" 
          strokeLinecap="square" 
          strokeLinejoin="miter" 
        />
      </svg>
    </button>
  )
}

export default function SkribblHome({
  onCreateRoom,
  onJoinRoom,
  onExit,
  error,
  clearError
}) {
  // Activate boiling line stop-motion glitch animation on logo and mascots
  useSkribblBoilingAnimation()

  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('skribbl_player_name') || ''
    } catch {
      return ''
    }
  })

  const [avatar, setAvatar] = useState(() => {
    try {
      const saved = localStorage.getItem('skribbl_player_avatar')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed.color === 'number') return parsed
      }
    } catch {
      // ignore
    }
    return { color: 15, eyes: 1, mouth: 1 } // default classic brown avatar
  })

  // Detect room code from URL query (?room=XYZ)
  const [urlRoomCode] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('room') || ''
    } catch {
      return ''
    }
  })

  const [manualRoomCode, setManualRoomCode] = useState(urlRoomCode)
  const [showCodeInput, setShowCodeInput] = useState(Boolean(urlRoomCode))
  const [showScanner, setShowScanner] = useState(false)
  const [diceRolling, setDiceRolling] = useState(false)
  const [avatarPopping, setAvatarPopping] = useState(false)
  const nameInputRef = useRef(null)

  const triggerAvatarPop = () => {
    setAvatarPopping(true)
    setTimeout(() => setAvatarPopping(false), 280)
  }

  // Persist name and avatar to localStorage
  useEffect(() => {
    try {
      if (name) localStorage.setItem('skribbl_player_name', name)
    } catch {
      // ignore
    }
  }, [name])

  useEffect(() => {
    try {
      localStorage.setItem('skribbl_player_avatar', JSON.stringify(avatar))
    } catch {
      // ignore
    }
  }, [avatar])

  // Avatar cycling handlers
  const prevColor = () => {
    triggerAvatarPop()
    setAvatar(prev => ({
      ...prev,
      color: (prev.color - 1 + TOTAL_COLORS) % TOTAL_COLORS
    }))
  }
  const nextColor = () => {
    triggerAvatarPop()
    setAvatar(prev => ({
      ...prev,
      color: (prev.color + 1) % TOTAL_COLORS
    }))
  }

  const prevEyes = () => {
    triggerAvatarPop()
    setAvatar(prev => ({
      ...prev,
      eyes: prev.eyes <= 1 ? TOTAL_EYES : prev.eyes - 1
    }))
  }
  const nextEyes = () => {
    triggerAvatarPop()
    setAvatar(prev => ({
      ...prev,
      eyes: prev.eyes >= TOTAL_EYES ? 1 : prev.eyes + 1
    }))
  }

  const prevMouth = () => {
    triggerAvatarPop()
    setAvatar(prev => ({
      ...prev,
      mouth: prev.mouth <= 1 ? TOTAL_MOUTHS : prev.mouth - 1
    }))
  }
  const nextMouth = () => {
    triggerAvatarPop()
    setAvatar(prev => ({
      ...prev,
      mouth: prev.mouth >= TOTAL_MOUTHS ? 1 : prev.mouth + 1
    }))
  }

  const handleRandomize = () => {
    setDiceRolling(true)
    triggerAvatarPop()
    setAvatar(getRandomAvatar())
    setTimeout(() => setDiceRolling(false), 500)
  }

  const handlePlayClick = () => {
    if (!name.trim()) {
      if (nameInputRef.current) nameInputRef.current.focus()
      return
    }
    // If arriving with room code from invite URL or manual input, join directly!
    const targetRoom = (urlRoomCode || manualRoomCode).trim().toUpperCase()
    if (targetRoom) {
      onJoinRoom(targetRoom, name.trim(), avatar)
    } else {
      // If no room code, reveal manual room code input drawer
      setShowCodeInput(true)
    }
  }

  const handleCreateClick = () => {
    if (!name.trim()) {
      if (nameInputRef.current) nameInputRef.current.focus()
      return
    }
    onCreateRoom(name.trim(), avatar)
  }

  const handleManualJoin = () => {
    if (!name.trim()) {
      if (nameInputRef.current) nameInputRef.current.focus()
      return
    }
    const code = manualRoomCode.trim().toUpperCase()
    if (code) {
      onJoinRoom(code, name.trim(), avatar)
    }
  }

  return (
    <div className="sk-home-view">
      {/* Hidden SVG Filters for Logo and Avatar Line-Boil Border Wobble */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <filter id="sk-boil-filter" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence id="sk-boil-turb" type="fractalNoise" baseFrequency="0.02" numOctaves="2" result="noise" seed="42" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="sk-avatar-boil" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence id="sk-avatar-turb" type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="42" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

      {/* Top Header Logo + Mascot Avatars Strip */}
      <header className="sk-home-header">
        <div className="sk-home-logo-wrap">
          <img 
            src="/images/characters/skribbl/logo.webp" 
            alt="skribbl.io" 
            className="sk-home-logo-img"
            draggable={false}
          />
        </div>

        {/* 8 Mascots Lineup under Logo */}
        <div className="sk-home-mascots" aria-hidden="true">
          {MASCOT_AVATARS.map((m, idx) => (
            <div key={idx} className="sk-home-mascot-item" style={{ position: 'relative' }}>
              <SkribblAvatar 
                avatar={m} 
                size={42} 
                bouncy={true}
              />
              {idx === 6 && (
                <div className="sk-mascot-crown-wrap" aria-hidden="true">
                  <svg 
                    viewBox="0 0 32 26" 
                    className="sk-mascot-crown-svg"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      d="M 3 22 L 29 22 L 27 9 L 21 15 L 16 4 L 11 15 L 5 9 Z" 
                      fill="#ffd000" 
                      stroke="#000000" 
                      strokeWidth="2.5" 
                      strokeLinejoin="round" 
                      strokeLinecap="round" 
                    />
                    <path d="M 4.5 19 L 27.5 19" stroke="#000000" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="16" cy="4" r="1.6" fill="#ff2e55" stroke="#000000" strokeWidth="1.2" />
                    <circle cx="5" cy="9" r="1.4" fill="#3388ff" stroke="#000000" strokeWidth="1.2" />
                    <circle cx="27" cy="9" r="1.4" fill="#2bd652" stroke="#000000" strokeWidth="1.2" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </header>

      {/* Main Glass Card */}
      <main className="sk-home-card">
        {error && <SkribblError message={error} onDismiss={clearError} />}

        {/* Name Input Row */}
        <div className="sk-home-name-row">
          <input
            ref={nameInputRef}
            type="text"
            className="sk-home-name-input"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => {
              if (clearError) clearError()
              setName(e.target.value)
            }}
            maxLength={20}
            autoFocus
            autoComplete="nickname"
            spellCheck={false}
          />
        </div>

        {/* Avatar Customizer Box */}
        <div className="sk-home-avatar-box">
          {/* Centered tight stage: Left Arrows | Avatar | Right Arrows */}
          <div className="sk-home-avatar-stage">
            {/* Left Arrow Controls (Row 1: Eyes, Row 2: Mouth, Row 3: Color) */}
            <div className="sk-home-arrow-col sk-home-arrow-col--left">
              <ChunkyArrow direction="left" onClick={prevEyes} label="Previous Eyes" />
              <ChunkyArrow direction="left" onClick={prevMouth} label="Previous Mouth" />
              <ChunkyArrow direction="left" onClick={prevColor} label="Previous Color" />
            </div>

            {/* Central Live Assembled Avatar */}
            <div className="sk-home-avatar-center">
              <SkribblAvatar 
                avatar={avatar} 
                size={150} 
                bouncy={true} 
                pop={avatarPopping} 
              />
            </div>

            {/* Right Arrow Controls (Row 1: Eyes, Row 2: Mouth, Row 3: Color) */}
            <div className="sk-home-arrow-col sk-home-arrow-col--right">
              <ChunkyArrow direction="right" onClick={nextEyes} label="Next Eyes" />
              <ChunkyArrow direction="right" onClick={nextMouth} label="Next Mouth" />
              <ChunkyArrow direction="right" onClick={nextColor} label="Next Color" />
            </div>
          </div>

          {/* Authentic Skribbl Doodle Dice Button with ample breathing room */}
          <button
            type="button"
            className={`sk-home-dice-btn ${diceRolling ? 'is-rolling' : ''}`}
            onClick={handleRandomize}
            title="Randomize Avatar"
            aria-label="Randomize Avatar"
          >
            <img 
              src="/images/characters/skribbl/dice.webp" 
              alt="Randomize" 
              className="sk-home-dice-img"
              draggable={false}
            />
          </button>
        </div>

        {/* Action Buttons: Play! (Green) and Create Private Room (Blue) */}
        <div className="sk-home-actions">
          <button 
            type="button" 
            className="sk-home-btn sk-home-btn--play"
            onClick={handlePlayClick}
          >
            {urlRoomCode ? `Play! (Room ${urlRoomCode})` : 'Play!'}
          </button>

          <button 
            type="button" 
            className="sk-home-btn sk-home-btn--create"
            onClick={handleCreateClick}
          >
            Create Private Room
          </button>
        </div>

        {/* Room Code Entry Drawer / Input */}
        {showCodeInput ? (
          <div className="sk-home-join-drawer">
            <div className="sk-home-join-input-wrap">
              <input
                type="text"
                className="sk-home-join-code-input"
                placeholder="ROOM CODE"
                value={manualRoomCode}
                onChange={(e) => setManualRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="sk-home-qr-btn"
                onClick={() => setShowScanner(true)}
                title="Scan QR Code"
                aria-label="Scan QR Code"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
                </svg>
              </button>
              <button
                type="button"
                className="sk-home-btn-join-action"
                onClick={handleManualJoin}
                disabled={!manualRoomCode.trim()}
              >
                Join
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="sk-home-room-code-toggle"
            onClick={() => setShowCodeInput(true)}
          >
            Have a room code? Enter code
          </button>
        )}

        {/* Back to Game Modes */}
        <div className="sk-home-footer">
          <button 
            type="button"
            className="sk-home-exit-btn"
            onClick={onExit}
          >
            ← Back to Game Modes
          </button>
        </div>
      </main>

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScannerModal
          onClose={() => setShowScanner(false)}
          onScan={(code) => {
            setManualRoomCode(code.toUpperCase())
            setShowScanner(false)
          }}
          expectedMode="skribbl"
        />
      )}
    </div>
  )
}

