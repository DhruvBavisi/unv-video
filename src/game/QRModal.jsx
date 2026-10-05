import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { QRCodeSVG } from 'qrcode.react'

const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function QRModal({ joinUrl, roomId, onClose, buttonRect, mode = 'undercover' }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const [copied, setCopied] = useState(false)
  const overlayRef = useRef(null)

  const getOriginVars = useCallback(() => {
    if (!buttonRect) return {}
    const vw = window.innerWidth
    const vh = window.innerHeight
    const bx = buttonRect.left + buttonRect.width / 2
    const by = buttonRect.top + buttonRect.height / 2
    const px = vw / 2
    const py = vh / 2
    return {
      '--fly-tx': `${bx - px}px`,
      '--fly-ty': `${by - py}px`,
    }
  }, [buttonRect])

  useEffect(() => {
    if (animState !== ANIM_ENTERING) return
    const timer = setTimeout(() => setAnimState(ANIM_OPEN), 500)
    return () => clearTimeout(timer)
  }, [animState])

  useEffect(() => {
    if (animState !== ANIM_EXITING) return
    const timer = setTimeout(() => onClose(), 480)
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

  const animClass = animState === ANIM_ENTERING ? 'players-panel--entering' : animState === ANIM_EXITING ? 'players-panel--exiting' : 'players-panel--open'
  const overlayClass = animState === ANIM_ENTERING ? 'players-panel-overlay--entering' : animState === ANIM_EXITING ? 'players-panel-overlay--exiting' : 'players-panel-overlay--open'

  const isSkribbl = mode === 'skribbl'
  const panelStyle = isSkribbl 
    ? { ...getOriginVars(), maxWidth: '360px', width: '90%', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto', position: 'relative', background: 'var(--sk-card)', color: 'var(--sk-text)', borderRadius: '24px', border: '3px solid var(--sk-primary)' }
    : { ...getOriginVars(), maxWidth: '360px', width: '90%', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto', position: 'relative' }

  return createPortal(
    <div className={`players-panel-overlay ${overlayClass}`} ref={overlayRef} onClick={handleOverlayClick} style={{ zIndex: 1000000 }}>
      <div className={`players-panel ${animClass}`} style={panelStyle}>
        <button type="button" className="players-panel-close" onClick={handleClose} aria-label="Close QR" style={{ position: 'absolute', top: '5px', right: '16px', color: isSkribbl ? 'var(--sk-muted)' : undefined }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 style={{ fontFamily: isSkribbl ? 'var(--sk-font-display)' : 'var(--font-display)', fontSize: '1.5rem', marginBottom: '8px', letterSpacing: '0.1em' }}>ROOM {roomId}</h2>
        <p style={{ color: isSkribbl ? 'var(--sk-muted)' : 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center', fontSize: '0.9rem', fontFamily: isSkribbl ? 'var(--sk-font-body)' : undefined }}>
          {isSkribbl ? 'Scan this code to join the Skribbl game' : 'Scan this code to join the investigation'}
        </p>
        <div style={{ background: '#ffffff', padding: '16px', borderRadius: '12px', marginBottom: '24px' }}>
          <QRCodeSVG value={joinUrl} size={200} level="M" />
        </div>
        <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center', overflow: 'hidden' }}>
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
