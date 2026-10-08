import { useEffect, useState } from 'react'

const KB_KEY = 'sk-last-kb-height'

export function useGuessKeyboard(inputRef, barRef, enabled) {
  const [lifted, setLifted] = useState(false)
  const [barHeight, setBarHeight] = useState(0)

  useEffect(() => {
    const root = document.documentElement
    root.classList.add('sk-screen-lock')
    return () => {
      root.classList.remove('sk-screen-lock')
      root.style.removeProperty('--sk-kb')
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const input = inputRef.current
    const bar = barRef.current
    if (!input || !bar) return
    const vv = window.visualViewport
    const root = document.documentElement

    const applyKb = () => {
      if (!vv) return
      const kb = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
      if (kb > 100) {
        root.style.setProperty('--sk-kb', kb + 'px')
        try { sessionStorage.setItem(KB_KEY, String(kb)) } catch {}
      }
      if (vv.offsetTop > 0) window.scrollTo(0, 0)
    }

    const preLift = () => {
      let est = 0
      try { est = Number(sessionStorage.getItem(KB_KEY)) || 0 } catch {}
      if (!est) est = Math.round(window.innerHeight * 0.4)
      root.style.setProperty('--sk-kb', est + 'px')
      setBarHeight(bar.offsetHeight)
      setLifted(true)
    }

    const onFocus = () => { applyKb() }

    const onBlur = () => {
      setLifted(false)
      root.style.setProperty('--sk-kb', '0px')
    }

    input.addEventListener('pointerdown', preLift)
    input.addEventListener('focus', onFocus)
    input.addEventListener('blur', onBlur)

    if (vv) {
      vv.addEventListener('resize', applyKb)
      vv.addEventListener('scroll', applyKb)
    }

    return () => {
      input.removeEventListener('pointerdown', preLift)
      input.removeEventListener('focus', onFocus)
      input.removeEventListener('blur', onBlur)

      if (vv) {
        vv.removeEventListener('resize', applyKb)
        vv.removeEventListener('scroll', applyKb)
      }
    }
  }, [enabled, inputRef, barRef])

  return { lifted, barHeight }
}
