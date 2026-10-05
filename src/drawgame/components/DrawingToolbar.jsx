import React, { useState, useRef, useEffect } from 'react'

export const DRAW_COLORS = [
  { name: 'white', value: '#FFFFFF' }, { name: 'light-gray', value: '#C1C1C1' }, { name: 'gray', value: '#505050' }, { name: 'black', value: '#000000' }, { name: 'dark-brown', value: '#4A2511' }, { name: 'brown', value: '#7A3F1F' }, { name: 'red', value: '#FF0000' }, { name: 'dark-red', value: '#7D0000' },
  { name: 'orange', value: '#FF7F00' }, { name: 'yellow', value: '#FFFF00' }, { name: 'lime', value: '#00FF00' }, { name: 'green', value: '#007D00' }, { name: 'cyan', value: '#00FFFF' }, { name: 'teal', value: '#007D7D' }, { name: 'blue', value: '#0000FF' }, { name: 'dark-blue', value: '#00007D' },
  { name: 'magenta', value: '#FF00FF' }, { name: 'purple', value: '#7D007D' }, { name: 'pink', value: '#FFA07A' }, { name: 'peach', value: '#FFC0CB' }, { name: 'sky', value: '#87CEEB' }, { name: 'navy', value: '#000080' }, { name: 'olive', value: '#808000' }, { name: 'maroon', value: '#800000' }
]

export default function DrawingToolbar({ color, setColor, size, setSize, tool, setTool, onClear, onUndo }) {
  const [showPalette, setShowPalette] = useState(false);
  const paletteRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target)) {
        setShowPalette(false);
      }
    };
    if (showPalette) document.addEventListener('mousedown', handleClickOutside);
    if (showPalette) document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showPalette]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Expanded Palette Popup */}
      {showPalette && (
        <div ref={paletteRef} style={{ 
          position: 'absolute', 
          bottom: '100%', 
          left: '12px', 
          marginBottom: '8px', 
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: '12px',
          padding: '12px',
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 1fr)',
          gap: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          zIndex: 20
        }}>
          {DRAW_COLORS.map(c => (
            <div 
              key={c.name}
              onClick={() => { setColor(c.value); setShowPalette(false); }}
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '4px',
                background: c.value,
                border: c.value === '#FFFFFF' ? '1px solid rgba(0,0,0,0.1)' : '1px solid rgba(0,0,0,0.05)',
                boxShadow: color === c.value ? '0 0 0 2px var(--sk-primary)' : 'none',
                cursor: 'pointer'
              }}
            />
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ 
        padding: '8px 12px', 
        background: 'rgba(255, 255, 255, 0.8)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0,0,0,0.05)',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        
        {/* Left: Color & Tools */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          
          {/* Current Color Box */}
          <div 
            onClick={() => setShowPalette(!showPalette)}
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '6px', 
              backgroundColor: color, 
              border: color === '#FFFFFF' ? '1px solid rgba(0,0,0,0.2)' : '1px solid rgba(0,0,0,0.1)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
              cursor: 'pointer'
            }} 
          />

          <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)' }} />

          {/* Tools: Brush, Fill, Eraser */}
          <div style={{ display: 'flex', gap: '2px' }}>
            {['brush', 'fill', 'eraser'].map(t => (
              <button
                key={t}
                onClick={() => setTool(t)}
                style={{
                  background: tool === t ? 'var(--sk-bg-soft)' : 'transparent',
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  color: tool === t ? 'var(--sk-primary)' : 'var(--sk-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px'
                }}
                title={t.toUpperCase()}
              >
                {t === 'brush' && (
                  <img src="/images/svg/pencil.svg" alt="Brush" width="20" height="20" style={{ display: 'block', objectFit: 'contain' }} />
                )}
                {t === 'fill' && (
                  <img src="/images/svg/fill_bucket.svg" alt="Fill" width="20" height="20" style={{ display: 'block', objectFit: 'contain' }} />
                )}
                {t === 'eraser' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L20 9C20.5 9.5 20.5 10.5 20 11L11 20"/><path d="M10 10l5 5"/></svg>
                )}
              </button>
            ))}
          </div>

          <div style={{ width: '1px', height: '24px', background: 'rgba(0,0,0,0.1)' }} />

          {/* Sizes */}
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            {[4, 8, 16].map(s => (
              <button
                key={s}
                onClick={() => setSize(s)}
                style={{
                  background: size === s ? 'var(--sk-bg-soft)' : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <div style={{ width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: size === s ? 'var(--sk-primary)' : 'var(--sk-muted)' }} />
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', gap: '2px' }}>
          <button 
            onClick={onUndo}
            style={{ 
              background: 'transparent', 
              border: 'none',
              padding: '6px', 
              borderRadius: '6px',
              color: 'var(--sk-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
            title="UNDO"
          >
            <img src="/images/svg/undo.svg" alt="Undo" width="20" height="20" style={{ display: 'block', objectFit: 'contain' }} />
          </button>
          <button 
            onClick={onClear}
            style={{ 
              background: 'transparent', 
              border: 'none',
              padding: '6px', 
              borderRadius: '6px',
              color: 'var(--sk-coral)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px'
            }}
            title="CLEAR"
          >
            <img src="/images/svg/dustbin.svg" alt="Clear" width="20" height="20" style={{ display: 'block', objectFit: 'contain' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
