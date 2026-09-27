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

function RoomForm({ title, roomId, requiresRoomId, onSubmit, onBack, loading, joining }) {
  const savedSession = requiresRoomId ? readIdentity() : null
  const [name, setName] = useState('')
  const [room, setRoom] = useState(roomId || '')

  const isRejoin = requiresRoomId && savedSession && savedSession.roomId && savedSession.roomId === room.trim().toUpperCase() && savedSession.playerName

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
      {requiresRoomId && (
        <label>
          Room ID
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            placeholder="X7K9P2"
            maxLength="6"
            disabled={loading || joining}
          />
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

  const activeRolesCount = SPECIAL_ROLES.filter(r => configuration?.specialRoles?.[r.key]).length

  return (
    <div className={`special-roles-section ${expanded ? 'special-roles-section--expanded' : ''}`}>
      <button 
        type="button" 
        className="special-roles-header" 
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
                    <span className="special-role-row__avatar-badge" aria-hidden="true">
                      {role.avatar ? (
                        <img src={role.avatar} alt="" />
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

function PlayerListItem({ player, index, host, onKick }) {
  return (
    <article className="online-player" style={{ animationDelay: `${index * 50}ms` }}>
      <span className="online-player__index">Player {String(index + 1).padStart(2, '0')}</span>
      <span className="online-player__name">{player.name}</span>
      <span className="online-player__meta">
        {host && !player.isHost && (
          <button 
            className="online-player__kick-btn"
            onClick={() => onKick(player)}
            aria-label={`Remove ${player.name}`}
            title="Remove Player"
            style={{ cursor: 'pointer', background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: '0 4px', fontSize: '1.2rem', display: 'inline-flex', alignItems: 'center' }}
          >
            &times;
          </button>
        )}
        {player.isHost && <span className="online-player__badge">HOST</span>}
        <span className={`online-player__status online-player__status--${player.status?.toLowerCase()}`}>
          {player.status}
        </span>
      </span>
    </article>
  )
}

function PlayerList({ players, settings, host, onKick }) {
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
          <PlayerListItem key={player.id} player={player} index={index} host={host} onKick={onKick} />
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
  const socketRef = useRef(null)
  const playersBtnRef = useRef(null)
  const menuBtnRef = useRef(null)

  const handleKickRequest = useCallback((player) => {
    setKickTarget(player)
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
    content = (
      <RoomForm
        title="Join room"
        requiresRoomId
        onBack={() => dispatch({ type: 'SELECT_ONLINE' })}
        onSubmit={(name, roomId) => handleJoinRoom(name, roomId)}
        loading={loading}
        joining={joining}
      />
    )
  } else if (activePhase === GAME_PHASES.ROOM_LOBBY) {
    content = (
      <section className="online-panel online-panel--lobby">
        <header className="online-room-head">
          <span className="online-kicker">Online investigation</span>
          <h1>Room <b>{state.roomId}</b></h1>
          <button className="room-copy" onClick={handleCopyRoomId}>
            {state.copied ? 'Copied' : 'Copy room ID'}
          </button>
        </header>
        <div className="online-lobby-grid">
          <div className="online-lobby__players">
            <PlayerList players={state.players} settings={state.configuration} host={host} onKick={handleKickRequest} />
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
      {showPlayers && <PlayersPanel state={state} onClose={() => setShowPlayers(false)} buttonRect={playersBtnRect} onKick={handleKickRequest} />}
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
    </main>
  )
}
