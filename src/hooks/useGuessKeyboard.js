import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'

const KB_KEY = 'sk-last-kb-height'
const DEBUG = false // set true temporarily to show live numbers on screen, then back to false

export function useGuessKeyboard(inputRef, barRef, enabled) {
  const [lifted, setLifted] = useState(false)
  const [barHeight, setBarHeight] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('sk-screen-lock')
    return () => {
      root.classList.remove('sk-screen-lock')
      root.style.removeProperty('--sk-kb')
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
    let raf = 0

    let debugEl = null
    if (DEBUG) {
      debugEl = document.createElement('div')
      debugEl.style.cssText = 'position:fixed;top:4px;left:4px;z-index:99999;background:rgba(0,0,0,.8);color:#0f0;font:11px monospace;padding:4px 6px;border-radius:4px;pointer-events:none'
      document.body.appendChild(debugEl)
    }

    const sync = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!vv) return
        const pan = Math.max(0, Math.round(vv.offsetTop))
        const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
        root.style.setProperty('--sk-pan', pan + 'px')
        if (document.activeElement === input && kb > 100) {
          root.style.setProperty('--sk-kb', kb + 'px')
          try { sessionStorage.setItem(KB_KEY, String(kb)) } catch {}
        }
        if (debugEl) {
          const v = document.querySelector('.sk-view--game')
          debugEl.textContent = `ih ${window.innerHeight} vvh ${Math.round(vv.height)} top ${Math.round(vv.offsetTop)} kb ${kb} sv ${v ? v.scrollTop : '-'}`
        }
      })
    }

    // Lift on FOCUS (finger already lifted, so the tap is not eaten) and render synchronously,
    // before iOS runs its scroll-into-view. Estimate covers small iPhones; real height replaces it.
    const onFocus = () => {
      let est = 0
      try { est = Number(sessionStorage.getItem(KB_KEY)) || 0 } catch {}
      if (!est) est = Math.round(window.innerHeight * 0.46)
      root.style.setProperty('--sk-kb', est + 'px')
      flushSync(() => {
        setBarHeight(bar.offsetHeight)
        setLifted(true)
      })
      sync()
    }
    const onBlur = () => {
      setLifted(false)
      root.style.setProperty('--sk-kb', '0px')
      root.style.setProperty('--sk-pan', '0px')
    }

    input.addEventListener('focus', onFocus)
    input.addEventListener('blur', onBlur)
    if (vv) {
      vv.addEventListener('resize', sync)
      vv.addEventListener('scroll', sync)
    }
    return () => {
      cancelAnimationFrame(raf)
      input.removeEventListener('focus', onFocus)
      input.removeEventListener('blur', onBlur)
      if (vv) {
        vv.removeEventListener('resize', sync)
        vv.removeEventListener('scroll', sync)
      }
      if (debugEl) debugEl.remove()
    }
  }, [enabled, inputRef, barRef])

  return { lifted, barHeight }
}
