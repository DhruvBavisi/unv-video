import { useLayoutEffect } from 'react'
import '../styles/sk-pwa-background.css'

/** Updates meta[name="theme-color"] and root/body backgrounds immediately. */
export function setThemeColor(color) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const body = document.body
  const themeColorMeta = document.querySelector('meta[name="theme-color"]')

  if (root) root.style.backgroundColor = color
  if (body) body.style.backgroundColor = color
  if (themeColorMeta) themeColorMeta.setAttribute('content', color)
}

/** Temporarily applies a page background while a game mode is mounted. */
export function usePageBackground(color) {
  useLayoutEffect(() => {
    const root = document.documentElement
    const body = document.body
    const themeColorMeta = document.querySelector('meta[name="theme-color"]')

    const previousRootColor = root.style.backgroundColor
    const previousBodyColor = body.style.backgroundColor
    const previousThemeColor = themeColorMeta?.getAttribute('content') ?? null

    setThemeColor(color)

    return () => {
      if (root) root.style.backgroundColor = previousRootColor
      if (body) body.style.backgroundColor = previousBodyColor
      if (themeColorMeta) {
        if (previousThemeColor === null) themeColorMeta.removeAttribute('content')
        else themeColorMeta.setAttribute('content', previousThemeColor)
      }
    }
  }, [color])
}
