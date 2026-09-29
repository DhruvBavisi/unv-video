import React from 'react'

export const DRAW_COLORS = [
  { name: 'ink', value: '#26334A' },
  { name: 'white', value: '#FFFFFF' },
  { name: 'primary', value: '#6174F4' },
  { name: 'coral', value: '#FF6F70' },
  { name: 'yellow', value: '#FFC857' },
  { name: 'mint', value: '#55D6B0' },
  { name: 'sky', value: '#65C7F3' },
  { name: 'lavender', value: '#A98AF5' }
]

export default function DrawingToolbar({ color, setColor, size, setSize, onClear }) {
  return (
    <div style={{ 
      padding: '12px 16px calc(12px + env(safe-area-inset-bottom, 0px))', 
      background: 'rgba(255, 255, 255, 0.8)',
      backdropFilter: 'blur(12px)',
      borderTop: '1px solid rgba(0,0,0,0.05)',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[4, 8, 16].map(s => (
            <div 
              key={s}
              onClick={() => setSize(s)}
              style={{
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: size === s ? 'white' : 'transparent',
                borderRadius: '8px',
                boxShadow: size === s ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              <div style={{ width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: 'var(--sk-text)' }} />
            </div>
          ))}
        </div>
        
        <button 
          onClick={onClear}
          style={{ 
            background: 'var(--sk-surface)', 
            border: '2px solid var(--sk-bg-soft)', 
            padding: '8px 16px', 
            borderRadius: '100px',
            fontFamily: 'var(--sk-font-display)',
            color: 'var(--sk-muted)',
            cursor: 'pointer',
            touchAction: 'manipulation'
          }}
        >
          CLEAR
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {DRAW_COLORS.map(c => (
          <div 
            key={c.name}
            onClick={() => setColor(c.value)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: c.value,
              border: c.value === '#FFFFFF' ? '2px solid var(--sk-bg-soft)' : 'none',
              transform: color === c.value ? 'scale(1.2)' : 'scale(1)',
              boxShadow: color === c.value ? `0 4px 12px ${c.value}66` : 'none',
              transition: 'all 150ms ease',
              cursor: 'pointer',
              touchAction: 'manipulation'
            }}
          />
        ))}
      </div>
    </div>
  )
}
