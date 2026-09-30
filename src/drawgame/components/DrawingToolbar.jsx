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
                onClick={() => { if (t !== 'fill') setTool(t) }}
                style={{
                  background: tool === t ? 'var(--sk-bg-soft)' : 'transparent',
                  border: 'none',
                  padding: '6px',
                  borderRadius: '6px',
                  color: tool === t ? 'var(--sk-primary)' : 'var(--sk-muted)',
                  cursor: t === 'fill' ? 'not-allowed' : 'pointer',
                  opacity: t === 'fill' ? 0.5 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px'
                }}
                title={t.toUpperCase()}
              >
                {t === 'brush' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>
                )}
                {t === 'fill' && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19.38 12.03l-7.7-7.7a2 2 0 0 0-2.83 0l-4.5 4.5a2 2 0 0 0 0 2.83l7.7 7.7"/><path d="M14 20h8"/><path d="M14 14l-3-3"/></svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/></svg>
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
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
