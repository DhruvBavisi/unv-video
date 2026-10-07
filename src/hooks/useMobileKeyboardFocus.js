import { useEffect } from 'react'

export function useMobileKeyboardFocus(inputRef) {
  // Purposefully empty: Let iOS Safari and native visualViewport handle keyboard presence naturally.
  // We removed scrollBy, scrollTo, padding hacks, and manual focus refiring to prevent layout breaking.
}
