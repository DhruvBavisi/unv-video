import { useEffect, useState } from 'react'

const BUILD = 'SK-KB-v2'     // shown in the debug overlay so you can confirm the new bundle is live
const DEBUG = true          // set true for ONE deploy to see live numbers on the phone, then back to false
const KB_KEY = 'sk-last-kb-by-orientation'
const MIN_KB = 120           // px: below this it is not a software keyboard
const FALLBACK_RATIO = 0.4   // keyboard-height guess (fraction of innerHeight) before the real one is known
const SETTLE_MS = 900        // iOS can report visualViewport changes late (hundreds of ms)

const orientation = () => (window.innerWidth > window.innerHeight ? 'l' : 'p')
const readKb = () => {
  try { return Number(JSON.parse(sessionStorage.getItem(KB_KEY) || '{}')[orientation()]) || 0 } catch { return 0 }
}
const writeKb = (px) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(KB_KEY) || '{}')
    all[orientation()] = px
    sessionStorage.setItem(KB_KEY, JSON.stringify(all))
  } catch {}
}

export function useGuessKeyboard(inputRef, barRef, enabled) {
  const [lifted, setLifted] = useState(false)

  // Lock the whole drawing screen (unchanged behaviour)
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('sk-screen-lock')
    return () => {
      root.classList.remove('sk-screen-lock')
      root.style.removeProperty('--sk-pan')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const input = inputRef.current
    const bar = barRef.current
    if (!input || !bar) return

    const vv = window.visualViewport
    const root = document.documentElement
    let lift = 0
    let est = 0
    let baseInnerHeight = window.innerHeight
    let geometryTrusted = false
    let restTop = 0
    let raf = 0
    let settleTimer = 0
    let debugEl = null

    if (DEBUG) {
      debugEl = document.createElement('div')
      debugEl.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999;background:rgba(0,0,0,.85);color:#0f0;font:11px/1.3 monospace;padding:4px 6px;border-radius:4px;pointer-events:none;white-space:pre'
      document.body.appendChild(debugEl)
    }

    // Move the bar with a transform ONLY (no layout change anywhere else, no transition)
    const apply = (px) => {
      const next = Math.max(0, Math.round(px))
      if (next === lift) return
      lift = next
      bar.style.transform = lift ? `translate3d(0, ${-lift}px, 0)` : ''
    }

    // Bottom edge (layout-viewport coordinates) of the area NOT covered by the keyboard
    const visibleBottom = () => {
      const vvBottom = vv ? vv.offsetTop + vv.height : window.innerHeight
      return geometryTrusted ? vvBottom : Math.min(vvBottom, window.innerHeight - est)
    }

    // lift = how far the bar's NATURAL bottom is below the visible bottom; 0 if already visible (I2)
    const relayout = () => {
      const naturalBottom = bar.getBoundingClientRect().bottom + lift
      apply(naturalBottom - visibleBottom())
    }

    // While the keyboard is open, block touch-drags that would pan the page (iOS). Scrollable areas opt out.
    const onTouchMove = (e) => {
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [data-sk-scroll]')) return
      e.preventDefault()
    }

    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (document.activeElement !== input) {
          // keyboard closed / input disabled without a blur event: never stay stuck (I4)
          if (lift) apply(0)
          setLifted(false)
          root.style.setProperty('--sk-pan', '0px')
          return
        }
        const layoutShrunk = window.innerHeight < baseInnerHeight - MIN_KB // Android browsers that resize the layout
        const kb = vv ? Math.round(window.innerHeight - vv.height - vv.offsetTop) : 0
        if (kb > MIN_KB) { geometryTrusted = true; writeKb(kb) }
        else if (layoutShrunk) geometryTrusted = true
        if (geometryTrusted) clearTimeout(settleTimer)

        // Safety net (I1): undo any pan the OS applied
        if (vv && vv.offsetTop > 0) {
          window.scrollTo(0, 0)
          root.style.setProperty('--sk-pan', Math.round(vv.offsetTop) + 'px')
        } else {
          root.style.setProperty('--sk-pan', '0px')
        }

        relayout()

        if (debugEl) {
          debugEl.textContent =
            `${BUILD}\nih ${window.innerHeight} vvh ${Math.round(vv ? vv.height : 0)} vvTop ${Math.round(vv ? vv.offsetTop : 0)}\n` +
            `kb ${kb} est ${est} trusted ${geometryTrusted}\nlift ${lift} barTop ${Math.round(bar.getBoundingClientRect().top)} restTop ${Math.round(restTop)} scrollY ${Math.round(window.scrollY)}`
        }
      })
    }

    // On FOCUS (finger already lifted): position the bar synchronously BEFORE the OS decides to pan.
    // Bias the estimate HIGH: an over-estimate is harmless (bar is corrected downwards), an under-estimate makes iOS pan.
    const onFocus = () => {
      baseInnerHeight = window.innerHeight
      geometryTrusted = false
      restTop = bar.getBoundingClientRect().top + lift
      est = Math.min(
        Math.max(readKb(), Math.round(window.innerHeight * FALLBACK_RATIO)),
        Math.round(window.innerHeight * 0.55)
      )
      setLifted(true)
      relayout()
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      clearTimeout(settleTimer)
      settleTimer = setTimeout(() => {
        // No keyboard geometry arrived (hardware keyboard / floating keyboard): drop the estimate
        if (!geometryTrusted) { est = 0; geometryTrusted = true; relayout() }
      }, SETTLE_MS)
      sync()
    }

    const onBlur = () => {
      clearTimeout(settleTimer)
      cancelAnimationFrame(raf)
      geometryTrusted = false
      est = 0
      apply(0)
      setLifted(false)
      root.style.setProperty('--sk-pan', '0px')
      document.removeEventListener('touchmove', onTouchMove)
    }

    input.addEventListener('focus', onFocus)
    input.addEventListener('blur', onBlur)
    if (vv) {
      vv.addEventListener('resize', sync)
      vv.addEventListener('scroll', sync)
    }
    if (document.activeElement === input) onFocus()

    return () => {
      clearTimeout(settleTimer)
      cancelAnimationFrame(raf)
      input.removeEventListener('focus', onFocus)
      input.removeEventListener('blur', onBlur)
      document.removeEventListener('touchmove', onTouchMove)
      if (vv) {
        vv.removeEventListener('resize', sync)
        vv.removeEventListener('scroll', sync)
      }
      bar.style.transform = ''
      root.style.setProperty('--sk-pan', '0px')
      if (debugEl) debugEl.remove()
    }
  }, [enabled, inputRef, barRef])

  return { lifted }
}
