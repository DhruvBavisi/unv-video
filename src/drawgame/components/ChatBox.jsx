import React, { useState, useEffect, useRef } from 'react'
import { getSocket } from '../../game/socket.js'

export default function ChatBox({ room }) {
  const messagesEndRef = useRef(null)

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
        padding: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px'
      }}>
        {(room.chatMessages || []).map((msg, i) => {
          let style = { fontSize: '0.75rem', lineHeight: '1.2', fontFamily: 'var(--sk-font-body)', fontWeight: 600, padding: '1px 4px', borderRadius: '4px' }
          let content = null

          if (msg.type === 'SYSTEM') {
            style.color = 'var(--sk-muted)'
            style.textAlign = 'center'
            style.fontSize = '0.65rem'
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
