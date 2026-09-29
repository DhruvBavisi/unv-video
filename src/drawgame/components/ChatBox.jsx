import React, { useState, useEffect, useRef } from 'react'
import { getSocket } from '../../game/socket.js'

export default function ChatBox({ room, isDrawer, onGuess, sessionId }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.chatMessages])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!input.trim() || isDrawer) return
    onGuess(input.trim())
    setInput('')
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(0,0,0,0.05)',
      height: '180px', // Fixed height for chat area to keep canvas primary
      zIndex: 10
    }}>
      {/* Messages Area */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        {(room.chatMessages || []).map((msg, i) => {
          let style = { fontSize: '0.9rem', fontFamily: 'var(--sk-font-body)', fontWeight: 600, padding: '4px 8px', borderRadius: '8px' }
          let content = null

          if (msg.type === 'SYSTEM') {
            style.color = 'var(--sk-muted)'
            style.textAlign = 'center'
            style.fontSize = '0.8rem'
            content = msg.message
          } else if (msg.type === 'CORRECT') {
            style.color = 'var(--sk-surface)'
            style.background = 'var(--sk-mint)'
            content = `✓ ${msg.playerName} guessed the word!`
          } else if (msg.type === 'CLOSE') {
            style.color = 'var(--sk-surface)'
            style.background = 'var(--sk-yellow)'
            content = `${msg.playerName} is close!`
          } else {
            // NORMAL CHAT
            style.color = 'var(--sk-text)'
            content = <span><strong>{msg.playerName}:</strong> {msg.message}</span>
          }

          return (
            <div key={msg.id || i} style={style}>
              {content}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!isDrawer && (
        <form onSubmit={handleSubmit} style={{ 
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
            value={input}
            onChange={e => setInput(e.target.value)}
            disabled={room.guessedPlayerIds?.includes(sessionId)}
            maxLength={120}
          />
          <button type="submit" className="sk-btn" style={{ width: 'auto', padding: '0 24px' }} disabled={!input.trim()}>
            SEND
          </button>
        </form>
      )}
    </div>
  )
}
