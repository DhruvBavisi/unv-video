import { useEffect } from 'react'

// Keyboard model for the Skribbl guess dock (the pattern used by professional chat UIs):
// 1. iOS: stop Safari's focus-time "scroll the page to centre the input" (Adobe React Aria technique),
//    so the page never jumps when the keyboard opens.
// 2. While the keyboard is open the game shell (.sk-view--game) is glued to the VISUAL viewport
//    (height + offsetTop -> CSS vars). The guess dock is the last child of the shell, so it always sits
//    exactly on the keyboard; the top bar and canvas never move or shrink (see globals.css).
// 3. The document never scrolls. Only [data-sk-scroll] areas scroll, and only by user touch.

const MIN_KB = 120            // px: a smaller visual-viewport shrink is not a software keyboard
const SETTLE_MS = 1200        // sample every frame this long after focus/blur/viewport events (iOS reports late)
const ESTIMATE_MS = 900       // drop the keyboard-height estimate if the browser never reports a keyboard
const STICKY_MS = 3000        // iOS 26: visualViewport.offsetTop can stay > 0 after the keyboard closes
const DEFAULT_KB_RATIO = 0.38 // first-ever focus: typical phone keyboard = ~38% of the screen height
const HIDE_PX = -2000         // iOS never scrolls to an input it believes is far above the screen
const KB_KEY = 'sk-last-kb-by-orientation'

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

const orientation = () => (window.innerWidth > window.innerHeight ? 'l' : 'p')
const readKb = () => {
  try { return Number(JSON.parse(sessionStorage.getItem(KB_KEY) || '{}')[orientation()]) || 0 } catch { return 0 }
}
const writeKb = (px) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(KB_KEY) || '{}')
    all[orientation()] = px
    sessionStorage.setItem(KB_KEY, JSON.stringify(all))
  } catch { /* storage unavailable */ }
}

export function useGuessKeyboard(inputRef, enabled) {
  // The whole drawing screen is locked: the document never scrolls.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('sk-screen-lock')
    return () => root.classList.remove('sk-screen-lock')
  }, [])

  useEffect(() => {
    if (!enabled) return
    const input = inputRef.current
    const vv = window.visualViewport
    if (!input || !vv) return
    const root = document.documentElement
    const ios = isIOS()

    let baseH = window.innerHeight // keyboard-free layout height
    let baseW = window.innerWidth
    let active = false
    let estimating = false
    let estimateKb = 0
    let estimateUntil = 0
    let stickyUntil = 0
    let raf = 0
    let until = 0
    let touchStart = null
    let lastTouchY = 0

    const apply = (height, top) => {
      root.style.setProperty('--sk-vvh', height + 'px')
      root.style.setProperty('--sk-vvtop', top + 'px')
      root.classList.add('sk-kb-open')
      active = true
    }
    const release = () => {
      root.style.removeProperty('--sk-vvh')
      root.style.removeProperty('--sk-vvtop')
      root.classList.remove('sk-kb-open')
      active = false
      estimating = false
    }

    const write = () => {
      const now = performance.now()
      const focused = document.activeElement === input

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

      // iOS may PAN instead of shrinking, so offsetTop is NOT subtracted when deciding if a keyboard is up
      const kb = baseH - vv.height
      if (kb > MIN_KB && (focused || active)) {
        estimating = false
        if (focused) writeKb(Math.round(kb))
        apply(vv.height, vv.offsetTop)
      } else if (estimating && focused && now < estimateUntil) {
        // Keyboard is animating in but the browser has not reported it yet: lift the dock with the last known height
        apply(baseH - estimateKb, 0)
      } else if (active && vv.offsetTop > 1 && now < stickyUntil) {
        // iOS 26 bug: offsetTop is not reset after dismissal. Keep the shell on the visible area until it is.
        apply(vv.height, vv.offsetTop)
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
      write() // synchronous: lowest possible latency
      kick()  // then keep sampling every frame while iOS settles
    }

    // ---- Focus handling -------------------------------------------------------------------------
    const hideFromScroll = () => {
      input.style.transform = `translateY(${HIDE_PX}px)`
      requestAnimationFrame(() => { input.style.transform = '' })
    }
    const onInputFocus = () => {
      estimating = true
      estimateKb = readKb() || Math.round(baseH * DEFAULT_KB_RATIO)
      estimateUntil = performance.now() + ESTIMATE_MS
      if (ios) hideFromScroll() // covers focus that did not come from our touch path (e.g. refocus after send)
      onChange()
    }
    const onInputBlur = () => {
      estimating = false
      stickyUntil = performance.now() + STICKY_MS
      kick(STICKY_MS)
      onChange()
    }
    // iOS: take over the tap so Safari never gets the chance to scroll the page to the input.
    const onInputTouchStart = (e) => {
      const t = e.touches[0]
      touchStart = t ? { x: t.clientX, y: t.clientY } : null
    }
    const onInputTouchEnd = (e) => {
      if (!ios || input.disabled || !touchStart) return
      const t = e.changedTouches[0]
      const moved = t ? Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) : 99
      touchStart = null
      if (moved > 10) return                         // it was a drag, let the browser decide
      if (document.activeElement === input) return   // already focused: keep native caret placement
      e.preventDefault()                             // no native focus, no synthesized click
      input.style.transform = `translateY(${HIDE_PX}px)`
      input.focus({ preventScroll: true })
      requestAnimationFrame(() => { input.style.transform = '' })
    }

    // ---- Touch scroll lock (body-scroll-lock style): only scrollable [data-sk-scroll] areas may scroll ----
    const onDocTouchStart = (e) => { lastTouchY = e.touches[0] ? e.touches[0].clientY : 0 }
    const onTouchMove = (e) => {
      if (!active || e.touches.length !== 1) return
      const target = e.target instanceof Element ? e.target : null
      if (!target || target.closest('input, textarea')) return
      const currentY = e.touches[0].clientY
      const dy = currentY - lastTouchY // > 0: finger moves down, content scrolls up; < 0: finger moves up, content scrolls down
      lastTouchY = currentY
      if (Math.abs(dy) < 0.5) return
      for (let el = target.closest('[data-sk-scroll]'); el; el = el.parentElement && el.parentElement.closest('[data-sk-scroll]')) {
        if (el.scrollHeight <= el.clientHeight + 1) continue // nothing to scroll here
        const atTop = el.scrollTop <= 0
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        if ((dy > 0 && !atTop) || (dy < 0 && !atBottom)) return // this area can still move: allow
      }
      e.preventDefault() // nothing can scroll: stop iOS panning the page
    }

    input.addEventListener('focus', onInputFocus)
    input.addEventListener('blur', onInputBlur)
    input.addEventListener('touchstart', onInputTouchStart, { passive: true })
    input.addEventListener('touchend', onInputTouchEnd, { passive: false })
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    window.addEventListener('resize', onChange)
    window.addEventListener('orientationchange', onChange)
    window.addEventListener('scroll', onChange)
    document.addEventListener('visibilitychange', onChange)
    document.addEventListener('touchstart', onDocTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    write()

    return () => {
      cancelAnimationFrame(raf)
      input.removeEventListener('focus', onInputFocus)
      input.removeEventListener('blur', onInputBlur)
      input.removeEventListener('touchstart', onInputTouchStart)
      input.removeEventListener('touchend', onInputTouchEnd)
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      window.removeEventListener('resize', onChange)
      window.removeEventListener('orientationchange', onChange)
      window.removeEventListener('scroll', onChange)
      document.removeEventListener('visibilitychange', onChange)
      document.removeEventListener('touchstart', onDocTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      input.style.transform = ''
      release()
    }
  }, [enabled, inputRef])
}
