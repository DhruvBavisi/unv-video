import React, { useState, useEffect, useRef } from 'react'
import { getSocket } from '../../game/socket.js'

export default function ChatBox({ room }) {
  const messagesEndRef = useRef(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [room.chatMessages])

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%'
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
    </div>
  )
}
