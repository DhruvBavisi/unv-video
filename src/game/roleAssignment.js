import { WORD_PAIRS } from '../data/wordCategories.js'

const roleNames = ['CIVILIAN', 'UNDERCOVER', 'MR_WHITE']

export function assignLocalSecret({ distribution, category }) {
  const pair = WORD_PAIRS[category]?.[0]
  if (!pair) return null
  const available = roleNames.flatMap((role) => {
    const count = role === 'MR_WHITE' ? distribution.mrWhite : distribution[role.toLowerCase()]
    return Array.from({ length: count }, () => role)
  })
  const role = available[Math.floor(Math.random() * available.length)] ?? 'CIVILIAN'
  return { role, word: role === 'MR_WHITE' ? null : role === 'UNDERCOVER' ? pair.undercoverWord : pair.civilianWord }
}
