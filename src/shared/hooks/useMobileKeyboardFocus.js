import { useEffect } from 'react'

export function useMobileKeyboardFocus(inputRef) {
  useEffect(() => {
    if (!window.visualViewport) return

    let timeoutId

    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId)

      timeoutId = setTimeout(() => {
        const input = inputRef.current
        if (!input || document.activeElement !== input) return

        const vp = window.visualViewport
        const rect = input.getBoundingClientRect()
        
        // rect.bottom is relative to the layout viewport
        // vp.offsetTop is the top of the visual viewport relative to the layout viewport
        // So the input's bottom relative to the visual viewport top is:
        const inputBottomRelative = rect.bottom - vp.offsetTop
        
        const margin = 16

        if (inputBottomRelative + margin > vp.height) {
          const overflow = (inputBottomRelative + margin) - vp.height
          window.scrollBy({ top: overflow, behavior: 'smooth' })
        }
      }, 150)
    }

    const vp = window.visualViewport
    vp.addEventListener('resize', handleResize)

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      vp.removeEventListener('resize', handleResize)
    }
  }, [inputRef])
}
