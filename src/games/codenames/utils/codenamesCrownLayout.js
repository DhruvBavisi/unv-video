/**
 * Codenames Crown Layout & Manual Transform Configuration
 * 
 * You can manually set the exact position (top, left), angle (degrees), and scale for the crown here:
 * 
 * - top: Vertical offset in px (positive = move down, negative = move up)
 * - left: Horizontal offset in px (positive = move right, negative = move left)
 * - angle: Rotation in degrees (e.g. -18 is tilted counter-clockwise)
 * - scale: Size multiplier (1.0 = 100%, 1.1 = 110%, 0.9 = 90%)
 * - size: Base width in px (20 for lobby avatar, 16 for board avatar)
 */
export const CODENAMES_CROWN_LAYOUT = {
  // 1. Codenames Lobby host avatar crown
  lobby: {
    top: -10,
    left: 0,
    angle: -30,
    scale: 1.0,
    size: 20,
  },
  // 2. Codenames In-Game Board host avatar crown
  board: {
    top: -9,
    left: -1,
    angle: -30,
    scale: 1.0,
    size: 16,
  },
}

/**
 * Helper to get computed CSS style for Codenames crown with live manual override support
 */
export function getCodenamesCrownStyle(mode = 'lobby') {
  let cfg = { ...(CODENAMES_CROWN_LAYOUT[mode] || CODENAMES_CROWN_LAYOUT.lobby) }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`codenames_crown_${mode}`)
      if (stored) {
        cfg = { ...cfg, ...JSON.parse(stored) }
      }
    } catch {
      // ignore
    }
  }
  const topVal = typeof cfg.top === 'number' ? `${cfg.top}px` : cfg.top
  const leftVal = typeof cfg.left === 'number' ? `${cfg.left}px` : cfg.left

  return {
    top: topVal,
    left: leftVal,
    transform: `rotate(${cfg.angle || 0}deg) scale(${cfg.scale || 1})`,
    transformOrigin: '50% 85%',
  }
}

/**
 * Helper to get Codenames crown size configuration
 */
export function getCodenamesCrownSize(mode = 'lobby') {
  let cfg = { ...(CODENAMES_CROWN_LAYOUT[mode] || CODENAMES_CROWN_LAYOUT.lobby) }
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`codenames_crown_${mode}`)
      if (stored) {
        cfg = { ...cfg, ...JSON.parse(stored) }
      }
    } catch {
      // ignore
    }
  }
  return cfg.size || (mode === 'board' ? 16 : 20)
}

