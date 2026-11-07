import React, { useEffect } from 'react'
import { SKRIBBL_COLORS, TOTAL_EYES, TOTAL_MOUTHS, TOTAL_COLORS, getRandomAvatar } from '../utils/skribblAvatarData.js'
import { getEyeTransform, getMouthTransform, EYE_LAYOUT, MOUTH_LAYOUT } from '../utils/skribblAvatarLayout.js'
import useSkribblBoilingAnimation, { ensureSvgFilters } from '../hooks/useSkribblBoilingAnimation.js'

export { SKRIBBL_COLORS, TOTAL_EYES, TOTAL_MOUTHS, TOTAL_COLORS, getRandomAvatar, EYE_LAYOUT, MOUTH_LAYOUT }

// Global preloader cache flag so preloading runs once per session
let hasPreloadedAssets = false
export function preloadSkribblAvatarAssets() {
  if (hasPreloadedAssets || typeof window === 'undefined') return
  hasPreloadedAssets = true

  const urls = [
    '/images/characters/skribbl/body.webp',
    '/images/characters/skribbl/body-fill.webp',
    '/images/characters/skribbl/logo.webp',
    '/images/characters/skribbl/background.webp',
    '/images/characters/skribbl/dice.webp'
  ]
  for (let i = 1; i <= TOTAL_EYES; i++) {
    urls.push(`/images/characters/skribbl/eyes/eye-${i}.webp`)
  }
  for (let j = 1; j <= TOTAL_MOUTHS; j++) {
    urls.push(`/images/characters/skribbl/mouth/mouth-${j}.webp`)
  }

  // Preload in idle callback or requestAnimationFrame
  const preloadNext = () => {
    urls.forEach(u => {
      const img = new Image()
      img.src = u
    })
  }
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preloadNext, { timeout: 1000 })
  } else {
    setTimeout(preloadNext, 50)
  }
}

/**
 * SkribblAvatar component
 * Layers:
 * 1. Body silhouette fill with player color
 * 2. Body outline (black cartoon lineart)
 * 3. Eyes expression (calibrated center & manual layout)
 * 4. Mouth expression (calibrated center & manual layout)
 */
export default function SkribblAvatar({ 
  avatar, 
  size = 120, 
  bouncy = false,
  pop = false,
  className = '', 
  style = {} 
}) {
  const colorIndex = (avatar && typeof avatar.color === 'number') 
    ? Math.max(0, Math.min(avatar.color, TOTAL_COLORS - 1)) 
    : 15
  const eyeIndex = (avatar && typeof avatar.eyes === 'number') 
    ? Math.max(1, Math.min(avatar.eyes, TOTAL_EYES)) 
    : 1
  const mouthIndex = (avatar && typeof avatar.mouth === 'number') 
    ? Math.max(1, Math.min(avatar.mouth, TOTAL_MOUTHS)) 
    : 1

  const hexColor = SKRIBBL_COLORS[colorIndex] || SKRIBBL_COLORS[15]

  useEffect(() => {
    preloadSkribblAvatarAssets()
    ensureSvgFilters()
  }, [])
  useSkribblBoilingAnimation()

  const containerStyle = {
    position: 'relative',
    width: typeof size === 'number' ? `${size}px` : size,
    aspectRatio: '386 / 440',
    display: 'inline-block',
    verticalAlign: 'bottom',
    userSelect: 'none',
    ...style,
  }

  const eyeTransform = getEyeTransform(eyeIndex)
  const mouthTransform = getMouthTransform(mouthIndex)
  const bouncyClass = bouncy ? 'sk-avatar--bouncy' : ''
  const popClass = pop ? 'sk-avatar--pop' : ''

  return (
    <div 
      className={`sk-assembled-avatar ${bouncyClass} ${popClass} ${className}`.trim()} 
      style={containerStyle} 
      aria-label="Skribbl Avatar"
    >
      {/* Layer 1 & 2: Body Group (Fill + Outline) with shaping & deshaping heartbeat */}
      <div 
        className="sk-assembled-avatar__body-group" 
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transformOrigin: '50% 90%'
        }}
      >
        {/* Layer 1: Body Color Fill */}
        <div 
          className="sk-assembled-avatar__fill" 
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: hexColor,
            WebkitMaskImage: "url('/images/characters/skribbl/body-fill.webp')",
            maskImage: "url('/images/characters/skribbl/body-fill.webp')",
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            pointerEvents: 'none'
          }}
        />

        {/* Layer 2: Body Outline */}
        <img 
          src="/images/characters/skribbl/body.webp" 
          alt="" 
          className="sk-assembled-avatar__outline"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
          draggable={false}
        />
      </div>

      {/* Layer 3: Eyes Expression (with growing & shrinking heartbeat) */}
      <div 
        className="sk-assembled-avatar__eyes-group"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transformOrigin: '50% 32%'
        }}
      >
        <img 
          src={`/images/characters/skribbl/eyes/eye-${eyeIndex}.webp`} 
          alt="" 
          className="sk-assembled-avatar__eyes"
          style={{
            position: 'absolute',
            top: '9%',
            left: '50%',
            transform: eyeTransform,
            width: '60%',
            height: 'auto',
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
          draggable={false}
        />
      </div>

      {/* Layer 4: Mouth Expression (with growing & shrinking heartbeat) */}
      <div 
        className="sk-assembled-avatar__mouth-group"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transformOrigin: '50% 48%'
        }}
      >
        <img 
          src={`/images/characters/skribbl/mouth/mouth-${mouthIndex}.webp`} 
          alt="" 
          className="sk-assembled-avatar__mouth"
          style={{
            position: 'absolute',
            top: '27%',
            left: '50%',
            transform: mouthTransform,
            width: '57%',
            height: 'auto',
            objectFit: 'contain',
            pointerEvents: 'none'
          }}
          draggable={false}
        />
      </div>
    </div>
  )
}
