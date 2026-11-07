import { SPECIAL_ROLES } from '../data/specialRoles.js'
import { getRoleImage, getRoleBadgeImage } from '../roleImages.js'

/**
 * Universal SVG fallback placeholder in case network completely drops or asset is blocked.
 * Prevents Safari/WebKit from ever rendering the blue square question mark [?].
 */
const FALLBACK_AVATAR_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" rx="16" fill="%231a1b1e"/><circle cx="50" cy="40" r="18" fill="%238a8f98"/><path d="M22 84c0-15.5 12.5-28 28-28s28 12.5 28 28" fill="%238a8f98"/></svg>`

/**
 * Collect all essential Undercover character asset URLs (avatars, backgrounds, triggers, core roles)
 */
export function getSpecialRoleAssetUrls() {
  const urls = new Set()

  // 1. All Special Role main avatars & trigger/background assets
  SPECIAL_ROLES.forEach(role => {
    if (role.avatar) {
      urls.add(role.avatar)
      // Background / silhouette variant for header trigger & popup
      urls.add(role.avatar.replace(/\.(png|webp)$/, '-bg.webp'))
    }
  })

  // 2. Specific green variant for Goddess of Justice
  urls.add('/images/characters/undercover/goddessofjustice-bg-green.webp')

  // 3. Core Role character portraits & badges
  ;['CIVILIAN', 'UNDERCOVER', 'MR_WHITE'].forEach(role => {
    urls.add(getRoleImage(role))
    urls.add(getRoleBadgeImage(role))
  })

  // 4. Specific overlay assets
  urls.add('/images/characters/undercover/mrwhite-1.webp')
  urls.add('/images/characters/undercover/ghost-bg.webp')

  return Array.from(urls)
}

let preloadPromise = null
let isPreloaded = false

/**
 * Preload and decode a single image URL into browser cache/memory.
 */
function preloadImage(url) {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return resolve({ url, success: true })
    }

    const img = new Image()
    let settled = false

    const handleSuccess = () => {
      if (!settled) {
        settled = true
        resolve({ url, success: true })
      }
    }

    const handleFailure = () => {
      // If webp fails, try PNG fallback during preload
      if (url.endsWith('.webp')) {
        const pngFallback = url.replace(/\.webp$/, '.png')
        const fallbackImg = new Image()
        fallbackImg.onload = () => {
          if (!settled) {
            settled = true
            resolve({ url: pngFallback, success: true })
          }
        }
        fallbackImg.onerror = () => {
          if (!settled) {
            settled = true
            resolve({ url, success: false })
          }
        }
        fallbackImg.src = pngFallback
        return
      }

      if (!settled) {
        settled = true
        resolve({ url, success: false })
      }
    }

    img.onload = () => {
      if (img.decode) {
        img.decode().then(handleSuccess).catch(handleSuccess)
      } else {
        handleSuccess()
      }
    }

    img.onerror = handleFailure
    img.src = url
  })
}

/**
 * Preload all Undercover special roles and character assets before entering create game or room lobby.
 * Returns a promise that resolves when all assets are loaded and decoded.
 */
export function preloadSpecialRoles() {
  if (preloadPromise) {
    return preloadPromise
  }

  const urls = getSpecialRoleAssetUrls()
  preloadPromise = Promise.all(urls.map(preloadImage))
    .then((results) => {
      isPreloaded = true
      return results
    })
    .catch((err) => {
      console.warn('[Undercover Preload] Warning during asset preloading:', err)
      isPreloaded = true
      return []
    })

  return preloadPromise
}

/**
 * Check if the Undercover special role assets have finished preloading.
 */
export function areSpecialRolesPreloaded() {
  return isPreloaded
}

/**
 * Robust onError handler for Undercover character <img> elements.
 * Sequentially tries:
 * 1. Root path without /undercover/ if it had /undercover/
 * 2. .png variant if it was .webp
 * 3. Graceful SVG placeholder so Safari NEVER shows the blue question mark [?]
 */
export function handleUndercoverImageError(e) {
  const img = e.currentTarget
  if (!img) return

  const currentSrc = img.src || ''
  const step = parseInt(img.dataset.fallbackStep || '0', 10)

  // Step 0: If URL is under /images/characters/undercover/, try /images/characters/
  if (step === 0 && currentSrc.includes('/images/characters/undercover/')) {
    img.dataset.fallbackStep = '1'
    img.src = currentSrc.replace('/images/characters/undercover/', '/images/characters/')
    return
  }

  // Step 1: If URL is .webp, try .png
  if (step <= 1 && currentSrc.includes('.webp')) {
    img.dataset.fallbackStep = '2'
    img.src = currentSrc.replace(/\.webp($|\?)/, '.png$1')
    return
  }

  // Step 2: Try root /images/characters/ with .png
  if (step <= 2 && currentSrc.includes('/images/characters/undercover/')) {
    img.dataset.fallbackStep = '3'
    img.src = currentSrc.replace('/images/characters/undercover/', '/images/characters/').replace(/\.webp($|\?)/, '.png$1')
    return
  }

  // Final Step: Render fallback SVG icon instead of browser question mark
  img.dataset.fallbackStep = 'done'
  img.onerror = null // Prevent infinite loop
  img.src = FALLBACK_AVATAR_SVG
  img.style.opacity = '0.85'
}

