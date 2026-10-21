import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../../game/socket.js'
import { ensureIdentity } from '../../game/identity.js'
import PlayerStrip from './PlayerStrip.jsx'
import DrawingToolbar, { DRAW_COLORS } from './DrawingToolbar.jsx'
import DrawingCanvas from './DrawingCanvas.jsx'
import ChatBox from './ChatBox.jsx'
import DrawingTopBar from './DrawingTopBar.jsx'
import SettingsPanel from './SettingsPanel.jsx'
import FinalScores from './FinalScores.jsx'
import SkribblError from './SkribblError.jsx'
import Lobby from './Lobby.jsx'
import { useGuessKeyboard } from '../../hooks/useGuessKeyboard.js'
import { getFriendlyError } from '../SkribblApp.jsx'
import { shouldRenderIndividualLobby, PlayAgainRequestController } from '../skribblRouting.js'

export { shouldRenderIndividualLobby }

export default function DrawingPhase({ room, onLeave, error, connectionStatus = 'Connected', onUpdateConfig }) {
  const { sessionId } = ensureIdentity()
  const myPlayer = room.players?.find(p => p.id === sessionId)
  const isDrawer = room.currentDrawerId === sessionId
  const guessInputRef = useRef(null)
  useGuessKeyboard(guessInputRef, !isDrawer)

  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(8)
  const [tool, setTool] = useState('brush')
  const [timeRemaining, setTimeRemaining] = useState(room.configuration.drawTimeSec)
  const [guessInput, setGuessInput] = useState('')
  const [isChoosing, setIsChoosing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsRect, setSettingsRect] = useState(null)
  const handleOpenSettings = useCallback((rect) => {
    document.activeElement?.blur?.() // close the keyboard first so the layout is back to full height
    setSettingsRect(rect)
    setShowSettings(true)
  }, [])
  const handleCloseSettings = useCallback(() => setShowSettings(false), [])

  // Close keyboard if drawing phase ended (e.g. round reveal or game result)
  useEffect(() => {
    if (room.phase !== 'DRAWING') document.activeElement?.blur?.()
  }, [room.phase])

  const [chatNotifications, setChatNotifications] = useState([])
  const seenMessageIds = useRef(new Set())

  const [kickError, setKickError] = useState(null)
  const [isKicking, setIsKicking] = useState(false)
  const pendingKickTargetRef = useRef(null)

  const [isSubmittingPlayAgain, setIsSubmittingPlayAgain] = useState(false)
  const [playAgainError, setPlayAgainError] = useState(null)

  const playAgainControllerRef = useRef(null)
  if (!playAgainControllerRef.current) {
    playAgainControllerRef.current = new PlayAgainRequestController({
      onSubmittingChange: setIsSubmittingPlayAgain,
      onErrorChange: setPlayAgainError,
      emit: (event, cb) => getSocket()?.emit(event, cb),
      getFriendlyError,
      timeoutMs: 7000
    })
  }

  playAgainControllerRef.current.onSubmittingChange = setIsSubmittingPlayAgain
  playAgainControllerRef.current.onErrorChange = setPlayAgainError
  playAgainControllerRef.current.emit = (event, cb) => getSocket()?.emit(event, cb)
  playAgainControllerRef.current.getFriendlyError = getFriendlyError

  // Clean up acknowledgement timeout on unmount
  useEffect(() => () => {
    playAgainControllerRef.current?.cleanup()
  }, [])

  // Connection-aware recovery: reset submitting state if socket disconnects
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleDisconnect = () => {
      playAgainControllerRef.current?.handleDisconnect()
    }

    socket.on('disconnect', handleDisconnect)
    return () => {
      socket.off('disconnect', handleDisconnect)
    }
  }, [])

  // Overlay exit animation tracking
  const [exitingOverlay, setExitingOverlay] = useState(null)
  const prevPhaseRef = useRef(room.phase)
  const overlaySnapshotRef = useRef({
    wordChoice: null,
    roundReveal: null
  })

  useEffect(() => {
    const prevPhase = prevPhaseRef.current
    prevPhaseRef.current = room.phase

    if (prevPhase === room.phase) return

    // Immediately clear if transitioning to LOBBY
    if (room.phase === 'LOBBY') {
      setExitingOverlay(null)
      return
    }

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!prefersReducedMotion && (prevPhase === 'WORD_CHOICE' || prevPhase === 'ROUND_REVEAL')) {
      const data = prevPhase === 'WORD_CHOICE'
        ? overlaySnapshotRef.current.wordChoice
        : overlaySnapshotRef.current.roundReveal

      setExitingOverlay({
        type: prevPhase,
        data,
        key: `${prevPhase}-exit-${Date.now()}`
      })

      const timer = setTimeout(() => {
        setExitingOverlay(current => {
          return current?.type === prevPhase ? null : current
        })
      }, 1000)

      return () => clearTimeout(timer)
    } else {
      setExitingOverlay(null)
    }
  }, [room.phase])

  // Also monitor connectionStatus prop
  useEffect(() => {
    if (connectionStatus !== 'Connected' && isSubmittingPlayAgain) {
      playAgainControllerRef.current?.handleDisconnect()
    }
  }, [connectionStatus, isSubmittingPlayAgain])

  const handlePlayAgain = useCallback(() => {
    const socket = getSocket()
    playAgainControllerRef.current?.submit({
      isConnected: Boolean(socket?.connected),
      isAlreadyOptedIn: Boolean(myPlayer?.playAgain)
    })
  }, [myPlayer?.playAgain])

  const handleKickPlayer = useCallback((targetId, onComplete) => {
    if (isKicking) return
    setIsKicking(true)
    setKickError(null)
    pendingKickTargetRef.current = targetId

    const socket = getSocket()
    if (!socket?.connected) {
      setIsKicking(false)
      pendingKickTargetRef.current = null
      setKickError('Unable to kick player: Not connected to server.')
      onComplete?.(false)
      return
    }

    socket.emit('draw:kick-player', { targetId }, (res) => {
      setIsKicking(false)
      pendingKickTargetRef.current = null

      if (res?.error || res?.success === false) {
        const message = getFriendlyError(res?.error) || 'Failed to kick player.'
        setKickError(message)
        onComplete?.(false)
      } else {
        setKickError(null)
        onComplete?.(true)
      }
    })
  }, [isKicking])

  const handleTargetLeft = useCallback((targetName) => {
    setKickError(`${targetName || 'That player'} is no longer in the room.`)
  }, [])

  const displayError = kickError || error

  const hasInitialized = useRef(false)

  useEffect(() => {
    const messages = room.chatMessages || []
    const newNotifs = []
    
    messages.forEach(msg => {
      if ((msg.type === 'CHAT' || msg.type === 'SYSTEM' || msg.type === 'CORRECT' || msg.type === 'CLOSE' || msg.type === 'REACTION') && !seenMessageIds.current.has(msg.id)) {
        seenMessageIds.current.add(msg.id)
        if (hasInitialized.current) {
          newNotifs.push({ ...msg, expireAt: Date.now() + 4000 })
        }
      }
    })
    
    hasInitialized.current = true

    if (newNotifs.length > 0) {
      setChatNotifications(prev => {
        const next = [...prev, ...newNotifs]
        return next.slice(-3) // Keep max 3 at a time
      })
    }
  }, [room.chatMessages])

  useEffect(() => {
    if (chatNotifications.length === 0) return
    const interval = setInterval(() => {
      const now = Date.now()
      setChatNotifications(prev => prev.filter(n => n.expireAt > now))
    }, 500)
    return () => clearInterval(interval)
  }, [chatNotifications.length])
  
  // --- LAYOUT CONFIGURATION ---
  // Adjust these flex values to manually change the balance between the canvas and the lower player/chat panel.
  // - Increase CANVAS_FLEX (or decrease INFO_PANEL_FLEX) -> canvas gets taller, lower section gets shorter.
  // - Decrease CANVAS_FLEX (or increase INFO_PANEL_FLEX) -> canvas gets shorter, lower section gets taller.
  const CANVAS_FLEX = 60
  const INFO_PANEL_FLEX = 40
  // -----------------------------

  const strokesRef = useRef([])
  const canvasRef = useRef(null)

  // Clear visible canvas and local strokes when entering GAME_RESULT
  useEffect(() => {
    if (room.phase === 'GAME_RESULT') {
      strokesRef.current = []
      canvasRef.current?.clear()
    }
  }, [room.phase])
  
  // Handle timer sync (monotonic elapsed-time countdown, independent of device wall clock)
  const timerSyncRef = useRef({ initialRemainingMs: 0, startLocalTime: 0, roundEndsAt: null })

  useEffect(() => {
    if (room.phase !== 'DRAWING') {
      return
    }

    const serverRemainingMs = room.remainingMs != null
      ? room.remainingMs
      : (room.configuration?.drawTimeSec ? room.configuration.drawTimeSec * 1000 : 80000)

    // When timer is paused (e.g. drawer is offline, roundEndsAt is null)
    if (!room.roundEndsAt) {
      timerSyncRef.current = { initialRemainingMs: serverRemainingMs, startLocalTime: 0, roundEndsAt: null }
      setTimeRemaining(Math.max(0, Math.ceil(serverRemainingMs / 1000)))
      return
    }

    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
    const isNewInterval = timerSyncRef.current.roundEndsAt !== room.roundEndsAt
    const currentElapsed = timerSyncRef.current.startLocalTime ? (now - timerSyncRef.current.startLocalTime) : 0
    const currentRemaining = Math.max(0, timerSyncRef.current.initialRemainingMs - currentElapsed)
    const drift = Math.abs(currentRemaining - serverRemainingMs)

    // Re-anchor if this is a new turn/resume or if local elapsed time drifted > 1500ms from server
    if (isNewInterval || drift > 1500) {
      timerSyncRef.current = {
        initialRemainingMs: serverRemainingMs,
        startLocalTime: now,
        roundEndsAt: room.roundEndsAt
      }
      setTimeRemaining(Math.max(0, Math.ceil(serverRemainingMs / 1000)))
    }

    const updateTimer = () => {
      const curNow = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()
      const elapsed = curNow - timerSyncRef.current.startLocalTime
      const curRemainingMs = Math.max(0, timerSyncRef.current.initialRemainingMs - elapsed)
      setTimeRemaining(Math.ceil(curRemainingMs / 1000))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 250)
    return () => clearInterval(interval)
  }, [room.phase, room.roundEndsAt, room.round, room.turnIndex, room.remainingMs])

  // Networking for strokes
  useEffect(() => {
    const socket = getSocket()
    
    // Fetch initial state or re-fetch on reconnect
    const fetchStrokes = () => {
      socket.emit('draw:request-strokes', (res) => {
        if (res && res.strokes) {
          strokesRef.current = res.strokes
          canvasRef.current?.redrawAll(strokesRef.current)
        }
      })
    }
    
    fetchStrokes()
    socket.on('connect', fetchStrokes)

    const handleIncomingStroke = (stroke) => {
      if (stroke.isComplete) {
        strokesRef.current.push(stroke)
        // Redraw to ensure pixel-perfect rendering of the full stroke
        canvasRef.current?.redrawAll(strokesRef.current)
      } else {
        canvasRef.current?.liveDraw(stroke)
      }
    }

    const handleClear = () => {
      strokesRef.current = []
      canvasRef.current?.clear()
    }

    const handleIncomingUndo = () => {
      if (strokesRef.current.length > 0) {
        strokesRef.current.pop()
        canvasRef.current?.redrawAll(strokesRef.current)
      }
    }

    socket.on('draw:stroke', handleIncomingStroke)
    socket.on('draw:clear-canvas', handleClear)
    socket.on('draw:undo', handleIncomingUndo)

    const handleResize = () => {
      setTimeout(() => {
        canvasRef.current?.redrawAll(strokesRef.current)
      }, 0)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      socket.off('connect', fetchStrokes)
      socket.off('draw:stroke', handleIncomingStroke)
      socket.off('draw:clear-canvas', handleClear)
      socket.off('draw:undo', handleIncomingUndo)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Sync strokes on turn change
  const currentTurnKey = `${room.round}-${room.turnIndex}-${room.currentDrawerId}`
  useEffect(() => {
    if (room.phase === 'WORD_CHOICE') {
      strokesRef.current = []
      canvasRef.current?.clear()
    }
  }, [currentTurnKey, room.phase])

  // Batch rapid pointer events into short ordered packets. Sending one Socket.IO
  // message per pointer event can overwhelm the realtime stream when drawing fast.
  const pendingLivePointsRef = useRef([])
  const liveFlushTimerRef = useRef(null)

  const flushLiveStroke = useCallback(() => {
    if (liveFlushTimerRef.current) {
      clearTimeout(liveFlushTimerRef.current)
      liveFlushTimerRef.current = null
    }

    const points = pendingLivePointsRef.current
    if (points.length === 0) return
    pendingLivePointsRef.current = []

    const socket = getSocket()
    socket.emit('draw:stroke', {
      color: points.color,
      size: points.size,
      tool: points.tool,
      points: points.points,
      isComplete: false,
    })
  }, [])

  const handleStroke = useCallback((strokeData, isComplete = true) => {
    const socket = getSocket()

    if (isComplete) {
      // Preserve ordering: all pending live points must reach the server before
      // the persisted complete stroke is sent.
      flushLiveStroke()
      socket.emit('draw:stroke', { ...strokeData, isComplete: true })
      return
    }

    if (!strokeData?.points?.length) return

    const pending = pendingLivePointsRef.current
    if (pending.length === 0) {
      pendingLivePointsRef.current = {
        color: strokeData.color,
        size: strokeData.size,
        tool: strokeData.tool,
        points: [...strokeData.points],
      }
    } else {
      // Pointer deltas are already ordered. Keep the complete point sequence in
      // one packet so the remote canvas can draw it without gaps.
      pending.points.push(...strokeData.points.slice(1))
    }

    // Keep packets small enough for smooth realtime rendering while greatly
    // reducing event pressure during fast strokes.
    if (pendingLivePointsRef.current.points.length >= 32) {
      flushLiveStroke()
      return
    }

    if (!liveFlushTimerRef.current) {
      liveFlushTimerRef.current = setTimeout(() => {
        liveFlushTimerRef.current = null
        flushLiveStroke()
      }, 16)
    }
  }, [flushLiveStroke])

  useEffect(() => () => {
    if (liveFlushTimerRef.current) clearTimeout(liveFlushTimerRef.current)
    liveFlushTimerRef.current = null
    pendingLivePointsRef.current = []
  }, [])

  const handleClearCanvas = () => {
    const socket = getSocket()
    socket.emit('draw:clear-canvas')
  }

  const handleUndo = () => {
    const socket = getSocket()
    socket.emit('draw:undo')
  }

  useEffect(() => {
    setIsChoosing(false)
  }, [room.phase, room.round, room.turnIndex, room.currentDrawerId])

  const handleChooseWord = (word) => {
    if (isChoosing || !isDrawer || room.phase !== 'WORD_CHOICE') return
    setIsChoosing(true)
    const socket = getSocket()
    socket.emit('draw:choose-word', { word }, (res) => {
      setIsChoosing(false)
      if (res?.error) {
        console.error('Word choice rejected:', res.error)
      }
    })
  }

  const handleGuessSubmit = (e) => {
    e.preventDefault()
    if (!guessInput.trim() || isDrawer || room.phase !== 'DRAWING') return
    const socket = getSocket()
    socket.emit('draw:guess', { message: guessInput.trim() })
    setGuessInput('')
    guessInputRef.current?.focus({ preventScroll: true })
  }

  // Formatting Drawer Text
  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'

  // Pre-calculate round reveal data and keep snapshots for exit animations
  const activeRoundPlayers = (room.players || []).filter(p => !p.spectator)
  const sortedRoundPlayers = [...activeRoundPlayers].sort((a, b) => {
    const scoreA = room.turnScores?.[a.id] || 0
    const scoreB = room.turnScores?.[b.id] || 0
    return scoreB - scoreA
  }).map(p => ({
    id: p.id,
    name: p.name,
    pts: room.turnScores?.[p.id] || 0
  }))
  const eligibleGuessers = activeRoundPlayers.filter(p => p.id !== room.currentDrawerId)
  const allGuessed = eligibleGuessers.length > 0 && eligibleGuessers.every(p => (room.turnScores?.[p.id] || 0) > 0 || room.guessedPlayerIds?.includes(p.id))

  if (room.phase === 'WORD_CHOICE') {
    overlaySnapshotRef.current.wordChoice = {
      isDrawer,
      wordChoices: room.wordChoices,
      drawerName
    }
  } else if (room.phase === 'ROUND_REVEAL') {
    overlaySnapshotRef.current.roundReveal = {
      selectedWord: room.selectedWord || room.currentWord || '',
      allGuessed,
      sortedPlayers: sortedRoundPlayers
    }
  }

  const renderWordChoice = (data, isExiting = false) => {
    if (!data) return null
    const { isDrawer: isD, wordChoices, drawerName: dName } = data
    return (
      <div 
        key={isExiting ? exitingOverlay?.key : 'word-choice-active'}
        className={`sk-word-choice-overlay ${!isD ? 'is-waiting' : ''} ${isExiting ? 'is-exiting' : ''}`}
      >
        {isD ? (
          <>
            <h2 className="sk-word-choice-title">Choose a word</h2>
            <div className="sk-word-choice-options">
              {(wordChoices || []).map((word, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="sk-word-choice-btn"
                  disabled={isExiting || isChoosing}
                  onClick={() => !isExiting && handleChooseWord(word)}
                >
                  {word}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="sk-word-choice-waiting">
            <span className="sk-word-choice-waiting-name">{dName}</span> is choosing a word...
          </div>
        )}
      </div>
    )
  }

  const renderRoundReveal = (data, isExiting = false) => {
    if (!data) return null
    const { selectedWord, allGuessed: isAllGuessed, sortedPlayers: playersList } = data
    return (
      <div 
        key={isExiting ? exitingOverlay?.key : 'round-reveal-active'}
        className={`sk-round-reveal-overlay ${isExiting ? 'is-exiting' : ''}`}
      >
        <div className="sk-round-reveal-header">
          <div className="sk-round-reveal-word-line">
            The word was <span className="sk-round-reveal-word-highlight">{selectedWord}</span>
          </div>
          <div className="sk-round-reveal-status">
            {isAllGuessed ? 'Everyone guessed!' : 'Time is up!'}
          </div>
        </div>

        <div className="sk-round-reveal-list" data-sk-scroll>
          {(playersList || []).map(p => {
            const pts = p.pts || 0
            return (
              <div key={p.id} className="sk-round-reveal-row">
                <span className="sk-round-reveal-name" title={p.name}>
                  {p.name}
                </span>
                <span className={`sk-round-reveal-points ${pts > 0 ? 'sk-round-reveal-points--pos' : 'sk-round-reveal-points--zero'}`}>
                  {pts > 0 ? `+${pts}` : '0'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const topBarColor = timeRemaining <= 10 ? 'var(--sk-coral)' : 'var(--sk-primary)'

  if (shouldRenderIndividualLobby(room, sessionId)) {
    return (
      <Lobby 
        room={room} 
        onLeave={onLeave} 
        onUpdateConfig={onUpdateConfig} 
        error={error} 
      />
    )
  }

  return (
    <div className={`sk-view sk-view--game ${room.phase === 'GAME_RESULT' ? 'is-game-result' : ''}`}>
      {/* Background (light layout) */}
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>

      {/* GAME BODY: everything above the guess dock. Never scrolls while the keyboard is closed; while it is open it is the only scrollable area (user-driven). */}
      <div className="sk-game-body" data-sk-scroll>

      {/* TOP BAR */}
      <DrawingTopBar 
        room={room}
        timeRemaining={timeRemaining}
        isDrawer={isDrawer}
        hasGuessed={room.guessedPlayerIds?.includes(sessionId)}
        onOpenSettings={handleOpenSettings}
      />

      {displayError && (
        <div className="sk-game-error-banner">
          <SkribblError message={displayError} style={{ marginBottom: 0 }} />
        </div>
      )}

      {/* CANVAS AREA */}
      <style>{`
        .sk-drawing-surface-wrapper {
          flex: ${CANVAS_FLEX};
          position: relative;
          min-height: 0;
          background: var(--sk-canvas);
          z-index: 5;
          overflow: hidden;
          transition: flex 1000ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sk-view--game.is-game-result .sk-drawing-surface-wrapper {
          flex: 74;
        }
        .sk-drawing-surface {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .sk-lower-info-section {
          flex: ${INFO_PANEL_FLEX};
          min-height: 120px;
          transition: flex 1000ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .sk-view--game.is-game-result .sk-lower-info-section {
          flex: 26;
        }
        @media (max-width: 768px) {
          .sk-drawing-surface-wrapper {
            flex: none !important;
            width: 100% !important;
            height: 75vw !important;
            max-height: 75vw !important;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden !important;
            transition: height 1000ms cubic-bezier(0.22, 1, 0.36, 1) !important;
          }
          .sk-view--game.is-game-result .sk-drawing-surface-wrapper {
            height: clamp(340px, 92vw, min(420px, calc(100dvh - 160px))) !important;
            max-height: none !important;
          }
          .sk-drawing-surface {
            position: relative !important;
            width: 100% !important;
            height: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            aspect-ratio: 4 / 3 !important;
            inset: auto !important;
            overflow: hidden !important;
          }
          .sk-view--game.is-game-result .sk-drawing-surface {
            position: absolute !important;
            inset: 0 !important;
            aspect-ratio: auto !important;
          }
          .sk-lower-info-section {
            flex: 1 1 0% !important;
            min-height: 120px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sk-drawing-surface-wrapper,
          .sk-lower-info-section {
            transition: none !important;
          }
        }
      `}</style>
      <div 
        className="sk-drawing-surface-wrapper" 
        style={{ 
          cursor: (isDrawer && room.phase === 'DRAWING') ? 'crosshair' : 'default',
          touchAction: (isDrawer && room.phase === 'DRAWING') ? 'none' : 'pan-y'
        }}
      >
        <div className="sk-drawing-surface">
          <div style={{ 
            position: 'absolute', 
            inset: 0, 
            pointerEvents: (!isDrawer || room.phase !== 'DRAWING') ? 'none' : 'auto',
            touchAction: (isDrawer && room.phase === 'DRAWING') ? 'none' : 'pan-y'
          }}>
          <DrawingCanvas 
            ref={canvasRef}
            color={color}
            size={size}
            tool={tool}
            isDrawer={isDrawer && room.phase === 'DRAWING'}
            onStroke={handleStroke}
          />
        </div>
        
        {/* Visual boundary shadow */}
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)', pointerEvents: 'none' }} />

        {/* Reactions UI */}
        {room.phase === 'DRAWING' && !isDrawer && !room.reactions?.[sessionId] && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '0px', zIndex: 15 }}>
            <button 
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => getSocket().emit('draw:reaction', 'LIKE')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'none'
              }}
            >
              <img src="/images/svg/thumb_up.svg" alt="Like" width="32" height="32" style={{ display: 'block' }} />
            </button>
            <button 
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => getSocket().emit('draw:reaction', 'DISLIKE')}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: 'none'
              }}
            >
              <img src="/images/svg/thumb_down.svg" alt="Dislike" width="32" height="32" style={{ display: 'block' }} />
            </button>
          </div>
        )}

        {/* Chat Notifications UI */}
        <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', flexDirection: 'column', gap: '6px', zIndex: 15, pointerEvents: 'none', maxWidth: '75%', alignItems: 'flex-end' }}>
          {chatNotifications.map(notif => {
            let textColor = '#333333'
            let content = <><strong style={{ color: 'black', flexShrink: 0 }}>{notif.playerName}:</strong> <span>{notif.message}</span></>
            
            if (notif.type === 'SYSTEM') {
              const text = notif.message || ''
              if (text.includes('joined')) {
                textColor = '#359b35'
              } else if (text.includes('left')) {
                textColor = '#cc4e14'
              } else {
                textColor = '#777777'
              }
              content = <strong style={{ color: textColor }}>{notif.message}</strong>
            } else if (notif.type === 'CORRECT') {
              textColor = '#359b35'
              content = <strong style={{ color: textColor }}>{notif.playerName} guessed the word!</strong>
            } else if (notif.type === 'CLOSE') {
              textColor = '#b08d00'
              content = <strong style={{ color: textColor }}>{notif.playerName} is close!</strong>
            } else if (notif.type === 'REACTION') {
              const isDislike = notif.reaction === 'DISLIKE' || (!notif.reaction && notif.message?.includes('disliked'))
              const isLike = notif.reaction === 'LIKE' || (!notif.reaction && notif.message?.includes('liked'))
              if (isDislike) {
                textColor = '#DC2626'
              } else if (isLike) {
                textColor = '#359b35'
              } else {
                textColor = '#777777'
              }
              content = <strong style={{ color: textColor }}>{notif.message}</strong>
            }

            return (
              <div 
                key={notif.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  padding: '6px 10px',
                  borderRadius: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  fontFamily: 'var(--sk-font-body)',
                  fontSize: '0.8rem',
                  lineHeight: '1.2',
                  animation: 'skFadeIn 200ms ease-out',
                  wordBreak: 'break-word',
                  border: '1px solid rgba(0,0,0,0.05)',
                  display: 'inline-flex',
                  gap: '4px',
                  color: textColor
                }}
              >
                {content}
              </div>
            )
          })}
        </div>

        {/* Word Choice Overlay (Active) */}
        {room.phase === 'WORD_CHOICE' && renderWordChoice({
          isDrawer,
          wordChoices: room.wordChoices,
          drawerName
        }, false)}

        {/* Round Reveal Overlay (Active) */}
        {room.phase === 'ROUND_REVEAL' && renderRoundReveal({
          selectedWord: room.selectedWord || room.currentWord || '',
          allGuessed,
          sortedPlayers: sortedRoundPlayers
        }, false)}

        {/* Exiting Overlays */}
        {exitingOverlay?.type === 'WORD_CHOICE' && exitingOverlay.type !== room.phase && (
          renderWordChoice(exitingOverlay.data, true)
        )}
        {exitingOverlay?.type === 'ROUND_REVEAL' && exitingOverlay.type !== room.phase && (
          renderRoundReveal(exitingOverlay.data, true)
        )}

        {/* Game Result Overlay (Canvas Scope) */}
        {room.phase === 'GAME_RESULT' && (
          <FinalScores
            players={room.players}
            sessionId={sessionId}
            isSubmitting={isSubmittingPlayAgain}
            hasOptedIn={Boolean(myPlayer?.playAgain)}
            error={playAgainError}
            onPlayAgain={handlePlayAgain}
            onOpenSettings={handleOpenSettings}
          />
        )}

        </div>
      </div>

      {/* BOTTOM CONTROLS (drawer toolbar only; the guess form is the dock at the bottom of the shell) */}
      <div style={{ flexShrink: 0, zIndex: 10 }}>
        {(isDrawer && room.phase === 'DRAWING') && (
          <DrawingToolbar 
            color={color} 
            setColor={setColor} 
            size={size} 
            setSize={setSize} 
            tool={tool}
            setTool={setTool}
            onClear={handleClearCanvas} 
            onUndo={handleUndo}
          />
        )}
      </div>

      {/* LOWER INFO SECTION: Players & Chat */}
      <div className="sk-lower-info-section" style={{ 
        display: 'flex', 
        minHeight: 0,
        background: '#ffffff',
        zIndex: 10,
        boxSizing: 'border-box'
      }}>
        {/* Left Column: Player List */}
        <div style={{ flex: '0 0 45%', borderRight: '1px solid rgba(0,0,0,0.05)', minWidth: 0 }}>
          <PlayerStrip 
            room={room} 
            currentDrawerId={room.currentDrawerId} 
            sessionId={sessionId}
            onKickPlayer={handleKickPlayer}
            isKicking={isKicking}
            onTargetLeft={handleTargetLeft}
          />
        </div>
        
        {/* Right Column: Chat Box */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }}>
          <ChatBox room={room} />
        </div>
      </div>
      </div>
      {/* /GAME BODY */}

      {/* GUESS DOCK: last child of the shell (like a chat composer). Guessers only. */}
      {!isDrawer && (
        <form className="sk-guess-dock" onSubmit={handleGuessSubmit}>
          <div className="sk-guess-dock-inner">
            <input
              ref={guessInputRef}
              type="text"
              id="sk-guess-input"
              name="guess"
              placeholder="Type your guess..."
              className="sk-input"
              style={{ 
                margin: 0, 
                fontSize: '18px', 
                width: '100%', 
                minWidth: 0, 
                boxSizing: 'border-box',
                textAlign: 'center'
              }}
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              disabled={room.phase === 'GAME_RESULT' || room.guessedPlayerIds?.includes(sessionId)}
              maxLength={120}
              enterKeyHint="send"
              autoComplete="on"
              autoCorrect="on"
              spellCheck={true}
              autoCapitalize="sentences"
            />
          </div>
        </form>
      )}

      {showSettings && (
        <SettingsPanel 
          buttonRect={settingsRect} 
          onClose={handleCloseSettings} 
          onLeave={onLeave} 
          roomId={room.id} 
          connectionStatus={connectionStatus}
        />
      )}
    </div>
  )
}
