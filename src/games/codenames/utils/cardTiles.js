export const CATEGORY_CODE_MAP = {
  red: 1,
  blue: 2,
  neutral: 3,
  assassin: 4
}

export const VARIANTS = ['a', 'b', 'c', 'd', 'e']

export function getCodenamesTile(category, cardId, word, tileVariant = null) {
  const code = CATEGORY_CODE_MAP[category]
  if (!code) return null

  if (tileVariant && VARIANTS.includes(tileVariant)) {
    return `/images/characters/codenames/tile-${tileVariant}${code}.webp`
  }

  let hash = 0
  const w = word || ''
  for (let i = 0; i < w.length; i++) {
    hash = ((hash << 5) - hash) + w.charCodeAt(i)
    hash |= 0
  }
  const idNum = Number(cardId) || 0
  const idx = Math.abs((idNum * 3) ^ hash) % VARIANTS.length
  const variant = VARIANTS[idx]

  return `/images/characters/codenames/tile-${variant}${code}.webp`
}

/**
 * Assigns one of the 20 Codenames character images to a player based on their team/role/id.
 */
export function getPlayerAvatarUrl(player) {
  if (!player) return '/images/characters/codenames/tile-a3.webp'

  const team = player.team?.toLowerCase()
  const code = team === 'red' ? 1 : team === 'blue' ? 2 : 3

  let seed = 0
  const str = String(player.id || player.name || 'player')
  for (let i = 0; i < str.length; i++) {
    seed = ((seed << 5) - seed) + str.charCodeAt(i)
    seed |= 0
  }

  // Spymaster gets iconic variant 'a', Operatives rotate across 'b', 'c', 'd', 'e'
  let variant = 'a'
  if (player.role === 'OPERATIVE') {
    const opVariants = ['b', 'c', 'd', 'e']
    variant = opVariants[Math.abs(seed) % opVariants.length]
  } else if (player.role !== 'SPYMASTER') {
    variant = VARIANTS[Math.abs(seed) % VARIANTS.length]
  }

  return `/images/characters/codenames/tile-${variant}${code}.webp`
}


