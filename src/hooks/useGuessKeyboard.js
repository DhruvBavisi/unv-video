import { useEffect } from 'react'

// Chat-app keyboard model. While the keyboard is open, the game shell (.sk-view--game) is glued to the
// VISUAL viewport (height + offsetTop -> CSS vars). The guess form is the last child of the shell, so it
// always sits directly on top of the keyboard. Nothing is predicted or transformed.

const MIN_KB = 120      // px: a smaller visual-viewport shrink is not a software keyboard
const SETTLE_MS = 1200  // sample every frame for this long after focus/blur/viewport events (iOS reports late)

export function useGuessKeyboard(inputRef, enabled) {
  // The whole drawing screen is locked: the document never scrolls.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('sk-screen-lock')
    return () => root.classList.remove('sk-screen-lock')
  }, [])

  useEffect(() => {
    if (!enabled) return
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement

    let baseH = window.innerHeight // keyboard-free layout height
    let baseW = window.innerWidth
    let active = false
    let raf = 0
    let until = 0

    const release = () => {
      root.style.removeProperty('--sk-vvh')
      root.style.removeProperty('--sk-vvtop')
      root.classList.remove('sk-kb-open')
      active = false
    }

    const write = () => {
      const input = inputRef.current
      const focused = !!input && document.activeElement === input

      // Rotation: re-measure the keyboard-free height
      if (window.innerWidth !== baseW) {
        baseW = window.innerWidth
        baseH = window.innerHeight
        if (active) release()
      }
      // Never interfere with pinch-zoom
      if (vv.scale > 1.01) {
        if (active) release()
        return
      }
      if (!active && !focused) baseH = window.innerHeight

      // iOS may PAN instead of shrinking, so never subtract offsetTop here
      const kb = baseH - vv.height
      if (kb > MIN_KB && (focused || active)) {
        root.style.setProperty('--sk-vvh', vv.height + 'px')
        root.style.setProperty('--sk-vvtop', vv.offsetTop + 'px')
        root.classList.add('sk-kb-open')
        active = true
      } else if (active) {
        release()
      }
      // Locked screen: the document must never be scrolled
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }

    const pump = () => {
      raf = 0
      write()
      if (performance.now() < until) raf = requestAnimationFrame(pump)
    }
    const kick = (ms = SETTLE_MS) => {
      until = Math.max(until, performance.now() + ms)
      if (!raf) raf = requestAnimationFrame(pump)
    }
    const onChange = () => {
      write()   // synchronous: lowest possible latency
      kick()    // then keep sampling every frame while iOS settles
    }

    // While the keyboard is open, block touch-drags that would pan the page. Scrollable areas opt out.
    const onTouchMove = (e) => {
      if (!active) return
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [data-sk-scroll]')) return
      e.preventDefault()
    }

    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    window.addEventListener('scroll', onChange)
    document.addEventListener('focusin', onChange)
    document.addEventListener('focusout', onChange)
    document.addEventListener('visibilitychange', onChange)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    write()

    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
      window.removeEventListener('scroll', onChange)
      document.removeEventListener('focusin', onChange)
      document.removeEventListener('focusout', onChange)
      document.removeEventListener('visibilitychange', onChange)
      document.removeEventListener('touchmove', onTouchMove)
      release()
    }
  }, [enabled, inputRef])
}
