import { useEffect } from 'react'

/** Temporarily applies a page background while a game mode is mounted. */
export function usePageBackground(color) {
  useEffect(() => {
    const root = document.documentElement
    const body = document.body
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')

    const previousRootColor = root.style.backgroundColor
    const previousBodyColor = body.style.backgroundColor
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null

    root.style.backgroundColor = color
    body.style.backgroundColor = color
    themeColorMeta?.setAttribute('content', color)

    // Load mode-specific viewport fixes only while this mode is mounted.
    let cancelled = false
    import('../styles/sk-pwa-background.css').then(() => {
      if (cancelled) return
    }).catch((error) => {
      console.error('Unable to load page background styles:', error)
    })

    return () => {
      cancelled = true
      root.style.backgroundColor = previousRootColor
      body.style.backgroundColor = previousBodyColor
      if (themeColorMeta) {
        if (previousThemeColor === null) themeColorMeta.removeAttribute('content')
        else themeColorMeta.setAttribute('content', previousThemeColor)
      }
    }
  }, [color])
}
