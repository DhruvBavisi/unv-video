import { useEffect } from 'react'

/**
 * useGuessKeyboard
 *
 * Isolates software keyboard compensation exclusively to the guess dock on iOS Safari / PWA.
 * 1. Keeps the canvas, player list, chat, top bar, and game shell stationary.
 * 2. Measures visualViewport geometry to compute actual keyboard obstruction.
 * 3. Applies an isolated translate3d transform only to the guess dock element.
 * 4. Untransforms dock position during measurement to eliminate feedback loops.
 * 5. Avoids document/window scrolling (no window.scrollTo(0,0) fighting Safari).
 * 6. Cleanly resets when keyboard closes, focus is lost, orientation changes, or hook unmounts.
 */
export function useGuessKeyboard(inputRef, enabled) {
  // Lock the screen so the document never scrolls while in drawing game
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('sk-screen-lock')
    return () => root.classList.remove('sk-screen-lock')
  }, [])

  useEffect(() => {
    if (!enabled) return
    const vv = window.visualViewport
    if (!vv) return

    let currentOffset = 0
    let rafId = 0
    let lastWidth = window.innerWidth

    const getDock = () => {
      const input = inputRef.current
      if (!input) return null
      return input.closest('.sk-guess-dock') || input.parentElement || input
    }

    const reset = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      if (currentOffset !== 0) {
        const dock = getDock()
        if (dock) {
          dock.style.removeProperty('transform')
        }
        currentOffset = 0
      }
    }

    const update = () => {
      rafId = 0
      const input = inputRef.current
      const isFocused = !!input && document.activeElement === input

      // If input lost focus, restore dock to original position
      if (!isFocused) {
        reset()
        return
      }

      // Orientation changes: reset and allow fresh measurement
      if (window.innerWidth !== lastWidth) {
        lastWidth = window.innerWidth
        reset()
        return
      }

      // Ignore pinch zoom to prevent interference
      if (Math.abs(vv.scale - 1) > 0.05) {
        reset()
        return
      }

      const dock = getDock()
      if (!dock) {
        reset()
        return
      }

      // Untransform current dock position to eliminate feedback loops
      const rect = dock.getBoundingClientRect()
      const untransformedBottom = rect.bottom - currentOffset
      const untransformedTop = rect.top - currentOffset

      // Visible area of viewport in layout coordinates
      const visibleTop = vv.offsetTop
      const visibleBottom = vv.offsetTop + vv.height

      // Measure keyboard obstruction
      const obstruction = Math.max(0, untransformedBottom - visibleBottom)

      // Clamp shift so dock cannot move above the top of visible viewport
      const maxShift = Math.max(0, untransformedTop - visibleTop)
      const shift = obstruction >= 1 ? Math.min(obstruction, maxShift) : 0
      const targetOffset = -shift

      if (Math.abs(targetOffset - currentOffset) > 0.5) {
        currentOffset = targetOffset
        if (targetOffset !== 0) {
          dock.style.transform = `translate3d(0, ${targetOffset}px, 0)`
        } else {
          dock.style.removeProperty('transform')
        }
      } else if (targetOffset === 0 && currentOffset !== 0) {
        currentOffset = 0
        dock.style.removeProperty('transform')
      }
    }

    const scheduleUpdate = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(update)
      }
    }

    // Block accidental touch-drags outside scrollable containers while keyboard is open
    const onTouchMove = (e) => {
      if (currentOffset === 0) return
      const t = e.target
      if (t instanceof Element && t.closest('input, textarea, [data-sk-scroll]')) return
      e.preventDefault()
    }

    vv.addEventListener('resize', scheduleUpdate)
    vv.addEventListener('scroll', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('orientationchange', scheduleUpdate)
    window.addEventListener('pageshow', scheduleUpdate)
    document.addEventListener('focusin', scheduleUpdate)
    document.addEventListener('focusout', scheduleUpdate)
    document.addEventListener('touchmove', onTouchMove, { passive: false })

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        reset()
      } else {
        scheduleUpdate()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    scheduleUpdate()

    return () => {
      if (rafId) cancelAnimationFrame(rafId)
      vv.removeEventListener('resize', scheduleUpdate)
      vv.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('orientationchange', scheduleUpdate)
      window.removeEventListener('pageshow', scheduleUpdate)
      document.removeEventListener('focusin', scheduleUpdate)
      document.removeEventListener('focusout', scheduleUpdate)
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('touchmove', onTouchMove)
      reset()
    }
  }, [enabled, inputRef])
}
