// ============================================================
// UNDERCOVER — Frame Sequence Renderer (Option A: Full Preload)
//
// 300 frames (1280x720) extracted at 30 fps from the 10 s
// cinematic (public/images/investigation-room-30fps/
// ezgif-frame-001.jpg … ezgif-frame-300.jpg).
// Swap FRAME_EXT to 'webp' and replace the assets to switch
// formats — nothing else changes.
// ============================================================

import { CINEMATIC_CONFIG } from './cinematicTimeline.js'

const FRAME_COUNT = CINEMATIC_CONFIG.frameCount // 300
const FRAME_DIR = '/images/investigation-room-30fps'
const FRAME_PREFIX = 'ezgif-frame-'
const FRAME_EXT = 'jpg'

const frameCache = new Map()
let preloadingStarted = false
let framesLoaded = 0

export function framePath(index) {
  return `${FRAME_DIR}/${FRAME_PREFIX}${String(index).padStart(3, '0')}.${FRAME_EXT}`
}

/**
 * Checks that the first and last frames are actually served, so the
 * renderer never activates against a half-extracted sequence.
 */
export async function framesAvailable() {
  try {
    const [first, last] = await Promise.all([
      fetch(framePath(1), { method: 'HEAD' }),
      fetch(framePath(FRAME_COUNT), { method: 'HEAD' }),
    ])
    return first.ok && last.ok
  } catch {
    return false
  }
}

/**
 * Preload ALL frames immediately (Option A).  Memory for 300 decoded
 * frames is acceptable on desktop; compressed sources total ~15 MB.
 * Guarantees zero network stutter once the sequence is warm.
 */
export function preloadAllFrames(onFrameLoaded) {
  if (preloadingStarted) return
  preloadingStarted = true

  for (let i = 1; i <= FRAME_COUNT; i++) {
    const img = new Image()
    img.src = framePath(i)

    img.onload = () => {
      frameCache.set(i, img)
      framesLoaded++
      if (onFrameLoaded) onFrameLoaded(i, framesLoaded, FRAME_COUNT)
    }

    img.onerror = () => {
      frameCache.set(i, null)
      framesLoaded++
      if (onFrameLoaded) onFrameLoaded(i, framesLoaded, FRAME_COUNT)
    }
  }
}

export function getFrame(index) {
  if (index < 1) index = 1
  if (index > FRAME_COUNT) index = FRAME_COUNT
  return frameCache.get(index) || null
}

export function getLoadedFrameCount() {
  return framesLoaded
}

export function getTotalFrameCount() {
  return FRAME_COUNT
}

export function clearFrameCache() {
  frameCache.clear()
  framesLoaded = 0
  preloadingStarted = false
}

// ------------------------------------------------------------
// Canvas Geometry & Drawing (object-fit: cover at 1280x720)
// ------------------------------------------------------------

export function fitCanvas(canvas, ctx, container) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const targetW = Math.round(container.clientWidth * dpr)
  const targetH = Math.round(container.clientHeight * dpr)

  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW
    canvas.height = targetH
  }
}

export function drawFrame(canvas, ctx, img, srcW, srcH) {
  if (!img) return

  const cw = canvas.width
  const ch = canvas.height
  if (cw === 0 || ch === 0) return

  ctx.clearRect(0, 0, cw, ch)

  const scale = Math.max(cw / srcW, ch / srcH)
  const drawW = srcW * scale
  const drawH = srcH * scale
  const x = (cw - drawW) / 2
  const y = (ch - drawH) / 2

  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, x, y, drawW, drawH)
}