export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 20
export const MIN_UNDERCOVER = 1
export const MIN_MR_WHITE = 0

export const DEFAULT_DISTRIBUTIONS = {
  3:  { undercover: 1, mrWhite: 0 },
  4:  { undercover: 1, mrWhite: 0 },
  5:  { undercover: 1, mrWhite: 1 },
  6:  { undercover: 1, mrWhite: 1 },
  7:  { undercover: 2, mrWhite: 1 },
  8:  { undercover: 2, mrWhite: 1 },
  9:  { undercover: 3, mrWhite: 1 },
  10: { undercover: 3, mrWhite: 1 },
  11: { undercover: 3, mrWhite: 2 },
  12: { undercover: 3, mrWhite: 2 },
  13: { undercover: 4, mrWhite: 2 },
  14: { undercover: 4, mrWhite: 2 },
  15: { undercover: 5, mrWhite: 2 },
  16: { undercover: 5, mrWhite: 2 },
  17: { undercover: 5, mrWhite: 3 },
  18: { undercover: 5, mrWhite: 3 },
  19: { undercover: 6, mrWhite: 3 },
  20: { undercover: 4, mrWhite: 3 },
}

export function getMinimumCivilians(totalPlayers) {
  return Math.ceil(totalPlayers / 2)
}

export function getMaximumNonCivilians(totalPlayers) {
  return Math.floor(totalPlayers / 2)
}

export function calculateCivilianCount(totalPlayers, undercover, mrWhite) {
  return totalPlayers - undercover - mrWhite
}

export function getMaximumUndercover(totalPlayers, mrWhite) {
  return Math.max(MIN_UNDERCOVER, Math.floor(totalPlayers / 2) - mrWhite)
}

export function getMaximumMrWhite(totalPlayers, undercover) {
  return Math.max(MIN_MR_WHITE, Math.floor(totalPlayers / 2) - undercover)
}

export function validateRoleConfiguration({ totalPlayers, undercover, mrWhite }) {
  if (typeof totalPlayers !== 'number' || totalPlayers < MIN_PLAYERS || totalPlayers > MAX_PLAYERS) {
    return { valid: false, reason: `Total players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.` }
  }
  if (typeof undercover !== 'number' || undercover < MIN_UNDERCOVER) {
    return { valid: false, reason: `Undercover must be at least ${MIN_UNDERCOVER}.` }
  }
  if (typeof mrWhite !== 'number' || mrWhite < MIN_MR_WHITE) {
    return { valid: false, reason: `Mr. White must be at least ${MIN_MR_WHITE}.` }
  }
  if (undercover + mrWhite > Math.floor(totalPlayers / 2)) {
    return { valid: false, reason: 'Non-civilian roles exceed the maximum allowed (50% rule).' }
  }
  const civilianCount = calculateCivilianCount(totalPlayers, undercover, mrWhite)
  if (civilianCount < getMinimumCivilians(totalPlayers)) {
    return { valid: false, reason: 'Civilians must be at least 50% of total players.' }
  }
  if (civilianCount + undercover + mrWhite !== totalPlayers) {
    return { valid: false, reason: 'Role counts must sum to total players.' }
  }
  return { valid: true, civilianCount }
}

export function getDefaultConfig(totalPlayers) {
  const def = DEFAULT_DISTRIBUTIONS[totalPlayers]
  if (!def) return { totalPlayers, undercover: 1, mrWhite: 0 }
  return { totalPlayers, undercover: def.undercover, mrWhite: def.mrWhite }
}

export function clampConfig(totalPlayers, undercover, mrWhite) {
  const maxNon = getMaximumNonCivilians(totalPlayers)
  let clampedUC = Math.max(MIN_UNDERCOVER, Math.min(undercover, maxNon))
  let clampedMW = Math.max(MIN_MR_WHITE, Math.min(mrWhite, maxNon - clampedUC))
  if (clampedUC + clampedMW > maxNon) {
    clampedMW = maxNon - clampedUC
  }
  if (clampedUC < MIN_UNDERCOVER) {
    clampedUC = MIN_UNDERCOVER
    clampedMW = Math.min(clampedMW, maxNon - clampedUC)
  }
  return { totalPlayers, undercover: clampedUC, mrWhite: clampedMW }
}
