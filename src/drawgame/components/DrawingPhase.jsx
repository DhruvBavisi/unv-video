import React, { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '../../game/socket.js'
import { ensureIdentity } from '../../game/identity.js'
import PlayerStrip from './PlayerStrip.jsx'
import DrawingToolbar, { DRAW_COLORS } from './DrawingToolbar.jsx'
import DrawingCanvas from './DrawingCanvas.jsx'
import ChatBox from './ChatBox.jsx'

export default function DrawingPhase({ room, onLeave }) {
  const { sessionId } = ensureIdentity()
  const isDrawer = room.currentDrawerId === sessionId

  const [color, setColor] = useState(DRAW_COLORS[0].value)
  const [size, setSize] = useState(8)
  const [timeRemaining, setTimeRemaining] = useState(room.configuration.drawTimeSec)
  const [guessInput, setGuessInput] = useState('')
  
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
    
    // Fetch initial state
    socket.emit('draw:request-strokes', (res) => {
      if (res && res.strokes) {
        strokesRef.current = res.strokes
        canvasRef.current?.redrawAll(strokesRef.current)
      }
    })

    const handleIncomingStroke = (stroke) => {
      strokesRef.current.push(stroke)
      canvasRef.current?.liveDraw(stroke)
    }

    const handleClear = () => {
      strokesRef.current = []
      canvasRef.current?.clear()
    }

    socket.on('draw:stroke', handleIncomingStroke)
    socket.on('draw:clear-canvas', handleClear)

    const handleResize = () => {
      setTimeout(() => {
        canvasRef.current?.redrawAll(strokesRef.current)
      }, 0)
    }
    window.addEventListener('resize', handleResize)

    return () => {
      socket.off('draw:stroke', handleIncomingStroke)
      socket.off('draw:clear-canvas', handleClear)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const handleStroke = useCallback((strokeData) => {
    const socket = getSocket()
    socket.emit('draw:stroke', strokeData)
    strokesRef.current.push(strokeData)
    // The drawer already imperatively drew this locally inside DrawingCanvas!
  }, [])

  const handleClearCanvas = () => {
    const socket = getSocket()
    socket.emit('draw:clear-canvas')
    strokesRef.current = []
    canvasRef.current?.clear()
  }

  const handleChooseWord = (word) => {
    const socket = getSocket()
    socket.emit('draw:choose-word', { word })
  }

  const handleGuessSubmit = (e) => {
    e.preventDefault()
    if (!guessInput.trim() || isDrawer) return
    const socket = getSocket()
    socket.emit('draw:guess', { message: guessInput.trim() })
    setGuessInput('')
  }

  // Formatting Drawer Text
  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'

  const topBarColor = timeRemaining <= 10 ? 'var(--sk-coral)' : 'var(--sk-primary)'

  return (
    <div className="sk-view" style={{ height: '100dvh', minHeight: 0, overflow: 'hidden' }}>
      {/* Background (light layout) */}
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>

      {/* TOP BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 20px', alignItems: 'center', background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(0,0,0,0.05)', zIndex: 10 }}>
        <div>
          <div style={{ fontSize: '0.7rem', color: 'var(--sk-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ROUND {room.round}/{room.totalRounds}</div>
          <div style={{ fontSize: '1rem', color: 'var(--sk-text)', fontFamily: 'var(--sk-font-body)', fontWeight: 700 }}>
            {isDrawer ? (
              <span>Draw: <strong style={{ color: 'var(--sk-primary)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{room.selectedWord}</strong></span>
            ) : (
              <span><strong>{drawerName}</strong> is drawing</span>
            )}
          </div>
        </div>
        
        <div style={{ 
          fontSize: '1.4rem', 
          fontFamily: 'var(--sk-font-display)', 
          color: topBarColor,
          background: 'var(--sk-surface)',
          padding: '4px 12px',
          borderRadius: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          transition: 'color 300ms ease'
        }}>
          {timeRemaining}
        </div>
      </div>

      {/* CANVAS AREA */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, background: 'var(--sk-canvas)', cursor: (isDrawer && room.phase === 'DRAWING') ? 'crosshair' : 'default', zIndex: 5 }}>
        <div style={{ position: 'absolute', inset: 0, opacity: room.phase === 'WORD_CHOICE' ? 0.3 : 1, transition: 'opacity 300ms ease', pointerEvents: room.phase === 'WORD_CHOICE' ? 'none' : 'auto' }}>
          <DrawingCanvas 
            ref={canvasRef}
            color={color}
            size={size}
            isDrawer={isDrawer && room.phase === 'DRAWING'}
            onStroke={handleStroke}
          />
        </div>
        
        {/* Visual boundary shadow */}
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)', pointerEvents: 'none' }} />

        {/* Word Choice Overlay */}
        {room.phase === 'WORD_CHOICE' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', zIndex: 20 }}>
            {isDrawer ? (
              <div style={{ width: '100%', maxWidth: '400px', animation: 'skFadeIn 400ms ease forwards', textAlign: 'center' }}>
                <h2 style={{ fontFamily: 'var(--sk-font-display)', color: 'var(--sk-text)', marginBottom: '8px', fontSize: '1.8rem', textShadow: '0 2px 8px rgba(255,255,255,0.8)' }}>CHOOSE A WORD</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '20px' }}>
                  {(room.wordChoices || []).map((word, idx) => (
                    <div 
                      key={idx}
                      className="sk-card"
                      style={{ 
                        cursor: 'pointer', 
                        padding: '16px', 
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
                      <div style={{ fontSize: '1.4rem', fontFamily: 'var(--sk-font-display)', color: 'var(--sk-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
      </div>

      {/* LOWER INFO SECTION: Players & Chat */}
      <div style={{ 
        display: 'flex', 
        height: '160px', 
        flexShrink: 0,
        borderTop: '1px solid rgba(0,0,0,0.05)', 
        background: 'rgba(255, 255, 255, 0.8)',
        zIndex: 10
      }}>
        {/* Left Column: Player List */}
        <div style={{ flex: '0 0 45%', borderRight: '1px solid rgba(0,0,0,0.05)', minWidth: 0 }}>
          <PlayerStrip room={room} currentDrawerId={room.currentDrawerId} />
        </div>
        
        {/* Right Column: Chat Box */}
        <div style={{ flex: '0 0 55%', minWidth: 0 }}>
          <ChatBox room={room} />
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      <div style={{ flexShrink: 0, zIndex: 10 }}>
        {(isDrawer && room.phase === 'DRAWING') ? (
          <DrawingToolbar 
            color={color} 
            setColor={setColor} 
            size={size} 
            setSize={setSize} 
            onClear={handleClearCanvas} 
          />
        ) : (!isDrawer ? (
          <form onSubmit={handleGuessSubmit} style={{ 
            display: 'flex', 
            gap: '8px', 
            padding: '8px 16px calc(8px + env(safe-area-inset-bottom, 0px))',
            background: 'var(--sk-surface)'
          }}>
            <input 
              type="text" 
              placeholder="Type your guess..."
              className="sk-input"
              style={{ margin: 0, padding: '12px 16px', fontSize: '1rem', flex: 1 }}
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              disabled={room.guessedPlayerIds?.includes(sessionId)}
              maxLength={120}
            />
            <button type="submit" className="sk-btn" style={{ width: 'auto', padding: '0 24px' }} disabled={!guessInput.trim()}>
              SEND
            </button>
          </form>
        ) : null)}
      </div>
    </div>
  )
}
