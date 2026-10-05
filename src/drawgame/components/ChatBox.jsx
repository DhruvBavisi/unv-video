import React, { useState, useEffect, useRef } from 'react'
import { getSocket } from '../../game/socket.js'

export default function ChatBox({ room }) {
  const containerRef = useRef(null)

  // Scroll to bottom when messages change without triggering window scroll or focus shifts
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [room.chatMessages])

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      width: '100%',
      background: 'white'
    }}>
      {/* Messages Area */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          overflowY: 'auto', 
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {(room.chatMessages || []).map((msg, i) => {
          let style = { 
            fontSize: '0.8rem', 
            lineHeight: '1.2', 
            fontFamily: 'var(--sk-font-body)', 
            fontWeight: 700, 
            padding: '4px 6px', 
            background: i % 2 === 0 ? '#F1F1F1' : '#FFFFFF',
            color: '#333333',
            borderRadius: 0
          }
          let content = null

          if (msg.type === 'SYSTEM') {
            style.fontWeight = 800
            const text = msg.message || ''
            if (text.includes('joined')) {
              style.color = '#359b35'
            } else if (text.includes('left')) {
              style.color = '#cc4e14'
            } else {
              style.color = '#777777'
            }
            content = msg.message
          } else if (msg.type === 'CORRECT') {
            style.background = '#CFFFBD'
            style.color = '#359b35'
            content = `${msg.playerName} guessed the word!`
          } else if (msg.type === 'CLOSE') {
            style.background = '#FFFDC2'
            style.color = '#d69e2e'
            content = `${msg.playerName} is close!`
          } else if (msg.type === 'REACTION') {
            if (msg.reaction === 'LIKE') {
              style.background = '#CFFFBD'
              style.color = '#359b35'
            } else {
              style.background = '#FFDCDC'
              style.color = '#cc4e14'
            }
            content = msg.message
          } else {
            // NORMAL CHAT
            content = <span><strong style={{color: 'black'}}>{msg.playerName}:</strong> {msg.message}</span>
          }

          return (
            <div key={msg.id || i} style={style}>
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
