import { useEffect, useLayoutEffect, useRef, useState, useCallback, useReducer } from 'react'
import { createPortal } from 'react-dom'
import Button from '../components/Button.jsx'
import { WORD_CATEGORIES } from '../data/wordCategories.js'
import { SPECIAL_ROLES } from '../data/specialRoles.js'
import { GAME_PHASES, PLAYER_STATUS } from './gamePhases.js'
import {
  canStart, createInitialState, gameReducer, localPlayer,
  initSocket, emitCreateRoom, emitJoinRoom, emitLeaveRoom, emitPlayAgain,
  setDispatchRef, MEMBERSHIP,
  emitAddBots, emitRemoveBots,
} from './gameState.js'
import { disconnectSocket } from './socket.js'
import {
  getDefaultConfig,
  getMaximumUndercover, getMaximumMrWhite,
  getMaximumNonCivilians, calculateCivilianCount,
  MIN_PLAYERS, MAX_PLAYERS,
} from './roleBalance.js'
import CluePhase from './CluePhase.jsx'
import ResultPhase from './ResultPhase.jsx'
import PlayersPanel from './PlayersPanel.jsx'
import EliminationOverlay from './EliminationOverlay.jsx'
import GameMenu from './GameMenu.jsx'
import QRModal from './QRModal.jsx'
import QRScannerModal from './QRScannerModal.jsx'
import { readIdentity } from './identity.js'

function ErrorState({ children }) {
  return children ? <p className="online-error" role="alert">{children}</p> : null
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p>{message}</p>
        <div className="confirm-dialog__actions">
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}

function ActionMenu({ menu, onClose, onKick, onMakeHost }) {
  const { player, rect, context } = menu
  const menuRef = useRef(null)

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const top = rect.bottom + window.scrollY
  const left = Math.min(rect.left, window.innerWidth - 180)

  return createPortal(
    <div className="action-menu" style={{ top: top + 4, left }} ref={menuRef}>
      <div className="action-menu__header">
        {player.name}
      </div>
      {context === 'lobby' && (
        <button 
          className="action-menu__btn"
          onClick={() => { onMakeHost(player); onClose(); }}
        >
          Make Host
        </button>
      )}
      <button 
        className="action-menu__btn action-menu__btn--danger"
        onClick={() => { onKick(player); onClose(); }}
      >
        Kick Player
      </button>
    </div>,
    document.body
  )
}

function isStandalone() {
  return window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches
}

function RoomForm({ title, roomId, requiresRoomId, onSubmit, onBack, loading, joining }) {
  const savedSession = requiresRoomId ? readIdentity() : null
  const [name, setName] = useState('')
  const [room, setRoom] = useState(roomId || '')
  const [showQRScanner, setShowQRScanner] = useState(false)
  const [focusInputOnClose, setFocusInputOnClose] = useState(false)
  const [pasteError, setPasteError] = useState('')
  const [showHint, setShowHint] = useState(requiresRoomId && !!roomId && !isStandalone())
  const [copied, setCopied] = useState(false)

  const isRejoin = requiresRoomId && savedSession && savedSession.roomId && savedSession.roomId === room.trim().toUpperCase() && savedSession.playerName

  useEffect(() => {
    if (!showQRScanner && focusInputOnClose) {
      const input = document.getElementById('room-id-input')
      if (input) input.focus()
      setFocusInputOnClose(false)
    }
  }, [showQRScanner, focusInputOnClose])

  if (isRejoin) {
    return (
      <section className="online-panel">
        <span className="online-kicker">Previous game found</span>
        <h1>Welcome back</h1>
        <div style={{ margin: '24px 0', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '8px', color: 'var(--text-primary)' }}>{savedSession.playerName}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Room {savedSession.roomId}</div>
        </div>
        {joining && <p className="online-joining">Joining room...</p>}
        <div className="online-actions">
          <Button variant="primary" onClick={() => onSubmit(savedSession.playerName, savedSession.roomId)} disabled={loading || joining}>
            {joining ? 'Rejoining...' : loading ? 'Connecting...' : 'REJOIN GAME'}
          </Button>
          <Button onClick={onBack} disabled={loading || joining}>Back</Button>
        </div>
      </section>
    )
  }

  return (
    <section className="online-panel">
      <span className="online-kicker">Classified access</span>
      <h1>{title}</h1>
      <p>Identify yourself before entering the investigation.</p>
      <label>
        Player name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Investigator name"
          autoComplete="nickname"
          maxLength="24"
          disabled={loading || joining}
        />
      </label>
      {showHint && (
        <div className="join-hint">
          <button type="button" onClick={() => setShowHint(false)} className="join-hint__close">
            ✕
          </button>
          <p className="join-hint__text">
            Using the home-screen app? Copy the code, open the app, and paste it.
          </p>
          <Button 
            onClick={async () => {
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(room)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }
              } catch (e) {
                // Ignore silently
              }
            }} 
            style={{ padding: '6px 12px', fontSize: '1rem', width: 'auto' }}
          >
            {copied ? 'Copied' : 'Copy room code'}
          </Button>
        </div>
      )}
      {requiresRoomId && (
        <label>
          Room ID
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              id="room-id-input"
              value={room}
              onChange={(e) => { setRoom(e.target.value.toUpperCase()); setPasteError(''); }}
              placeholder="X7K9P2"
              maxLength="6"
              disabled={loading || joining}
              style={{ flex: 1, margin: 0 }}
            />
            <button
              type="button"
              className="room-copy"
              style={{ minWidth: '48px', height: '100%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => setShowQRScanner(true)}
              aria-label="Scan QR Code"
              title="Scan QR Code"
              disabled={loading || joining}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>
            </button>
            {isStandalone() && (
              <button
                type="button"
                className="room-copy"
                style={{ minWidth: '48px', height: '100%', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={async () => {
                  try {
                    setPasteError('')
                    if (!navigator.clipboard || !navigator.clipboard.readText) return
                    const text = await navigator.clipboard.readText()
                    if (!text) return
                    
                    let extracted = text.trim()
                    try {
                      const url = new URL(extracted)
                      const r = url.searchParams.get('room')
                      if (r) extracted = r
                    } catch (e) {}
                    
                    extracted = extracted.toUpperCase()
                    if (/^[A-Z0-9]{6}$/i.test(extracted)) {
                      setRoom(extracted)
                    } else {
                      setPasteError('Invalid code in clipboard')
                    }
                  } catch (e) {
                    // silently fail on denial or error
                  }
                }}
                aria-label="Paste Room Code"
                title="Paste Room Code"
                disabled={loading || joining}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                </svg>
              </button>
            )}
          </div>
          {pasteError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '4px', marginBottom: '0' }}>{pasteError}</p>}
        </label>
      )}
      {joining && (
        <p className="online-joining">Joining room...</p>
      )}
      <div className="online-actions">
        <Button variant="primary" onClick={() => onSubmit(name, room)} disabled={loading || joining}>
          {joining ? 'Joining...' : loading ? 'Connecting...' : requiresRoomId ? 'Join room' : 'Continue to configuration'}
        </Button>
        <Button onClick={onBack} disabled={loading || joining}>Back</Button>
      </div>
      {showQRScanner && (
        <QRScannerModal 
          onClose={(focusInput) => {
            setShowQRScanner(false)
            if (focusInput) setFocusInputOnClose(true)
          }} 
          onScan={(scannedRoom) => setRoom(scannedRoom)} 
        />
      )}
    </section>
  )
}

function PlayerSlider({ value, min, max, onChange, disabled }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [dragValue, setDragValue] = useState(null)
  const shownValue = dragging && dragValue !== null ? dragValue : value
  const percent = ((shownValue - min) / (max - min)) * 100

  const syncFromPosition = useCallback((clientX) => {
    if (!trackRef.current) return
    const trackEl = trackRef.current.querySelector('.player-slider__track') || trackRef.current
    const rect = trackEl.getBoundingClientRect()
    const raw = (clientX - rect.left) / rect.width
    const clamped = Math.max(0, Math.min(1, raw))
    const stepped = Math.round((clamped * (max - min) + min))
    const next = Math.max(min, Math.min(max, stepped))
    setDragValue(next)
    if (next !== value) onChange(next)
  }, [min, max, value, onChange])

  useEffect(() => {
    if (!dragging) return
    const onMove = (e) => {
      e.preventDefault()
      const x = e.touches ? e.touches[0].clientX : e.clientX
      syncFromPosition(x)
    }
    const onUp = () => {
      setDragging(false)
      setDragValue(null)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [dragging, syncFromPosition])

  const handleKeyDown = (e) => {
    if (disabled) return
    let next = shownValue
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(max, shownValue + 1)
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(min, shownValue - 1)
    else if (e.key === 'Home') next = min
    else if (e.key === 'End') next = max
    else return
    e.preventDefault()
    setDragValue(next)
    if (next !== value) onChange(next)
  }

  return (
    <div className={`player-slider ${disabled ? 'player-slider--disabled' : ''}`}>
      <div className="player-slider__label">
        <span className="player-slider__title">NUMBER OF PLAYERS</span>
        <span className="player-slider__value" key={`v-${shownValue}`}>{shownValue}</span>
      </div>
      <div
        className="player-slider__track-wrapper"
        ref={trackRef}
        onMouseDown={(e) => { if (!disabled) { setDragging(true); syncFromPosition(e.clientX) } }}
        onTouchStart={(e) => { if (!disabled) { setDragging(true); syncFromPosition(e.touches[0].clientX) } }}
      >
        <div className="player-slider__track">
          <div className="player-slider__fill" style={{ width: `${percent}%` }} />
          <div
            className="player-slider__thumb"
            style={{ left: `${percent}%` }}
            role="slider"
            aria-label="Number of players"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={shownValue}
            aria-valuetext={`${shownValue} players`}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={handleKeyDown}
          />
        </div>
      </div>
    </div>
  )
}

function RoleCapsule({ label, count, variant, onDecrease, onIncrease, showMinus, showPlus }) {
  return (
    <div className="role-count-row">
      <button
        className={`role-adjust-button role-adjust-button--minus${showMinus ? '' : ' is-hidden'}`}
        onClick={onDecrease}
        aria-label={`Decrease ${label.toLowerCase()} count`}
        tabIndex={showMinus ? 0 : -1}
      >
        −
      </button>
      <div className={`role-count-capsule role-count-capsule--${variant}`}>
        <span className="role-count-capsule__count" key={`n-${count}`}>{count}</span>
        <span className="role-count-capsule__label">{label}</span>
      </div>
      <button
        className={`role-adjust-button role-adjust-button--plus${showPlus ? '' : ' is-hidden'}`}
        onClick={onIncrease}
        aria-label={`Increase ${label.toLowerCase()} count`}
        tabIndex={showPlus ? 0 : -1}
      >
        +
      </button>
    </div>
  )
}

function ConfigurationPanel({ configuration, category, host, onChangeConfig, onChangeCategory }) {
  const { totalPlayers, undercover, mrWhite, revealRoles } = configuration
  const civilianCount = calculateCivilianCount(totalPlayers, undercover, mrWhite)
  const maxUC = getMaximumUndercover(totalPlayers, mrWhite)
  const maxMW = getMaximumMrWhite(totalPlayers, undercover)
  const ucAtMax = undercover >= maxUC
  const mwAtMax = mrWhite >= maxMW
  const ucAtMin = undercover <= 0
  const mwAtMin = mrWhite <= 0
  const maxNon = getMaximumNonCivilians(totalPlayers)

  const handlePlayerCountChange = (newCount) => {
    const def = getDefaultConfig(newCount)
    onChangeConfig({
      totalPlayers: def.totalPlayers,
      undercover: def.undercover,
      mrWhite: def.mrWhite,
    })
  }

  const handleUCIncrease = () => {
    const next = undercover + 1
    if (next + mrWhite <= maxNon) {
      onChangeConfig({ totalPlayers, undercover: next, mrWhite })
    } else if (undercover === 0 && mrWhite > 0) {
      onChangeConfig({ totalPlayers, undercover: 1, mrWhite: mrWhite - 1 })
    }
  }

  const handleUCDecrease = () => {
    if (ucAtMin) return
    const nextUC = undercover - 1
    let nextMW = mrWhite
    if (nextUC === 0 && nextMW === 0) {
      nextMW = 1
    }
    onChangeConfig({ totalPlayers, undercover: nextUC, mrWhite: nextMW })
  }

  const handleMWIncrease = () => {
    const next = mrWhite + 1
    if (undercover + next <= maxNon) {
      onChangeConfig({ totalPlayers, undercover, mrWhite: next })
    } else if (mrWhite === 0 && undercover > 0) {
      onChangeConfig({ totalPlayers, undercover: undercover - 1, mrWhite: 1 })
    }
  }

  const handleMWDecrease = () => {
    if (mwAtMin) return
    const nextMW = mrWhite - 1
    let nextUC = undercover
    if (nextUC === 0 && nextMW === 0) {
      nextUC = 1
    }
    onChangeConfig({ totalPlayers, undercover: nextUC, mrWhite: nextMW })
  }

  const handleToggleRevealRoles = () => {
    onChangeConfig({ revealRoles: !revealRoles })
  }

  return (
    <aside className="online-config">
      <span className="online-kicker">Host configuration</span>

      <PlayerSlider
        value={totalPlayers}
        min={MIN_PLAYERS}
        max={MAX_PLAYERS}
        onChange={handlePlayerCountChange}
        disabled={!host}
      />

      <span className="online-kicker">Role distribution</span>

      <div className="role-counts">
        <div className="role-count-capsule role-count-capsule--civilian">
          <span className="role-count-capsule__count" key={`c-${civilianCount}`}>{civilianCount}</span>
          <span className="role-count-capsule__label">Civilians</span>
        </div>

        <RoleCapsule
          label="Undercovers"
          count={undercover}
          variant="undercover"
          onDecrease={handleUCDecrease}
          onIncrease={handleUCIncrease}
          showMinus={host && !ucAtMin}
          showPlus={host && (!ucAtMax || (undercover === 0 && mrWhite > 0))}
        />

        <RoleCapsule
          label="Mr. White"
          count={mrWhite}
          variant="mrwhite"
          onDecrease={handleMWDecrease}
          onIncrease={handleMWIncrease}
          showMinus={host && !mwAtMin}
          showPlus={host && (!mwAtMax || (mrWhite === 0 && undercover > 0))}
        />
      </div>

      <div className="config-field config-field--toggle">
        <span className="config-field__label">Reveal Roles</span>
        <button
          type="button"
          role="switch"
          aria-checked={!!revealRoles}
          disabled={!host}
          onClick={handleToggleRevealRoles}
          className={`toggle-switch ${revealRoles ? 'toggle-switch--active' : ''}`}
          aria-label={`Reveal Roles is ${revealRoles ? 'ON' : 'OFF'}. Click to toggle.`}
        >
          <span className="toggle-switch__track">
            <span className="toggle-switch__knob" />
          </span>
          <span className="toggle-switch__text">{revealRoles ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      <SpecialRolesConfig 
        configuration={configuration} 
        host={host} 
        onChangeConfig={onChangeConfig} 
        totalPlayers={totalPlayers} 
      />

      <label className="config-field">
        <span className="config-field__label">Word category</span>
        <select
          className="word-category-select"
          disabled={!host}
          value={category}
          onChange={(e) => onChangeCategory(e.target.value)}
        >
          {WORD_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.label}</option>
          ))}
        </select>
      </label>
    </aside>
  )
}

function SpecialRoleAvatar({ role }) {
  return (
    <div className="special-role-avatar-frame">
      {role.avatar ? (
        <img 
          src={role.avatar} 
          alt={role.name} 
          className="special-role-avatar-img"
        />
      ) : (
        <div className="special-role-avatar-placeholder" aria-hidden="true">
          <svg 
            className="special-role-avatar-placeholder__icon" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </div>
      )}
    </div>
  )
}

function SpecialRoleInfoModal({ role, onClose, originRect }) {
  const [animationState, setAnimationState] = useState('opening')
  const modalRef = useRef(null)
  const [originStyle, setOriginStyle] = useState({})

  // Compute spatial offset from button center to modal center
  useLayoutEffect(() => {
    if (originRect && modalRef.current) {
      const modalRect = modalRef.current.getBoundingClientRect()
      const modalCenterX = modalRect.left + modalRect.width / 2
      const modalCenterY = modalRect.top + modalRect.height / 2
      const sourceCenterX = originRect.left + originRect.width / 2
      const sourceCenterY = originRect.top + originRect.height / 2

      const tx = sourceCenterX - modalCenterX
      const ty = sourceCenterY - modalCenterY

      setOriginStyle({
        '--origin-tx': `${tx}px`,
        '--origin-ty': `${ty}px`,
        '--exit-tx': `${tx}px`,
        '--exit-ty': `${ty}px`,
      })
    }
  }, [originRect])

  const handleClose = useCallback(() => {
    if (animationState === 'closing') return

    if (originRect && modalRef.current) {
      const modalRect = modalRef.current.getBoundingClientRect()
      const modalCenterX = modalRect.left + modalRect.width / 2
      const modalCenterY = modalRect.top + modalRect.height / 2
      const sourceCenterX = originRect.left + originRect.width / 2
      const sourceCenterY = originRect.top + originRect.height / 2

      const tx = sourceCenterX - modalCenterX
      const ty = sourceCenterY - modalCenterY

      setOriginStyle((prev) => ({
        ...prev,
        '--exit-tx': `${tx}px`,
        '--exit-ty': `${ty}px`,
      }))
    }

    setAnimationState('closing')
  }, [animationState, originRect])

  useEffect(() => {
    const handleEsc = (e) => e.key === 'Escape' && handleClose()
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [handleClose])

  // Prevent background scroll jump on open/close
  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPaddingRight = document.body.style.paddingRight
    const scrollY = window.scrollY

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPaddingRight
      if (window.scrollY !== scrollY) {
        window.scrollTo(0, scrollY)
      }
    }
  }, [])

  const isClosing = animationState === 'closing'

  const handleAnimationEnd = (e) => {
    if (animationState === 'closing' && (e.animationName === 'roleModalFadeOut' || e.animationName === 'roleCardExit')) {
      onClose()
    }
  }

  const modalContent = (
    <div 
      className={`special-role-modal-overlay ${isClosing ? 'special-role-modal-overlay--closing' : ''}`} 
      onClick={handleClose}
      onAnimationEnd={handleAnimationEnd}
      role="presentation"
    >
      <div 
        ref={modalRef} 
        className={`special-role-modal-card ${isClosing ? 'special-role-modal-card--closing' : 'special-role-modal-card--opening'}`} 
        style={originStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="special-role-card-title"
      >
        <button 
          type="button"
          className="special-role-modal-close" 
          onClick={handleClose} 
          aria-label="Close character details"
        >
          &times;
        </button>

        <div className="special-role-modal-card__header">
          <SpecialRoleAvatar role={role} />
          <h2 id="special-role-card-title" className="special-role-modal-card__title">{role.name}</h2>
          <span className="special-role-modal-card__tagline">Special Character</span>
        </div>

        <div className="special-role-modal-card__divider" aria-hidden="true" />

        <div className="special-role-modal-card__section">
          <span className="special-role-modal-card__section-label">Description</span>
          <p className="special-role-modal-card__desc">{role.description}</p>
        </div>

        <div className="special-role-modal-card__divider" aria-hidden="true" />

        <div className="special-role-modal-card__section">
          <span className="special-role-modal-card__section-label">Game Rules</span>
          <ul className="special-role-modal-card__rules">
            {role.rules.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </div>

        <div className="special-role-modal-card__divider" aria-hidden="true" />

        <div className="special-role-modal-card__footer">
          <span className="special-role-modal-card__requirement">
            Requires at least {role.minPlayers} players to be enabled in game
          </span>
          <div className="special-role-modal-card__actions">
            <Button onClick={handleClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(modalContent, document.body)
}

function SpecialRolesConfig({ configuration, host, onChangeConfig, totalPlayers }) {
  const [expanded, setExpanded] = useState(false)
  const [activeRoleInfo, setActiveRoleInfo] = useState(null)
  const [activeRect, setActiveRect] = useState(null)

  // Mobile Full-Screen Panel State
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const [animState, setAnimState] = useState('')
  const [triggerRect, setTriggerRect] = useState(null)
  
  const handleToggle = (key) => {
    if (!host) return
    const specialRoles = { ...configuration.specialRoles }
    specialRoles[key] = !specialRoles[key]
    onChangeConfig({ specialRoles })
  }
  
  const handleInfo = (e, role) => {
    e.stopPropagation()
    const btn = e.currentTarget
    const rect = btn.getBoundingClientRect()
    setActiveRect(rect)
    setActiveRoleInfo(role)
  }

  const handleMobileOpen = (e) => {
    setTriggerRect(e.currentTarget.getBoundingClientRect())
    setAnimState('ENTERING')
    setMobileExpanded(true)
  }

  const handleMobileClose = () => {
    setAnimState('EXITING')
  }

  useEffect(() => {
    if (animState === 'ENTERING') {
      const timer = setTimeout(() => setAnimState('OPEN'), 500)
      return () => clearTimeout(timer)
    }
    if (animState === 'EXITING') {
      const timer = setTimeout(() => {
        setAnimState('')
        setMobileExpanded(false)
      }, 480)
      return () => clearTimeout(timer)
    }
  }, [animState])

  const getOriginVars = useCallback(() => {
    if (!triggerRect) return {}
    const vw = window.innerWidth
    const vh = window.innerHeight
    const bx = triggerRect.left + triggerRect.width / 2
    const by = triggerRect.top + triggerRect.height / 2
    const px = vw / 2
    const py = vh / 2
    return {
      '--fly-tx': `${bx - px}px`,
      '--fly-ty': `${by - py}px`,
    }
  }, [triggerRect])

  const activeRolesCount = SPECIAL_ROLES.filter(r => configuration?.specialRoles?.[r.key]).length

  return (
    <div className={`special-roles-section ${expanded ? 'special-roles-section--expanded' : ''}`}>
      <button 
        type="button" 
        className="special-roles-header special-roles-header--desktop" 
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        <div className="special-roles-header__title-group">
          <span className="special-roles-header__indicator" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </span>
          <span className="special-roles-header__label">Special Roles</span>
        </div>
        
        <div className="special-roles-header__status">
          {activeRolesCount > 0 && (
            <span className="special-roles-header__count">
              {activeRolesCount} Active
            </span>
          )}
          <span className={`special-roles-header__chevron ${expanded ? 'special-roles-header__chevron--open' : ''}`} aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>

      <button
        type="button"
        className="special-roles-header-mobile"
        onClick={handleMobileOpen}
        aria-expanded={mobileExpanded}
      >
        <div className="special-roles-header-mobile__inner">
          <div className="special-roles-header-mobile__characters">
            {SPECIAL_ROLES.map(role => {
              const enabled = configuration.specialRoles?.[role.key]
              const triggerAsset = role.avatar ? role.avatar.replace('.png', '-bg.png') : ''
              
              const MOBILE_TRIGGER_LAYOUT = {
                boomerang: { scale: 1.236, translateY: 10.222 },
                duelists: { scale: 1.266, translateY: 9.375 },
                falafelVendor: { scale: 1.38, translateY: 10.667 },
                ghost: { scale: 1.786, translateY: 25.333 },
                goddessOfJustice: { scale: 1.112, translateY: 3.132 },
                joyFool: { scale: 1.334, translateY: 12.304 },
                lovers: { scale: 1.049, translateY: 2.536 },
                mrMeme: { scale: 1.388, translateY: 14.318 },
                revenger: { scale: 1.136, translateY: 5.778 }
              }
              const layout = MOBILE_TRIGGER_LAYOUT[role.key] || { scale: 1, translateY: 0 }

              return (
                <div key={role.key} className="mobile-trigger-char">
                  {triggerAsset && (
                    <div 
                      className="mobile-trigger-char__wrapper"
                      style={{
                        transform: `scale(${layout.scale}) translateY(${layout.translateY}%)`,
                        transformOrigin: 'bottom center',
                        width: '100%',
                        height: '100%',
                        position: 'relative'
                      }}
                    >
                      <img src={triggerAsset} alt="" className="mobile-trigger-char__color" />
                      <div 
                        className={`mobile-trigger-char__mask ${enabled ? 'mobile-trigger-char__mask--hidden' : ''}`}
                        style={{ WebkitMaskImage: `url(${triggerAsset})`, maskImage: `url(${triggerAsset})` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {activeRolesCount > 0 && (
            <div className="special-roles-header-mobile__badge">{activeRolesCount}</div>
          )}
        </div>
      </button>
      
      <div className={`special-roles-dropdown-wrapper ${expanded ? 'special-roles-dropdown-wrapper--open' : ''}`}>
        <div className="special-roles-list-inner">
          <div className="special-roles-list">
            {SPECIAL_ROLES.map(role => {
              const enabled = configuration.specialRoles?.[role.key]
              const canEnable = totalPlayers >= role.minPlayers
              const unavailable = !canEnable
              
              return (
                <div 
                  key={role.key} 
                  className={`special-role-row special-role-card ${unavailable ? 'special-role-row--disabled special-role-card--disabled' : ''} ${enabled ? 'special-role-row--active special-role-card--enabled' : ''}`}
                >
                  <div className="special-role-row__leading">
                    <span className={`special-role-row__avatar-badge ${role.avatar ? 'special-role-row__avatar-badge--has-art' : ''}`} aria-hidden="true">
                      {role.avatar ? (
                        <img src={role.avatar} alt="" className="special-role-row__art" />
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      )}
                    </span>
                    <div className="special-role-row__info special-role-card__main">
                      <span className="special-role-row__name special-role-card__name">{role.name}</span>
                      <span className="special-role-row__requirement special-role-card__req">
                        {unavailable ? `Requires ${role.minPlayers} players` : `Min ${role.minPlayers} players`}
                      </span>
                    </div>
                  </div>
                  
                  <div className="special-role-row__actions special-role-card__actions">
                    <button 
                      type="button" 
                      className="special-role-info-btn special-role-card__info-btn" 
                      onClick={(e) => handleInfo(e, role)}
                      aria-label={`View ${role.name} details`}
                      title={`View ${role.name} details`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>
                    
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!enabled}
                      disabled={!host || unavailable}
                      onClick={() => handleToggle(role.key)}
                      className={`toggle-switch ${enabled ? 'toggle-switch--active' : ''}`}
                      aria-label={`Toggle ${role.name}`}
                    >
                      <span className="toggle-switch__track">
                        <span className="toggle-switch__knob" />
                      </span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      
      {mobileExpanded && createPortal(
        <div className={`players-panel-overlay ${animState === 'ENTERING' ? 'players-panel-overlay--entering' : animState === 'EXITING' ? 'players-panel-overlay--exiting' : 'players-panel-overlay--open'}`} style={{ zIndex: 1000000 }}>
          <div className={`players-panel special-roles-mobile-panel ${animState === 'ENTERING' ? 'players-panel--entering' : animState === 'EXITING' ? 'players-panel--exiting' : 'players-panel--open'}`} style={{ ...getOriginVars(), maxWidth: 'none', width: '100vw', height: '100dvh', maxHeight: 'none', borderRadius: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
            <header className="special-roles-mobile-panel__header">
              <h2 className="special-roles-mobile-panel__title">Special Roles</h2>
              <button className="players-panel-close" onClick={handleMobileClose} aria-label="Close special roles" style={{ position: 'static' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>
            <div className="special-roles-mobile-panel__content">
              {SPECIAL_ROLES.map(role => {
                const MOBILE_ROLE_COLORS = {
                  joyFool: '#8b5cf6', // purple
                  boomerang: '#f43f5e', // coral/red
                  goddessOfJustice: '#22c55e', // bright green
                  ghost: '#3b82f6', // bright blue
                  lovers: '#ec4899', // pink/magenta
                  mrMeme: '#6366f1', // slate/royal blue
                  falafelVendor: '#eab308', // golden yellow
                  revenger: '#06b6d4', // cyan/turquoise
                  duelists: '#f97316' // warm peach/orange
                }
                const enabled = configuration.specialRoles?.[role.key]
                const canEnable = totalPlayers >= role.minPlayers
                const unavailable = !canEnable
                const activeColor = MOBILE_ROLE_COLORS[role.key] || 'var(--accent)'
                
                return (
                  <label 
                    key={role.key} 
                    className={`special-role-mobile-row ${unavailable ? 'special-role-mobile-row--disabled' : ''} ${enabled ? 'special-role-mobile-row--active' : ''}`}
                    style={enabled ? { backgroundColor: activeColor, borderColor: activeColor, '--active-role-bg': activeColor } : {}}
                    onClick={(e) => {
                      if (e.target.closest('button')) return;
                      e.preventDefault();
                      if (!unavailable && host) handleToggle(role.key);
                    }}
                  >
                    <div className="special-role-mobile-row__art-container">
                      {role.avatar && <img src={role.avatar.replace('.png', '-bg.png')} alt="" className="special-role-mobile-row__art" />}
                    </div>
                    <div className="special-role-mobile-row__info">
                      <div className="special-role-mobile-row__name-group">
                        <span className="special-role-mobile-row__name">{role.name}</span>
                      </div>
                      <span className="special-role-mobile-row__desc">
                        {role.description}
                      </span>
                      {unavailable && <span className="special-role-mobile-row__req">Requires {role.minPlayers} players</span>}
                    </div>
                    <div className="special-role-mobile-row__action">
                      <div className={`special-role-mobile-checkbox ${enabled ? 'special-role-mobile-checkbox--checked' : ''}`}>
                        {enabled && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {activeRoleInfo && (
        <SpecialRoleInfoModal 
          role={activeRoleInfo} 
          onClose={() => setActiveRoleInfo(null)} 
          originRect={activeRect}
        />
      )}
    </div>
  )
}

function PlayerListItem({ player, index, host, onActionRequest }) {
  const timerRef = useRef(null)
  const isTouchRef = useRef(false)
  const canAction = host && !player.isHost

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handleTouchStart = (e) => {
    isTouchRef.current = true
    if (!canAction) return
    const rect = e.currentTarget.getBoundingClientRect()
    timerRef.current = setTimeout(() => {
      onActionRequest(player, rect, 'lobby')
    }, 600)
  }

  const handleClick = (e) => {
    if (isTouchRef.current) return
    if (!canAction) return
    onActionRequest(player, e.currentTarget.getBoundingClientRect(), 'lobby')
  }

  return (
    <article 
      className="online-player" 
      style={{ animationDelay: `${index * 50}ms`, userSelect: canAction ? 'none' : 'auto', WebkitUserSelect: canAction ? 'none' : 'auto', cursor: canAction ? 'pointer' : 'default' }}
      onTouchStart={handleTouchStart}
      onTouchMove={clearTimer}
      onTouchEnd={clearTimer}
      onTouchCancel={clearTimer}
      onClick={handleClick}
      onContextMenu={(e) => {
        if (!canAction) return
        e.preventDefault()
      }}
    >
      <span className="online-player__index">Player {String(index + 1).padStart(2, '0')}</span>
      <span className="online-player__name">{player.name}</span>
      <span className="online-player__meta">
        {player.isHost && <span className="online-player__badge">HOST</span>}
        <span className={`online-player__status online-player__status--${player.status?.toLowerCase()}`}>
          {player.status}
        </span>
      </span>
    </article>
  )
}

function PlayerList({ players, settings, host, onActionRequest }) {
  return (
    <div className="player-list">
      <div className="player-list__header">
        <h2>PLAYERS</h2>
        <span className="player-list__count">
          {players.length} / {settings.totalPlayers}
        </span>
      </div>
      <div className="player-list__body">
        {players.map((player, index) => (
          <PlayerListItem key={player.id} player={player} index={index} host={host} onActionRequest={onActionRequest} />
        ))}
        {players.length === 0 && (
          <div className="player-list__empty">No investigators yet.</div>
        )}
      </div>
    </div>
  )
}

export default function OnlineGame({ onExit }) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const [showGameMenu, setShowGameMenu] = useState(false)
  const [playersBtnRect, setPlayersBtnRect] = useState(null)
  const [menuBtnRect, setMenuBtnRect] = useState(null)
  const [sourceRect, setSourceRect] = useState(null)
  const [localElimination, setLocalElimination] = useState(null)
  const [kickTarget, setKickTarget] = useState(null)
  const [makeHostTarget, setMakeHostTarget] = useState(null)
  const [actionMenu, setActionMenu] = useState(null)
  const [showQR, setShowQR] = useState(false)
  const [qrBtnRect, setQrBtnRect] = useState(null)
  const socketRef = useRef(null)
  const playersBtnRef = useRef(null)
  const menuBtnRef = useRef(null)

  const handleActionRequest = useCallback((player, rect, context) => {
    setActionMenu({ player, rect, context })
  }, [])

  const handleKickRequest = useCallback((player) => {
    setKickTarget(player)
  }, [])

  const handleMakeHostRequest = useCallback((player) => {
    setMakeHostTarget(player)
  }, [])

  const confirmKick = useCallback(() => {
    if (!socketRef.current || !kickTarget) return
    socketRef.current.emit('host-kick-player', { targetId: kickTarget.id }, (res) => {
      if (res?.error) {
        dispatch({ type: 'SET_ERROR', error: res.error })
      }
    })
    setKickTarget(null)
  }, [kickTarget])

  const confirmMakeHost = useCallback(() => {
    if (!socketRef.current || !makeHostTarget) return
    socketRef.current.emit('host-make-host', { targetId: makeHostTarget.id }, (res) => {
      if (res?.error) {
        dispatch({ type: 'SET_ERROR', error: res.error })
      }
    })
    setMakeHostTarget(null)
  }, [makeHostTarget])

  useEffect(() => {
    if (state.eliminationResult) {
      setLocalElimination(state.eliminationResult)
    } else if (localElimination) {
      const t = setTimeout(() => {
        setLocalElimination(null)
      }, 2000)
      return () => clearTimeout(t)
    }
  }, [state.eliminationResult, localElimination])

  const host = state.hostId === state.sessionId
  const me = localPlayer(state)
  const inRoom = state.membershipState === MEMBERSHIP.JOINED

  const handleExit = useCallback(async () => {
    if (inRoom && socketRef.current) {
      await emitLeaveRoom(socketRef.current)
    }
    disconnectSocket()
    onExit()
  }, [onExit, inRoom])

  useEffect(() => {
    setDispatchRef(dispatch)
    const socket = initSocket(state.sessionId)
    socketRef.current = socket
    if (!socket.connected) {
      socket.connect()
    }
    return () => {
    }
  }, [state.sessionId])

  // Auto-open Join Room if room param is present on startup
  useEffect(() => {
    if (state.phase === GAME_PHASES.MODE_SELECTION || state.phase === GAME_PHASES.ONLINE_SETUP) {
      const params = new URLSearchParams(window.location.search)
      if (params.get('room')) {
        dispatch({ type: 'OPEN_JOIN' })
      }
    }
  }, [state.phase])

  // Safety timeout: if we're stuck in RESTORING_SESSION for too long,
  // fall back to the normal flow. The server should respond with either
  // session-reconnected or session-no-room well before this fires.
  useEffect(() => {
    if (state.phase !== GAME_PHASES.RESTORING_SESSION) return
    const timer = setTimeout(() => {
      console.warn('[SESSION] restore timeout — falling back to normal flow')
      dispatch({ type: 'SESSION_NO_ROOM' })
    }, 6000)
    return () => clearTimeout(timer)
  }, [state.phase])

  useEffect(() => {
    if (state.membershipState === MEMBERSHIP.LEAVING) {
      if (socketRef.current) {
        emitLeaveRoom(socketRef.current).then((result) => {
          if (result.error) {
            dispatch({ type: 'SET_ERROR', error: result.error })
          }
        })
      }
    }
  }, [state.membershipState])

  const handleCreateRoom = useCallback(async (name) => {
    if (!socketRef.current) return
    setLoading(true)
    dispatch({ type: 'SET_ERROR', error: '' })
    const result = await emitCreateRoom(socketRef.current, state.sessionId, name.trim())
    setLoading(false)
    if (result.error) {
      dispatch({ type: 'SET_ERROR', error: result.error })
    } else {
      dispatch({ type: 'ROOM_CREATED', room: result.room })
    }
  }, [state.sessionId])

  const handleJoinRoom = useCallback(async (name, roomId) => {
    if (!socketRef.current) return
    setJoining(true)
    setLoading(true)
    dispatch({ type: 'SET_ERROR', error: '' })
    dispatch({ type: 'UPDATE_FIELD', field: 'membershipState', value: MEMBERSHIP.JOINING })
    const result = await emitJoinRoom(socketRef.current, state.sessionId, roomId, name.trim())
    setLoading(false)
    setJoining(false)
    if (result.error) {
      dispatch({ type: 'SET_ERROR', error: result.error })
    } else if (result.room) {
      dispatch({ type: 'ROOM_CREATED', room: result.room })
    }
  }, [state.sessionId])

  const handleLeaveRoom = useCallback(() => {
    setShowLeaveConfirm(true)
  }, [])

  const confirmLeave = useCallback(() => {
    setShowLeaveConfirm(false)
    dispatch({ type: 'LEAVE_ROOM' })
  }, [])

  const handleToggleReady = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('toggle-ready')
  }, [])

  const handleConfigChange = useCallback((config) => {
    if (!socketRef.current) return
    socketRef.current.emit('update-config', config)
  }, [])

  const handleCategoryChange = useCallback((category) => {
    if (!socketRef.current) return
    socketRef.current.emit('update-category', { category })
  }, [])

  const handleStart = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('start-game')
  }, [])

  const handleCopyRoomId = useCallback(() => {
    navigator.clipboard?.writeText(state.roomId)
    dispatch({ type: 'COPY_ROOM' })
  }, [state.roomId])

  const handleAddBots = useCallback(async () => {
    if (!socketRef.current) return
    const result = await emitAddBots(socketRef.current)
    if (result.error) dispatch({ type: 'SET_ERROR', error: result.error })
  }, [])

  const handleRemoveBots = useCallback(async () => {
    if (!socketRef.current) return
    const result = await emitRemoveBots(socketRef.current)
    if (result.error) dispatch({ type: 'SET_ERROR', error: result.error })
  }, [])

  const handlePlayAgain = useCallback(async () => {
    if (!socketRef.current) return
    const result = await emitPlayAgain(socketRef.current)
    if (result.error) dispatch({ type: 'SET_ERROR', error: result.error })
  }, [])

  let content

  let activePhase = state.phase
  if (activePhase === GAME_PHASES.RESULT_PHASE && me?.playAgain) {
    activePhase = GAME_PHASES.ROOM_LOBBY
  }

  if (activePhase === GAME_PHASES.RESTORING_SESSION) {
    content = (
      <section className="online-panel online-panel--mode">
        <span className="online-kicker">Reconnecting</span>
        <h1>Restoring session…</h1>
        <p>Recovering your investigation. Please wait.</p>
        <div className="restore-spinner" aria-label="Loading" />
      </section>
    )
  } else if (activePhase === GAME_PHASES.MODE_SELECTION) {
    content = (
      <section className="online-panel online-panel--mode">
        <span className="online-kicker">Case File #001</span>
        <h1>Enter the investigation</h1>
        <p>Select your game mode.</p>
        <div className="mode-cards">
          <button className="mode-card mode-card--active" onClick={() => dispatch({ type: 'SELECT_ONLINE' })}>
            <strong>Online</strong>
            <span>Play with others</span>
            <small>Available</small>
          </button>
          <button className="mode-card" disabled>
            <strong>Pass &amp; Play</strong>
            <span>Local game</span>
            <small>Coming soon</small>
          </button>
        </div>
        <Button onClick={handleExit}>Return to case overview</Button>
      </section>
    )
  } else if (activePhase === GAME_PHASES.ONLINE_SETUP) {
    const savedSession = readIdentity()
    const hasSession = !!(savedSession && savedSession.roomId && savedSession.playerName)

    content = (
      <section className="online-panel">
        <span className="online-kicker">Online investigation</span>
        <h1>Create or join</h1>
        <p>Open a new case file or enter an existing room ID.</p>
        {joining && <p className="online-joining">Rejoining room...</p>}
        <div className="online-actions">
          <Button 
            variant={hasSession ? undefined : 'primary'} 
            onClick={() => dispatch({ type: 'OPEN_CREATE' })}
            disabled={loading || joining}
          >
            Create room
          </Button>
          <Button 
            onClick={() => dispatch({ type: 'OPEN_JOIN' })}
            disabled={loading || joining}
            >
            Join room
          </Button>
            {hasSession && (
              <Button 
                variant="primary" 
                onClick={() => handleJoinRoom(savedSession.playerName, savedSession.roomId)} 
                disabled={loading || joining}
              >
                {joining ? 'Rejoining...' : `Rejoin`}
              </Button>
            )}
          <Button 
            onClick={() => dispatch({ type: 'BACK_TO_MODE' })}
            disabled={loading || joining}
          >
            Back
          </Button>
        </div>
      </section>
    )
  } else if (activePhase === GAME_PHASES.CREATE_ROOM) {
    content = (
      <RoomForm
        title="Create room"
        onBack={() => dispatch({ type: 'SELECT_ONLINE' })}
        onSubmit={(name) => handleCreateRoom(name)}
        loading={loading}
      />
    )
  } else if (activePhase === GAME_PHASES.JOIN_ROOM) {
    const params = new URLSearchParams(window.location.search)
    const roomParam = params.get('room') || ''
    
    content = (
      <RoomForm
        title="Join room"
        requiresRoomId
        roomId={roomParam}
        onBack={() => {
          if (roomParam) {
            window.history.replaceState({}, '', window.location.pathname)
          }
          dispatch({ type: 'SELECT_ONLINE' })
        }}
        onSubmit={(name, roomId) => handleJoinRoom(name, roomId)}
        loading={loading}
        joining={joining}
      />
    )
  } else if (activePhase === GAME_PHASES.ROOM_LOBBY) {
    const getJoinUrl = () => {
      const origin = import.meta.env.PROD ? 'https://investigation-room.vercel.app' : window.location.origin
      return `${origin}/?room=${state.roomId}`
    }

    const handleCopyUrl = (e) => {
      const url = getJoinUrl()
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url)
      } else {
        // fallback
        const textArea = document.createElement("textarea")
        textArea.value = url
        document.body.appendChild(textArea)
        textArea.select()
        try { document.execCommand('copy') } catch (err) {}
        document.body.removeChild(textArea)
      }
    }

    const handleCopyRoomIdClick = () => {
      navigator.clipboard.writeText(state.roomId).then(() => {
        dispatch({ type: 'COPY_ROOM' })
        setTimeout(() => dispatch({ type: 'UPDATE_FIELD', field: 'copied', value: false }), 2000)
      })
    }

    const handleQROpen = (e) => {
      setQrBtnRect(e.currentTarget.getBoundingClientRect())
      setShowQR(true)
    }

    content = (
      <section className="online-panel online-panel--lobby">
        <header className="online-room-head">
          <span className="online-kicker">Online investigation</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', width: '100%', marginBottom: '16px' }}>
            <h1 style={{ margin: 0 }}>Room <b>{state.roomId}</b></h1>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="room-copy" style={{ minWidth: '44px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleCopyRoomIdClick} aria-label="Copy Room ID" title="Copy Room ID">
                {state.copied ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                )}
              </button>
              <button className="room-copy" style={{ minWidth: '44px', padding: '0', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleQROpen} aria-label="Show QR Code" title="Share via QR Code">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><line x1="9" y1="9" x2="15" y2="15" /><line x1="15" y1="9" x2="9" y2="15" /></svg>
              </button>
            </div>
          </div>
        </header>
        <div className="online-lobby-grid">
          <div className="online-lobby__players">
            <PlayerList players={state.players} settings={state.configuration} host={host} onActionRequest={handleActionRequest} />
            {!host && (
              <Button variant="primary" className="online-ready-btn" onClick={handleToggleReady}>
                {me?.status === PLAYER_STATUS.READY ? 'Mark not ready' : 'Mark ready'}
              </Button>
            )}
            {import.meta.env.VITE_DEV_BOTS_ENABLED === 'true' && host && (
              <div style={{ marginTop: '16px', padding: '16px', border: '1px dashed var(--danger)', borderRadius: '8px' }}>
                <span className="online-kicker" style={{ color: 'var(--danger)' }}>DEV ONLY</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <Button onClick={handleAddBots} style={{ flex: 1, fontSize: '0.8rem' }}>+ ADD 4 BOTS</Button>
                  <Button onClick={handleRemoveBots} style={{ flex: 1, fontSize: '0.8rem' }}>REMOVE BOTS</Button>
                </div>
              </div>
            )}
          </div>
          <ConfigurationPanel
            configuration={state.configuration}
            category={state.category}
            host={host}
            onChangeConfig={handleConfigChange}
            onChangeCategory={handleCategoryChange}
          />
          <div className="online-lobby__start">
            {host ? (
              <Button variant="primary" disabled={!canStart(state)} onClick={handleStart}>
                Start investigation
              </Button>
            ) : (
              <p className="online-lobby__waiting">Waiting for host to start the investigation.</p>
            )}
          </div>
        </div>
        <div className="online-lobby__footer">
          <Button variant="danger" onClick={handleLeaveRoom}>
            Leave room
          </Button>
        </div>
      </section>
    )
  } else if (activePhase === GAME_PHASES.CLUE_PHASE || activePhase === GAME_PHASES.VOTE_PHASE || activePhase === GAME_PHASES.ELIMINATION_PHASE) {
    content = (
      <CluePhase state={state} socketRef={socketRef} onSourceRect={setSourceRect} />
    )
  } else if (activePhase === GAME_PHASES.RESULT_PHASE) {
    content = (
      <ResultPhase state={state} dispatch={dispatch} onPlayAgain={handlePlayAgain} />
    )
  }
  // Every GAME_PHASES value has an explicit branch above — no fallback needed.

  return (
    <main className="online-game">
      <header className="online-topbar">
        <button onClick={handleExit} aria-label="Return to landing page">Undercover</button>
        <span>Case File #001</span>
        <div style={{ justifySelf: 'end', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span className={`online-topbar__status online-topbar__status--${state.connectionState.toLowerCase()}`}>
            {state.connectionState}
          </span>
          <button 
            id="players-navbar-button" 
            ref={playersBtnRef}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '25px', height: '25px', padding: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
            aria-label="Players"
            onClick={() => {
              const rect = playersBtnRef.current?.getBoundingClientRect()
              if (rect) setPlayersBtnRect(rect)
              setShowPlayers(true)
            }}
          >
            <svg width="15" height="15" fill="currentColor" version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 80.13 80.13" xmlSpace="preserve" stroke="currentColor">
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier"> 
                <g> 
                  <path d="M48.355,17.922c3.705,2.323,6.303,6.254,6.776,10.817c1.511,0.706,3.188,1.112,4.966,1.112 c6.491,0,11.752-5.261,11.752-11.751c0-6.491-5.261-11.752-11.752-11.752C53.668,6.35,48.453,11.517,48.355,17.922z M40.656,41.984 c6.491,0,11.752-5.262,11.752-11.752s-5.262-11.751-11.752-11.751c-6.49,0-11.754,5.262-11.754,11.752S34.166,41.984,40.656,41.984 z M45.641,42.785h-9.972c-8.297,0-15.047,6.751-15.047,15.048v12.195l0.031,0.191l0.84,0.263 c7.918,2.474,14.797,3.299,20.459,3.299c11.059,0,17.469-3.153,17.864-3.354l0.785-0.397h0.084V57.833 C60.688,49.536,53.938,42.785,45.641,42.785z M65.084,30.653h-9.895c-0.107,3.959-1.797,7.524-4.47,10.088 c7.375,2.193,12.771,9.032,12.771,17.11v3.758c9.77-0.358,15.4-3.127,15.771-3.313l0.785-0.398h0.084V45.699 C80.13,37.403,73.38,30.653,65.084,30.653z M20.035,29.853c2.299,0,4.438-0.671,6.25-1.814c0.576-3.757,2.59-7.04,5.467-9.276 c0.012-0.22,0.033-0.438,0.033-0.66c0-6.491-5.262-11.752-11.75-11.752c-6.492,0-11.752,5.261-11.752,11.752 C8.283,24.591,13.543,29.853,20.035,29.853z M30.589,40.741c-2.66-2.551-4.344-6.097-4.467-10.032 c-0.367-0.027-0.73-0.056-1.104-0.056h-9.971C6.75,30.653,0,37.403,0,45.699v12.197l0.031,0.188l0.84,0.265 c6.352,1.983,12.021,2.897,16.945,3.185v-3.683C17.818,49.773,23.212,42.936,30.589,40.741z"></path>
                </g>
              </g>
            </svg>
          </button>
          
          <button 
            ref={menuBtnRef}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '25px', height: '20px', padding: 0, background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
            aria-label="Game Menu"
            onClick={() => {
              const rect = menuBtnRef.current?.getBoundingClientRect()
              if (rect) setMenuBtnRect(rect)
              setShowGameMenu(true)
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>
      <div className="online-game__content">
        {content}
        <ErrorState>{state.error}</ErrorState>
      </div>
      {showPlayers && <PlayersPanel state={state} onClose={() => setShowPlayers(false)} buttonRect={playersBtnRect} onActionRequest={handleActionRequest} />}
      {showGameMenu && (
        <GameMenu 
          state={state} 
          socketRef={socketRef} 
          dispatch={dispatch} 
          onClose={() => setShowGameMenu(false)} 
          buttonRect={menuBtnRect} 
          onLeaveConfirm={handleLeaveRoom}
        />
      )}
      {showLeaveConfirm && (
        <ConfirmDialog
          title="Leave room?"
          message="Are you sure you want to leave this investigation? You can rejoin using the room ID."
          confirmLabel="Leave room"
          onConfirm={confirmLeave}
          onCancel={() => setShowLeaveConfirm(false)}
        />
      )}
      {kickTarget && (
        <div style={{ zIndex: 999999, position: 'relative' }}>
          <ConfirmDialog
            title="REMOVE PLAYER?"
            message={`Remove "${kickTarget.name}" from this room?`}
            confirmLabel="Remove Player"
            onConfirm={confirmKick}
            onCancel={() => setKickTarget(null)}
          />
        </div>
      )}
      {makeHostTarget && (
        <div style={{ zIndex: 999999, position: 'relative' }}>
          <ConfirmDialog
            title="MAKE HOST?"
            message={`Make "${makeHostTarget.name}" the host of this room?`}
            confirmLabel="Make Host"
            onConfirm={confirmMakeHost}
            onCancel={() => setMakeHostTarget(null)}
          />
        </div>
      )}
      {actionMenu && (
        <ActionMenu 
          menu={actionMenu} 
          onClose={() => setActionMenu(null)} 
          onKick={handleKickRequest}
          onMakeHost={handleMakeHostRequest}
        />
      )}
        {localElimination && (
          <EliminationOverlay 
            eliminationResult={localElimination} 
            configuration={state.configuration} 
            sourceRect={sourceRect}
            myPlayerId={state.sessionId}
            mrWhiteGuesserId={state.mrWhiteGuesserId}
            mrWhiteLiveGuess={state.mrWhiteLiveGuess}
            socketRef={socketRef}
          />
        )}
      {showQR && (
        <QRModal 
          joinUrl={import.meta.env.PROD ? `https://investigation-room.vercel.app/?room=${state.roomId}` : `${window.location.origin}/?room=${state.roomId}`} 
          roomId={state.roomId} 
          onClose={() => setShowQR(false)} 
          buttonRect={qrBtnRect} 
        />
      )}
    </main>
  )
}
