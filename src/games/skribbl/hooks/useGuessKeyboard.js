import { useEffect } from 'react'

/**
 * useGuessKeyboard: keyboard handling for the Skribbl guess dock (professional chat-UI pattern).
 *
 *  1. iOS: stop Safari's focus-time "scroll the page to centre the input" (Adobe React Aria technique),
 *     so the page never jumps when the keyboard opens.
 *  2. Only the guess dock moves (translate3d), by exactly the part of it the keyboard covers. The top bar,
 *     canvas and layout stay stationary. The lift is also published as --sk-kb-lift so the players/chat
 *     panel can keep its content above the dock (see globals.css).
 *  3. If iOS still pans the visual viewport (residual pan, or the iOS 26 bug where offsetTop is not reset
 *     after the keyboard closes), the whole shell follows it (--sk-pan) so nothing visibly scrolls.
 *  4. The document never scrolls. Only [data-sk-scroll] areas scroll, and only by user touch.
 */

const MIN_KB = 120            // px: a smaller visual-viewport shrink is not a software keyboard
const SETTLE_MS = 1200        // sample every frame this long after focus/blur/viewport events (iOS reports late)
const ESTIMATE_MS = 900       // drop the keyboard-height estimate if the browser never reports a keyboard
const STICKY_MS = 3000        // keep following a leftover pan this long after the keyboard closes
const DEFAULT_KB_RATIO = 0.38 // first-ever focus: a typical phone keyboard is ~38% of the screen height
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
  // Lock the screen so the document never scrolls while in the drawing game
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
    const getDock = () => input.closest('.sk-guess-dock') || input.parentElement || input
    const ios = isIOS()

    let baseH = window.innerHeight // keyboard-free layout height
    let baseW = window.innerWidth
    let lift = 0                   // current dock lift in px (positive = up)
    let pan = 0                    // current shell pan in px
    let estimating = false
    let estimateKb = 0
    let estimateUntil = 0
    let stickyUntil = 0
    let raf = 0
    let until = 0
    let touchStart = null
    let lastTouchY = 0

    const setLift = (px) => {
      const dock = getDock()
      const next = Math.max(0, Math.round(px * 10) / 10)
      if (next === lift) return
      lift = next
      if (lift > 0) {
        dock.style.transform = `translate3d(0, ${-lift}px, 0)`
        root.style.setProperty('--sk-kb-lift', lift + 'px')
        root.classList.add('sk-kb-open')
      } else {
        dock.style.removeProperty('transform')
        root.style.removeProperty('--sk-kb-lift')
        root.classList.remove('sk-kb-open')
      }
    }
    const setPan = (px) => {
      const next = px > 1 ? Math.round(px * 10) / 10 : 0
      if (next === pan) return
      pan = next
      if (pan > 0) root.style.setProperty('--sk-pan', pan + 'px')
      else root.style.removeProperty('--sk-pan')
    }
    const resetAll = () => {
      estimating = false
      setLift(0)
      setPan(0)
    }

    const update = () => {
      const now = performance.now()
      const focused = document.activeElement === input

      // Rotation: re-measure the keyboard-free height
      if (window.innerWidth !== baseW) {
        baseW = window.innerWidth
        baseH = window.innerHeight
        resetAll()
      }
      // Never interfere with pinch-zoom
      if (Math.abs(vv.scale - 1) > 0.05) { resetAll(); return }

      const keyboardUp = baseH - vv.height > MIN_KB
      if (!focused && !keyboardUp) baseH = window.innerHeight
      const following = focused || keyboardUp || lift > 0 || now < stickyUntil
      if (!following) { resetAll(); return }

      // 1) If iOS panned the visual viewport (or left it offset), keep the whole shell on the visible area
      setPan(vv.offsetTop)

      // 2) Lift the dock by the part of it the keyboard covers (measured without our own transform)
      const rect = getDock().getBoundingClientRect()
      const naturalBottom = rect.bottom + lift
      const naturalTop = rect.top + lift
      const visibleTop = vv.offsetTop
      const visibleBottom = vv.offsetTop + vv.height
      let obstruction = Math.max(0, naturalBottom - visibleBottom)

      if (obstruction > MIN_KB) {
        estimating = false
        if (focused) writeKb(Math.round(obstruction))
      } else if (estimating && focused && now < estimateUntil) {
        obstruction = estimateKb // keyboard is animating in but not reported yet: use the last known height
      } else if (obstruction < 1) {
        obstruction = 0
      }
      // never lift the dock above the top of the visible area
      setLift(Math.min(obstruction, Math.max(0, naturalTop - visibleTop)))

      // Locked screen: the document must never be scrolled
      if (window.scrollY !== 0) window.scrollTo(0, 0)
    }

    const pump = () => {
      raf = 0
      update()
      if (performance.now() < until) raf = requestAnimationFrame(pump)
    }
    const kick = (ms = SETTLE_MS) => {
      until = Math.max(until, performance.now() + ms)
      if (!raf) raf = requestAnimationFrame(pump)
    }
    const onChange = () => {
      update() // synchronous: lowest possible latency
      kick()   // then keep sampling every frame while iOS settles
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
      if ((lift === 0 && pan === 0) || e.touches.length !== 1) return
      const target = e.target instanceof Element ? e.target : null
      if (!target || target.closest('input, textarea')) return
      const dy = e.touches[0].clientY - lastTouchY // > 0: finger moves down, content scrolls up
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
    window.addEventListener('pageshow', onChange)
    document.addEventListener('visibilitychange', onChange)
    document.addEventListener('touchstart', onDocTouchStart, { passive: true })
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    update()

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
      window.removeEventListener('pageshow', onChange)
      document.removeEventListener('visibilitychange', onChange)
      document.removeEventListener('touchstart', onDocTouchStart)
      document.removeEventListener('touchmove', onTouchMove)
      input.style.transform = ''
      resetAll()
    }
  }, [enabled, inputRef])
}
