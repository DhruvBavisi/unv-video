import { useLayoutEffect } from 'react'
import '../styles/sk-pwa-background.css'

/** Temporarily applies a page background while a game mode is mounted. */
export function usePageBackground(color) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const body = document.body
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')
    const appleStatusBarMeta = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')

    const previousRootColor = root.style.backgroundColor
    const previousBodyColor = body.style.backgroundColor
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null

    root.style.backgroundColor = color
    body.style.backgroundColor = color
    themeColorMeta?.setAttribute('content', color)
    if (appleStatusBarMeta) {
      appleStatusBarMeta.setAttribute('content', 'black-translucent')
    }

    return () => {
      root.style.backgroundColor = previousRootColor
      body.style.backgroundColor = previousBodyColor
      if (themeColorMeta) {
        if (previousThemeColor === null) themeColorMeta.removeAttribute('content')
        else themeColorMeta.setAttribute('content', previousThemeColor)
      }
    }
  }, [color])
}
