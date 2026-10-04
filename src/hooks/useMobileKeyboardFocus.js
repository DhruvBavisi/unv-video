import { useEffect } from 'react'

export function useMobileKeyboardFocus(inputRef) {
  useEffect(() => {
    const input = inputRef?.current
    if (!input) return

    let frameId = null

    const getScrollContainer = (node) => {
      let current = node.parentElement
      while (current) {
        const style = window.getComputedStyle(current)
        const overflowY = style.overflowY
        if ((overflowY === 'auto' || overflowY === 'scroll') && current.scrollHeight > current.clientHeight) {
          return current
        }
        current = current.parentElement
      }
      return window
    }

    const adjustFocus = () => {
      if (document.activeElement !== input) {
        document.body.style.paddingBottom = ''
        return
      }
      if (!window.visualViewport) return

      const rect = input.getBoundingClientRect()
      const vv = window.visualViewport
      
      const viewportTop = vv.offsetTop
      const viewportBottom = vv.offsetTop + vv.height
      const safeMargin = 16

      let scrollDiff = 0

      if (rect.bottom + safeMargin > viewportBottom) {
        scrollDiff = (rect.bottom + safeMargin) - viewportBottom
      } else if (rect.top - safeMargin < viewportTop) {
        scrollDiff = (rect.top - safeMargin) - viewportTop
      }

      if (scrollDiff !== 0) {
        const container = getScrollContainer(input)
        if (container === window) {
          if (scrollDiff > 0) {
            const currentPadding = parseInt(window.getComputedStyle(document.body).paddingBottom || '0', 10)
            document.body.style.paddingBottom = `${currentPadding + scrollDiff}px`
          }
          window.scrollBy({ top: scrollDiff, behavior: 'auto' })
        } else {
          container.scrollBy({ top: scrollDiff, behavior: 'auto' })
        }
      }
    }

    const handleEvent = () => {
      if (frameId) cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(() => {
        frameId = requestAnimationFrame(adjustFocus)
      })
    }

    const handleBlur = () => {
      if (frameId) cancelAnimationFrame(frameId)
      document.body.style.paddingBottom = ''
    }

    input.addEventListener('focus', handleEvent)
    input.addEventListener('blur', handleBlur)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleEvent)
    }

    return () => {
      if (frameId) cancelAnimationFrame(frameId)
      input.removeEventListener('focus', handleEvent)
      input.removeEventListener('blur', handleBlur)
      document.body.style.paddingBottom = ''
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleEvent)
      }
    }
  }, [inputRef])
}
