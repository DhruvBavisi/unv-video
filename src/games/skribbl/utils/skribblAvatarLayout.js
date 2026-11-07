/**
 * Skribbl Avatar Feature Layout & Manual Transform Configuration
 * 
 * You can manually adjust the position (x, y) and size (scale) for any eye or mouth:
 * 
 * - x: Horizontal offset in asset units (positive = shift right, negative = shift left)
 * - y: Vertical offset in asset units (positive = shift down, negative = shift up)
 * - scale: Size multiplier (1 = normal 100%, 1.1 = 110%, 0.9 = 90%)
 * 
 * These offsets are scaled relative to the 256px asset coordinate space,
 * ensuring perfect alignment at any avatar size (mobile, desktop, lobby, scoreboard).
 */

export const EYE_LAYOUT = {
  1:  { x: -15,   y: -65,  scale: 1.0 },
  2:  { x: -15,  y: -70,  scale: 1.0 },
  3:  { x: -3,   y: -70, scale: 1.0 },
  4:  { x: 5,  y: -70, scale: 1.0 },
  5:  { x: 5,  y: -75, scale: 1.0 },
  6:  { x: 10,  y: -75, scale: 1.0 },
  7:  { x: -15,  y: -35, scale: 1.0 },
  8:  { x: -20,   y: -35, scale: 1.0 },
  9:  { x: 15,  y: -20, scale: 1.0 },
  10: { x: -10,   y: 5, scale: 1.0 },
  11: { x: 0,  y: 0,  scale: 1.0 },
  12: { x: 5,  y: -10, scale: 1.0 },
  13: { x: -10,   y: 20, scale: 1.0 },
  14: { x: -15,   y: 15, scale: 1.0 },
  15: { x: 0,  y: 25, scale: 1.0 },
  16: { x: 8,  y: 18, scale: 1.0 },
}

export const MOUTH_LAYOUT = {
  1:  { x: -8,   y: -15,  scale: 0.9 },
  2:  { x: -5,   y: 30, scale: 1.0 },
  3:  { x: -10,   y: 25, scale: 1.0 },
  4:  { x: 5,  y: 20, scale: 1.0 },
  5:  { x: -8,   y: -10,  scale: 1.0 },
  6:  { x: -6,   y: 20, scale: 1.0 },
  7:  { x: -2,   y: 45, scale: 1.0 },
  8:  { x: 0,   y: 30, scale: 0.85 },
  9:  { x: 0,   y: 30, scale: 1.0 },
  10: { x: 10,   y: 60, scale: 0.95 },
  11: { x: -5,   y: 35, scale: 0.85 },
  12: { x: -1,   y: 5, scale: 0.8 },
  13: { x: -1,   y: 35, scale: 0.9 },
  14: { x: -2,   y: 30, scale: 0.85 },
  15: { x: 1,   y: 55, scale: 0.85 },
  16: { x: -3,   y: -15, scale: 0.9 },
  17: { x: -2,   y: 33, scale: 0.9 },
  18: { x: -9,  y: 47, scale: 1.0 },
  19: { x: 3,   y: 29, scale: 0.95 },
}

/**
 * Helper to get computed CSS transform for eyes
 */
export function getEyeTransform(eyeIndex) {
  const layout = EYE_LAYOUT[eyeIndex] || { x: 0, y: 0, scale: 1.0 }
  const xPercent = (layout.x / 256) * 100
  const yPercent = (layout.y / 256) * 100
  const scale = layout.scale || 1.0
  return `translateX(calc(-50% + ${xPercent.toFixed(2)}%)) translateY(${yPercent.toFixed(2)}%) scale(${scale})`
}

/**
 * Helper to get computed CSS transform for mouth
 */
export function getMouthTransform(mouthIndex) {
  const layout = MOUTH_LAYOUT[mouthIndex] || { x: 0, y: 0, scale: 1.0 }
  const xPercent = (layout.x / 256) * 100
  const yPercent = (layout.y / 256) * 100
  const scale = layout.scale || 1.0
  return `translateX(calc(-50% + ${xPercent.toFixed(2)}%)) translateY(${yPercent.toFixed(2)}%) scale(${scale})`
}

