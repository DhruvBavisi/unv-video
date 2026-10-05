import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Scanner } from '@yudiel/react-qr-scanner'

const ANIM_ENTERING = 'ENTERING'
const ANIM_OPEN = 'OPEN'
const ANIM_EXITING = 'EXITING'

export default function QRScannerModal({ onClose, onScan, expectedMode = 'undercover' }) {
  const [animState, setAnimState] = useState(ANIM_ENTERING)
  const overlayRef = useRef(null)
  const containerRef = useRef(null)

  const [cameraError, setCameraError] = useState(false)
  const [scannerKey, setScannerKey] = useState(0)

  useEffect(() => {
    if (animState !== ANIM_ENTERING) return
    const timer = setTimeout(() => setAnimState(ANIM_OPEN), 500)
    return () => clearTimeout(timer)
  }, [animState])

  useEffect(() => {
    if (animState !== ANIM_EXITING) return
    const timer = setTimeout(() => onClose(shouldFocusOnClose.current), 480)
    return () => clearTimeout(timer)
  }, [animState, onClose])

  const shouldFocusOnClose = useRef(false)

  const handleClose = useCallback((focusInput = false) => {
    if (animState === ANIM_EXITING) return
    if (focusInput === true) shouldFocusOnClose.current = true
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

  const handleScan = (result) => {
    if (result && result.length > 0) {
      const text = result[0].rawValue || result[0] // fallback in case older version structure
      try {
        const url = new URL(text)
        const room = url.searchParams.get('room')
        const mode = url.searchParams.get('mode') || 'undercover'

        if (room && room.length === 6 && mode === expectedMode) {
          onScan(room.toUpperCase())
          handleClose()
        }
      } catch (e) {
        // If it's not a URL, maybe it's just a 6 character code?
        if (typeof text === 'string' && text.length === 6 && /^[a-zA-Z0-9]{6}$/.test(text)) {
          onScan(text.toUpperCase())
          handleClose()
        }
      }
    }
  }

  const handleError = (error) => {
    setCameraError(true)
  }

  // Fallback timeout in case no error is thrown but no stream is available
  useEffect(() => {
    if (cameraError) return
    
    let elapsed = 0
    const pollInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      
      const video = containerRef.current?.querySelector('video')
      if (video && video.videoWidth > 0 && video.readyState >= 2) {
        clearInterval(pollInterval)
        return
      }
      
      elapsed += 500
      if (elapsed >= 12000) {
        setCameraError(true)
        clearInterval(pollInterval)
      }
    }, 500)
    
    return () => clearInterval(pollInterval)
  }, [cameraError, scannerKey])

  const animClass = animState === ANIM_ENTERING ? 'players-panel--entering' : animState === ANIM_EXITING ? 'players-panel--exiting' : 'players-panel--open'
  const overlayClass = animState === ANIM_ENTERING ? 'players-panel-overlay--entering' : animState === ANIM_EXITING ? 'players-panel-overlay--exiting' : 'players-panel-overlay--open'

  return createPortal(
    <div className={`players-panel-overlay ${overlayClass}`} ref={overlayRef} onClick={handleOverlayClick} style={{ zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className={`players-panel ${animClass}`} style={{ transform: animState === ANIM_ENTERING ? 'scale(0.8)' : 'scale(1)', transition: 'transform 0.4s cubic-bezier(0.22, 0.61, 0.36, 1), opacity 0.4s ease', maxWidth: '400px', width: '90%', padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto', position: 'relative', opacity: animState === ANIM_ENTERING ? 0 : 1 }}>
        <button type="button" className="players-panel-close" onClick={handleClose} aria-label="Close QR Scanner" style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', marginBottom: '8px', letterSpacing: '0.1em' }}>SCAN QR</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', textAlign: 'center', fontSize: '0.9rem' }}>Point camera at the investigation code</p>
        
        <div ref={containerRef} style={{ width: '100%', aspectRatio: '1/1', background: '#000', borderRadius: '12px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
          {cameraError ? (
            <div style={{ padding: '16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ color: 'var(--danger)', margin: '0 0 8px 0' }}>Camera unavailable. Enter or paste the room code instead.</p>
              <button 
                type="button" 
                onClick={() => handleClose(true)}
                style={{ background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}
              >
                Use Code
              </button>
              <button 
                type="button" 
                onClick={() => { setCameraError(false); setScannerKey(k => k + 1); }}
                style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '8px 24px', fontSize: '1rem', cursor: 'pointer' }}
              >
                Try again
              </button>
            </div>
          ) : (
            <Scanner 
              key={scannerKey}
              onScan={handleScan} 
              onError={handleError}
              formats={['qr_code']} 
              styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }} 
              components={{ audio: false }}
            />
          )}
        </div>
        
        {!cameraError && (
          <button 
            type="button" 
            onClick={() => handleClose(true)}
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: 'none', padding: '16px', marginTop: '8px', fontSize: '1rem', cursor: 'pointer' }}
          >
            Enter code instead
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
