import { useEffect } from 'react'

export function useMobileKeyboardFocus(inputRef) {
  useEffect(() => {
    const input = inputRef?.current
    if (!input) return

    const handleResize = () => {
      // Check if the current input is focused
      if (document.activeElement === input) {
        // Scroll it into the visible center of the new viewport gracefully
        input.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [inputRef])
}
