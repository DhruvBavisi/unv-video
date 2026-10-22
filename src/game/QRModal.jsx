import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'

const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function QRModal({ joinUrl, roomId, onClose, mode = 'undercover' }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const [copied, setCopied] = useState(false)
  const overlayRef = useRef(null)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setAnimState(ANIM_OPEN))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    if (animState !== ANIM_EXITING) return
    const timer = setTimeout(() => onClose(), 200)
    return () => clearTimeout(timer)
  }, [animState, onClose])

  const handleClose = useCallback(() => {
    if (animState === ANIM_EXITING) return
    setAnimState(ANIM_EXITING)
  }, [animState])

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) handleClose()
  }, [handleClose])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [handleClose])

  const isSkribbl = mode === 'skribbl'
  const isVisible = animState === ANIM_OPEN

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    backgroundColor: isSkribbl ? 'rgba(38, 51, 74, 0.92)' : 'rgba(11, 12, 13, 0.92)',
    zIndex: 1000000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px calc(16px + env(safe-area-inset-bottom, 0px)) 16px',
    boxSizing: 'border-box',
    opacity: isVisible ? 1 : 0,
    transition: 'opacity 200ms ease',
  }

  const panelStyle = isSkribbl 
    ? {
        maxWidth: '360px',
        width: '90%',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        background: 'var(--sk-surface)',
        color: 'var(--sk-text)',
        borderRadius: '24px',
        border: '3px solid var(--sk-primary)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.4)',
      }
    : {
        maxWidth: '360px',
        width: '90%',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        position: 'relative',
        background: 'rgba(28, 29, 31, 0.98)',
        color: 'var(--text-primary)',
        borderRadius: '12px',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '0 24px 60px rgba(0, 0, 0, 0.7)',
      }

  return createPortal(
    <div ref={overlayRef} onClick={handleOverlayClick} style={overlayStyle}>
      <div style={panelStyle}>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Close QR"
          style={{
            position: 'absolute',
            top: '12px',
            right: '16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: isSkribbl ? 'var(--sk-muted)' : 'var(--text-secondary)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 style={{ fontFamily: isSkribbl ? 'var(--sk-font-display)' : 'var(--font-display)', fontSize: '1.5rem', marginBottom: '8px', letterSpacing: '0.1em' }}>ROOM {roomId}</h2>
        <p style={{ color: isSkribbl ? 'var(--sk-muted)' : 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center', fontSize: '0.9rem', fontFamily: isSkribbl ? 'var(--sk-font-body)' : undefined }}>
          {isSkribbl ? 'Scan this code to join the Skribbl game' : 'Scan this code to join the investigation'}
        </p>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <QRCodeSVG value={joinUrl} size={200} level="M" style={{ display: 'block', imageRendering: 'pixelated' }} />
        </div>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden', boxSizing: 'border-box' }}>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'all', flex: 1 }}>{joinUrl}</p>
          <button 
            type="button" 
            onClick={async () => {
              try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(joinUrl)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }
              } catch (e) {}
            }}
            style={{ background: 'transparent', border: 'none', color: copied ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Copy URL"
            aria-label="Copy URL"
          >
            {copied ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
