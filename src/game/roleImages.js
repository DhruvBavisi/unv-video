const CHARACTER_DIR = '/images/characters'

const ROLE_IMAGES = {
  CIVILIAN: `${CHARACTER_DIR}/civilian-1.png`,
  UNDERCOVER: `${CHARACTER_DIR}/undercover-1.png`,
  MR_WHITE: `${CHARACTER_DIR}/mrwhite-1.png`,
}

export function getRoleImage(role) {
  return ROLE_IMAGES[role] || ROLE_IMAGES.CIVILIAN
}

export function getRoleImageAlt(role) {
  const alts = {
    CIVILIAN: 'Your character — the Civilian',
    UNDERCOVER: 'Your character — the Undercover',
    MR_WHITE: 'Your character — Mr. White',
  }
  return alts[role] || alts.CIVILIAN
}