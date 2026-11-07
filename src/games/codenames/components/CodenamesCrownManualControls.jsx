import React, { useState, useEffect } from 'react'
import { CODENAMES_CROWN_LAYOUT } from '../utils/codenamesCrownLayout.js'

/**
 * CodenamesCrownManualControls
 * Interactive dev-friendly on-screen adjuster for the Codenames crown position, angle, scale, and size.
 * Allows the user to live-tune crown positioning on screen and copy the exact JS config.
 */
export default function CodenamesCrownManualControls({ defaultMode = 'lobby' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState(defaultMode)
  const [copied, setCopied] = useState(false)

  const getActiveConfig = (m) => {
    const base = CODENAMES_CROWN_LAYOUT[m] || CODENAMES_CROWN_LAYOUT.lobby
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`codenames_crown_${m}`)
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
      localStorage.setItem(`codenames_crown_${mode}`, JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('codenames:crown-update', { detail: { mode, config: updated } }))
    } catch {
      // ignore
    }
  }

  const resetDefaults = () => {
    const base = CODENAMES_CROWN_LAYOUT[mode] || CODENAMES_CROWN_LAYOUT.lobby
    try {
      localStorage.removeItem(`codenames_crown_${mode}`)
      window.dispatchEvent(new CustomEvent('codenames:crown-update', { detail: { mode, config: base } }))
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
          background: 'rgba(15, 23, 42, 0.94)',
          color: '#fbbf24',
          border: '2px solid rgba(251, 191, 36, 0.7)',
          borderRadius: '20px',
          padding: '6px 14px',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          backdropFilter: 'blur(8px)',
          userSelect: 'none',
        }}
        title="Open Codenames Crown Manual Adjuster (Shift+C)"
      >
        <span>👑</span>
        <span>Adjust Codenames Crown</span>
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
        background: '#090e17',
        color: '#ffffff',
        border: '2px solid #fbbf24',
        borderRadius: '12px',
        padding: '14px',
        width: '280px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.85)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '13px',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontWeight: 'bold', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>👑</span>
          <span>Codenames Crown Controls</span>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
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
          onClick={() => setMode('lobby')}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: mode === 'lobby' ? '#fbbf24' : 'rgba(255,255,255,0.08)',
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
        <button
          type="button"
          onClick={() => setMode('board')}
          style={{
            flex: 1,
            padding: '5px 8px',
            background: mode === 'board' ? '#fbbf24' : 'rgba(255,255,255,0.08)',
            color: mode === 'board' ? '#000000' : '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Board Host
        </button>
      </div>

      {/* Steppers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Top (Y) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#94a3b8' }}>Top (Y):</span>
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
          <span style={{ color: '#94a3b8' }}>Left (X):</span>
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
          <span style={{ color: '#94a3b8' }}>Angle:</span>
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
          <span style={{ color: '#94a3b8' }}>Scale:</span>
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
          <span style={{ color: '#94a3b8' }}>Size:</span>
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
            background: copied ? '#22c55e' : '#fbbf24',
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
            background: 'rgba(255, 255, 255, 0.1)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '11px',
            cursor: 'pointer',
          }}
          title="Reset to codenamesCrownLayout.js defaults"
        >
          ↺ Reset
        </button>
      </div>
      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
        Edits apply live & save to localStorage. Paste into <code>codenamesCrownLayout.js</code>.
      </div>
    </div>
  )
}

const btnStyle = {
  width: '24px',
  height: '24px',
  background: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.2)',
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

