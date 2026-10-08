import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../../game/socket.js'
import { ensureIdentity } from '../../game/identity.js'
import PlayerStrip from './PlayerStrip.jsx'
import DrawingToolbar, { DRAW_COLORS } from './DrawingToolbar.jsx'
import DrawingCanvas from './DrawingCanvas.jsx'
import ChatBox from './ChatBox.jsx'
import DrawingTopBar from './DrawingTopBar.jsx'
import { useGuessKeyboard } from '../../hooks/useGuessKeyboard.js'

export default function DrawingPhase({ room, onLeave }) {
  const { sessionId } = ensureIdentity()
  const isDrawer = room.currentDrawerId === sessionId
  const guessInputRef = useRef(null)
  const guessBarRef = useRef(null)
  const { lifted, barHeight } = useGuessKeyboard(guessInputRef, guessBarRef, !isDrawer)

  const [color, setColor] = useState('#000000')
  const [size, setSize] = useState(8)
  const [tool, setTool] = useState('brush')
  const [timeRemaining, setTimeRemaining] = useState(room.configuration.drawTimeSec)
  const [guessInput, setGuessInput] = useState('')
  const [isChoosing, setIsChoosing] = useState(false)

  const [chatNotifications, setChatNotifications] = useState([])
  const seenMessageIds = useRef(new Set())

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
  
  // Handle timer sync
  useEffect(() => {
    const updateTimer = () => {
      if (room.roundEndsAt) {
        const remaining = Math.ceil((room.roundEndsAt - Date.now()) / 1000)
        setTimeRemaining(Math.max(0, remaining))
      }
    }
    updateTimer()
    const interval = setInterval(updateTimer, 500)
    return () => clearInterval(interval)
  }, [room.roundEndsAt])

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

  const handleChooseWord = (word) => {
    if (isChoosing) return
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
    if (!guessInput.trim() || isDrawer) return
    const socket = getSocket()
    socket.emit('draw:guess', { message: guessInput.trim() })
    setGuessInput('')
    guessInputRef.current?.focus({ preventScroll: true })
  }

  // Formatting Drawer Text
  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'

  const topBarColor = timeRemaining <= 10 ? 'var(--sk-coral)' : 'var(--sk-primary)'

  return (
    <div className="sk-view sk-view--game">
      {/* Background (light layout) */}
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>

      {/* TOP BAR */}
      <DrawingTopBar 
        room={room}
        timeRemaining={timeRemaining}
        isDrawer={isDrawer}
        hasGuessed={room.guessedPlayerIds?.includes(sessionId)}
        onOpenSettings={onLeave}
      />

      {/* CANVAS AREA */}
      <style>{`
        .sk-drawing-surface-wrapper {
          flex: ${CANVAS_FLEX};
          position: relative;
          min-height: 0;
          background: var(--sk-canvas);
          z-index: 5;
        }
        .sk-drawing-surface {
          position: absolute;
          inset: 0;
        }
        .sk-lower-info-section {
          flex: ${INFO_PANEL_FLEX};
        }
        @media (max-width: 768px) {
          .sk-drawing-surface-wrapper {
            flex: none !important;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .sk-drawing-surface {
            position: relative !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: 100% !important;
            aspect-ratio: 4 / 3 !important;
            inset: auto !important;
          }
          .sk-lower-info-section {
            flex: 1 !important;
          }
        }
      `}</style>
      <div 
        className="sk-drawing-surface-wrapper" 
        style={{ cursor: (isDrawer && room.phase === 'DRAWING') ? 'crosshair' : 'default' }}
      >
        <div className="sk-drawing-surface">
        <div style={{ position: 'absolute', inset: 0, opacity: room.phase === 'WORD_CHOICE' ? 0.3 : 1, transition: 'opacity 300ms ease', pointerEvents: room.phase === 'WORD_CHOICE' ? 'none' : 'auto' }}>
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
              const text = notif.message || ''
              if (text.includes('liked')) {
                textColor = '#359b35'
              } else if (text.includes('disliked')) {
                textColor = '#DC2626'
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

        {/* Word Choice Overlay */}
        {room.phase === 'WORD_CHOICE' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 20 }}>
            {isDrawer ? (
              <div style={{ width: '100%', maxWidth: '250px', animation: 'skFadeIn 400ms ease forwards', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--sk-font-display)', color: 'var(--sk-text)', marginBottom: '8px', fontSize: '1.2rem', textShadow: '0 2px 8px rgba(255,255,255,0.8)' }}>CHOOSE A WORD</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                  {(room.wordChoices || []).map((word, idx) => (
                    <div 
                      key={idx}
                      className="sk-card"
                      style={{ 
                        cursor: 'pointer', 
                        padding: '10px', 
                        animationDelay: `${idx * 100}ms`,
                        animation: 'skCardEnter 400ms ease both',
                        transition: 'transform 150ms ease, box-shadow 150ms ease',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
                      }}
                      onClick={() => handleChooseWord(word)}
                      onPointerDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)' }}
                      onPointerUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                      onPointerLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      <div style={{ fontSize: '1.2rem', fontFamily: 'var(--sk-font-display)', color: 'var(--sk-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {word}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', maxWidth: '400px', animation: 'skFadeIn 400ms ease forwards', textAlign: 'center' }}>
                <div className="sk-card" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                  <svg width="60" height="60" viewBox="0 0 100 100" style={{ opacity: 0.8, margin: '0 auto 16px', display: 'block' }}>
                    <circle cx="50" cy="50" r="40" fill="var(--sk-canvas)" stroke="var(--sk-muted)" strokeWidth="4" strokeDasharray="10 6" />
                    <path d="M35,45 Q40,35 45,45 T55,45 T65,45" fill="none" stroke="var(--sk-primary)" strokeWidth="4" strokeLinecap="round" />
                  </svg>
                  <p style={{ color: 'var(--sk-muted)', fontFamily: 'var(--sk-font-body)', fontSize: '1.1rem', margin: 0 }}>
                    <strong style={{ color: 'var(--sk-primary)' }}>{drawerName}</strong> is choosing a word...
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {/* Round Reveal Overlay */}
        {room.phase === 'ROUND_REVEAL' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', zIndex: 20, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div style={{ width: '100%', maxWidth: room.players.filter(p => !p.spectator).length > 8 ? '700px' : '500px', animation: 'skFadeIn 400ms ease forwards', textAlign: 'center' }}>
              <div className="sk-card" style={{ padding: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginBottom: '8px'}}>
                  <h2 style={{ fontFamily: 'var(--sk-font-display)', color: 'var(--sk-primary)', fontSize: '1.1rem', margin: 0 }}>THE WORD WAS</h2>
                  <div style={{ fontSize: '1.2rem', fontFamily: 'var(--sk-font-display)', color: 'var(--sk-text)', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1 }}>
                    {room.selectedWord}
                  </div>
                </div>
                {(() => {
                  const activePlayers = room.players.filter(p => !p.spectator)
                  // Stable sort by round score descending
                  const sortedPlayers = [...activePlayers].sort((a, b) => {
                    const scoreA = room.turnScores?.[a.id] || 0
                    const scoreB = room.turnScores?.[b.id] || 0
                    return scoreB - scoreA
                  })
                  
                  return (
                    <div style={{ 
                      display: 'grid',
                      gridTemplateColumns: `repeat(auto-fit, minmax(${sortedPlayers.length > 8 ? '100px' : '130px'}, 1fr))`,
                      gap: '4px',
                      width: '100%',
                      textAlign: 'left'
                    }}>
                      {sortedPlayers.map(p => {
                        const pts = room.turnScores?.[p.id] || 0
                        const isCorrect = pts > 0
                        const isDrawerRow = p.id === room.currentDrawerId
                        return (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', background: 'rgba(0,0,0,0.03)', borderRadius: '4px' }}>
                            <span style={{ fontFamily: 'var(--sk-font-body)', fontSize: '0.75rem', fontWeight: 700, color: 'var(--sk-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '4px' }}>
                              {p.name} {isDrawerRow && <span style={{ color: 'var(--sk-muted)', fontSize: '0.85em' }}>(Drawer)</span>}
                            </span>
                            <span style={{ fontFamily: 'var(--sk-font-display)', color: isCorrect ? '#55D6B0' : '#FF6F70', fontWeight: 'bold', fontSize: '0.85rem', flexShrink: 0 }}>
                              +{pts}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Game Result Overlay */}
        {room.phase === 'GAME_RESULT' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 30, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)' }}>
            <h1 style={{ fontFamily: 'var(--sk-font-display)', color: 'var(--sk-primary)', fontSize: '2.5rem', marginBottom: '20px' }}>GAME OVER</h1>
            <div className="sk-card" style={{ width: '100%', maxWidth: '400px', maxHeight: '60%', overflowY: 'auto' }}>
              {(() => {
                const sorted = [...room.players].sort((a, b) => b.score - a.score)
                return sorted.map((p, idx) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', borderBottom: idx < sorted.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', background: idx === 0 ? 'rgba(255, 200, 87, 0.2)' : 'transparent', borderRadius: idx === 0 ? '8px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontFamily: 'var(--sk-font-display)', fontSize: '1.2rem', color: idx === 0 ? '#FFC857' : 'var(--sk-muted)' }}>#{idx + 1}</span>
                      <span style={{ fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: 'var(--sk-text)' }}>{p.name} {p.id === sessionId && '(You)'}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--sk-font-body)', fontWeight: 800, color: 'var(--sk-primary)' }}>{p.score} pts</div>
                  </div>
                ))
              })()}
            </div>
            {room.hostId === sessionId ? (
              <button className="sk-btn" style={{ marginTop: '24px', padding: '16px 32px' }} onClick={() => getSocket().emit('draw:play-again')}>
                PLAY AGAIN
              </button>
            ) : (
              <div style={{ marginTop: '24px', color: 'var(--sk-muted)', fontFamily: 'var(--sk-font-body)', fontWeight: 700 }}>
                Waiting for host to play again...
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div style={{ flexShrink: 0, zIndex: lifted ? 30 : 10 }}>
        {(isDrawer && room.phase === 'DRAWING') ? (
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
        ) : (!isDrawer ? (
          <>
            {lifted && <div aria-hidden="true" style={{ height: barHeight, flexShrink: 0 }} />}
            <form 
              ref={guessBarRef}
              className={lifted ? 'sk-guess-bar--lifted' : undefined}
              onSubmit={handleGuessSubmit} 
              style={{ 
              display: 'flex', 
              gap: '8px', 
              padding: '8px 16px',
              background: 'var(--sk-surface)',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              borderBottom: '1px solid rgba(0,0,0,0.05)'
            }}>
              <input 
                ref={guessInputRef}
                type="text" 
                placeholder="Type your guess..."
                className="sk-input"
                style={{ margin: 0, padding: '8px 12px', fontSize: '1rem', flex: 1 }}
                value={guessInput}
                onChange={e => setGuessInput(e.target.value)}
                disabled={room.guessedPlayerIds?.includes(sessionId)}
                maxLength={120}
              />
              <button onPointerDown={(e) => e.preventDefault()} type="submit" className="sk-btn" style={{ width: 'auto', padding: '0 24px' }} disabled={!guessInput.trim()}>
                SEND
              </button>
            </form>
          </>
        ) : null)}
      </div>

      {/* LOWER INFO SECTION: Players & Chat */}
      <div className="sk-lower-info-section" style={{ 
        display: 'flex', 
        minHeight: 0,
        background: '#ffffff',
        zIndex: 10,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxSizing: 'border-box'
      }}>
        {/* Left Column: Player List */}
        <div style={{ flex: '0 0 45%', borderRight: '1px solid rgba(0,0,0,0.05)', minWidth: 0 }}>
          <PlayerStrip room={room} currentDrawerId={room.currentDrawerId} sessionId={sessionId} />
        </div>
        
        {/* Right Column: Chat Box */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }}>
          <ChatBox room={room} />
        </div>
      </div>
    </div>
  )
}
