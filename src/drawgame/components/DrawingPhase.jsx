import React, { useState, useEffect, useRef } from 'react'
import { getSocket } from '../../game/socket.js'
import { ensureIdentity } from '../../game/identity.js'
import PlayerStrip from './PlayerStrip.jsx'
import DrawingToolbar, { DRAW_COLORS } from './DrawingToolbar.jsx'
import DrawingCanvas from './DrawingCanvas.jsx'

export default function DrawingPhase({ room, onLeave }) {
  const { sessionId } = ensureIdentity()
  const isDrawer = room.currentDrawerId === sessionId

  const [color, setColor] = useState(DRAW_COLORS[0].value)
  const [size, setSize] = useState(8)
  const [timeRemaining, setTimeRemaining] = useState(room.configuration.drawTimeSec)
  
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

  const handleStroke = (strokeData) => {
    const socket = getSocket()
    socket.emit('draw:stroke', strokeData)
    strokesRef.current.push(strokeData)
    // The drawer already imperatively drew this locally inside DrawingCanvas!
  }

  const handleClearCanvas = () => {
    const socket = getSocket()
    socket.emit('draw:clear-canvas')
    strokesRef.current = []
    canvasRef.current?.clear()
  }

  // Formatting Drawer Text
  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'

  const topBarColor = timeRemaining <= 10 ? 'var(--sk-coral)' : 'var(--sk-primary)'

  return (
    <div className="sk-view" style={{ overflow: 'hidden' }}>
      {/* Background (light layout) */}
      <div className="sk-bg-shapes">
        <div className="sk-bg-shape sk-bg-shape-1" />
        <div className="sk-bg-shape sk-bg-shape-2" />
        <div className="sk-bg-shape sk-bg-shape-3" />
      </div>

      <PlayerStrip room={room} currentDrawerId={room.currentDrawerId} />

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
      <div style={{ flex: 1, position: 'relative', background: 'var(--sk-canvas)', cursor: isDrawer ? 'crosshair' : 'default', zIndex: 5 }}>
        <DrawingCanvas 
          ref={canvasRef}
          color={color}
          size={size}
          isDrawer={isDrawer}
          onStroke={handleStroke}
        />
        
        {/* Visual boundary shadow */}
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 20px rgba(0,0,0,0.03)', pointerEvents: 'none' }} />
      </div>

      {/* BOTTOM CONTROLS */}
      {isDrawer ? (
        <DrawingToolbar 
          color={color} 
          setColor={setColor} 
          size={size} 
          setSize={setSize} 
          onClear={handleClearCanvas} 
        />
      ) : (
        <div style={{ 
          padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', 
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(0,0,0,0.05)',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Type your guess..."
              className="sk-input"
              style={{ margin: 0, padding: '12px 16px', fontSize: '1.1rem' }}
              disabled
            />
            <button className="sk-btn" style={{ width: 'auto', padding: '0 24px' }} disabled>
              SEND
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--sk-muted)', textAlign: 'center', marginTop: '12px', fontWeight: 600 }}>
            Guessing logic coming next phase!
          </div>
        </div>
      )}
    </div>
  )
}
