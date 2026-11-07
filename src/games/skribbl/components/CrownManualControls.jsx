import React, { useState, useEffect } from 'react'
import { CROWN_LAYOUT } from '../utils/skribblAvatarLayout.js'

/**
 * CrownManualControls
 * Interactive dev-friendly on-screen adjuster for the crown position, angle, scale, and size.
 * Allows the user to live-tune crown positioning on screen and copy the exact JS config.
 */
export default function CrownManualControls({ defaultMode = 'lobby' }) {
  if (!import.meta.env.DEV) return null

  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState(defaultMode)
  const [copied, setCopied] = useState(false)

  const getActiveConfig = (m) => {
    const base = CROWN_LAYOUT[m] || CROWN_LAYOUT.lobby
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`skribbl_crown_${m}`)
        if (stored) return { ...base, ...JSON.parse(stored) }
      } catch {
        // ignore
      }
    }
    return { ...base }
  }

  const [config, setConfig] = useState(() => getActiveConfig(defaultMode))

  useEffect(() => {
    setConfig(getActiveConfig(mode))
  }, [mode])

  // Save to localStorage and notify listeners whenever config changes
  const updateProp = (prop, value) => {
    const updated = { ...config, [prop]: value }
    setConfig(updated)
    try {
      localStorage.setItem(`skribbl_crown_${mode}`, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('skribbl:crown-update', { detail: { mode, config: updated } }))
    } catch {
      // ignore
    }
  }

  const resetDefaults = () => {
    const base = CROWN_LAYOUT[mode] || CROWN_LAYOUT.lobby
    try {
      localStorage.removeItem(`skribbl_crown_${mode}`)
      window.dispatchEvent(new CustomEvent('skribbl:crown-update', { detail: { mode, config: base } }))
    } catch {
      // ignore
    }
    setConfig({ ...base })
  }

  const copyConfig = async () => {
    const code = `${mode}: { top: ${config.top}, left: ${config.left}, angle: ${config.angle}, scale: ${config.scale}, size: ${config.size} },`
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Keyboard shortcut: Shift+C toggles adjuster
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.shiftKey && (e.key === 'C' || e.key === 'c') && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        setIsOpen(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '12px',
          zIndex: 999999,
          background: 'rgba(15, 35, 95, 0.92)',
          color: '#ffd000',
          border: '2px solid rgba(255, 208, 0, 0.6)',
          borderRadius: '20px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(8px)',
          userSelect: 'none',
        }}
        title="Open Crown Position Manual Adjuster (Shift+C)"
      >
        <span>👑</span>
        <span>Adjust Crown</span>
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '12px',
        right: '12px',
        zIndex: 999999,
        background: '#0a1633',
        color: '#ffffff',
        border: '2px solid #ffd000',
        borderRadius: '12px',
        padding: '14px',
        width: '280px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontWeight: 'bold', color: '#ffd000', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>👑</span>
          <span>Crown Manual Controls</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#aaccff',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '2px 6px',
            lineHeight: 1,
          }}
          title="Close Controls"
        >
          ✕
        </button>
      </div>

      {/* Mode Switcher */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        <button
          type="button"
          onClick={() => setMode('home')}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: mode === 'home' ? '#ffd000' : 'rgba(255,255,255,0.1)',
            color: mode === 'home' ? '#000000' : '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Home (#7)
        </button>
        <button
          type="button"
          onClick={() => setMode('lobby')}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: mode === 'lobby' ? '#ffd000' : 'rgba(255,255,255,0.1)',
            color: mode === 'lobby' ? '#000000' : '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Lobby Host
        </button>
      </div>

      {/* Steppers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Top (Y) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#99bbff' }}>Top (Y):</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => updateProp('top', config.top - 1)}
              style={btnStyle}
            >
              -
            </button>
            <span style={valStyle}>{config.top}px</span>
            <button
              type="button"
              onClick={() => updateProp('top', config.top + 1)}
              style={btnStyle}
            >
              +
            </button>
          </div>
        </div>

        {/* Left (X) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#99bbff' }}>Left (X):</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => updateProp('left', config.left - 1)}
              style={btnStyle}
            >
              -
            </button>
            <span style={valStyle}>{config.left}px</span>
            <button
              type="button"
              onClick={() => updateProp('left', config.left + 1)}
              style={btnStyle}
            >
              +
            </button>
          </div>
        </div>

        {/* Angle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#99bbff' }}>Angle:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => updateProp('angle', config.angle - 1)}
              style={btnStyle}
            >
              -
            </button>
            <span style={valStyle}>{config.angle}°</span>
            <button
              type="button"
              onClick={() => updateProp('angle', config.angle + 1)}
              style={btnStyle}
            >
              +
            </button>
          </div>
        </div>

        {/* Scale */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#99bbff' }}>Scale:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => updateProp('scale', Math.max(0.5, +(config.scale - 0.05).toFixed(2)))}
              style={btnStyle}
            >
              -
            </button>
            <span style={valStyle}>{config.scale}x</span>
            <button
              type="button"
              onClick={() => updateProp('scale', +(config.scale + 0.05).toFixed(2))}
              style={btnStyle}
            >
              +
            </button>
          </div>
        </div>

        {/* Size */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#99bbff' }}>Size:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              onClick={() => updateProp('size', Math.max(10, config.size - 1))}
              style={btnStyle}
            >
              -
            </button>
            <span style={valStyle}>{config.size}px</span>
            <button
              type="button"
              onClick={() => updateProp('size', config.size + 1)}
              style={btnStyle}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px' }}>
        <button
          type="button"
          onClick={copyConfig}
          style={{
            flex: 1,
            padding: '7px',
            background: copied ? '#22c55e' : '#ffd000',
            color: '#000000',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer',
            transition: 'background 150ms ease',
          }}
        >
          {copied ? '✓ Copied Config!' : '📋 Copy Config'}
        </button>
        <button
          type="button"
          onClick={resetDefaults}
          style={{
            padding: '7px 10px',
            background: 'rgba(255, 255, 255, 0.12)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
          title="Reset to skribblAvatarLayout.js values"
        >
          ↺ Reset
        </button>
      </div>
      <div style={{ fontSize: '10px', color: '#6688aa', marginTop: '8px', textAlign: 'center' }}>
        Edits apply live & save to localStorage. Paste into <code>skribblAvatarLayout.js</code>.
      </div>
    </div>
  )
}

const btnStyle = {
  width: '24px',
  height: '24px',
  background: 'rgba(255, 255, 255, 0.15)',
  border: '1px solid rgba(255, 255, 255, 0.25)',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  lineHeight: 1,
}

const valStyle = {
  minWidth: '48px',
  textAlign: 'center',
  fontWeight: 'bold',
  fontSize: '12px',
  color: '#ffffff',
}

