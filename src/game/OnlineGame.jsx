import { useEffect, useRef, useState, useCallback, useReducer } from 'react'
import Button from '../components/Button.jsx'
import { WORD_CATEGORIES } from '../data/wordCategories.js'
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
      <div className="player-slider__ticks">
        <span>{min}</span>
        <span>{max}</span>
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
  const ucAtMin = undercover <= 1
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
    if (ucAtMax) return
    const next = undercover + 1
    if (next + mrWhite <= maxNon) {
      onChangeConfig({ totalPlayers, undercover: next, mrWhite })
    }
  }

  const handleUCDecrease = () => {
    if (ucAtMin) return
    onChangeConfig({ totalPlayers, undercover: undercover - 1, mrWhite })
  }

  const handleMWIncrease = () => {
    if (mwAtMax) return
    const next = mrWhite + 1
    if (undercover + next <= maxNon) {
      onChangeConfig({ totalPlayers, undercover, mrWhite: next })
    }
  }

  const handleMWDecrease = () => {
    if (mwAtMin) return
    onChangeConfig({ totalPlayers, undercover, mrWhite: mrWhite - 1 })
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
          showPlus={host && !ucAtMax}
        />

        <RoleCapsule
          label="Mr. White"
          count={mrWhite}
          variant="mrwhite"
          onDecrease={handleMWDecrease}
          onIncrease={handleMWIncrease}
          showMinus={host && !mwAtMin}
          showPlus={host && !mwAtMax}
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

function PlayerListItem({ player, index }) {
  return (
    <article className="online-player" style={{ animationDelay: `${index * 50}ms` }}>
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

function PlayerList({ players, settings }) {
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
          <PlayerListItem key={player.id} player={player} index={index} />
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
  const [playersBtnRect, setPlayersBtnRect] = useState(null)
  const [sourceRect, setSourceRect] = useState(null)
  const [localElimination, setLocalElimination] = useState(null)
  const socketRef = useRef(null)
  const playersBtnRef = useRef(null)

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
            <PlayerList players={state.players} settings={state.configuration} />
            {!host && (
              <Button onClick={handleToggleReady}>
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
        <div style={{ justifySelf: 'end', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button 
            id="players-navbar-button" 
            ref={playersBtnRef}
            style={{ fontSize: '0.62rem', letterSpacing: '0.25em', color: 'var(--text-primary)' }} 
            onClick={() => {
              const rect = playersBtnRef.current?.getBoundingClientRect()
              if (rect) setPlayersBtnRect(rect)
              setShowPlayers(true)
            }}
          >Players</button>
          <span className={`online-topbar__status online-topbar__status--${state.connectionState.toLowerCase()}`}>
            {state.connectionState}
          </span>
        </div>
      </header>
      <div className="online-game__content">
        {content}
        <ErrorState>{state.error}</ErrorState>
      </div>
      {showPlayers && <PlayersPanel state={state} onClose={() => setShowPlayers(false)} buttonRect={playersBtnRect} />}
      {showLeaveConfirm && (
        <ConfirmDialog
          title="Leave room?"
          message="Are you sure you want to leave this investigation? You can rejoin using the room ID."
          confirmLabel="Leave room"
          onConfirm={confirmLeave}
          onCancel={() => setShowLeaveConfirm(false)}
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
    </main>
  )
}
