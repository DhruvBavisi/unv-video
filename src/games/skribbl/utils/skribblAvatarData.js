export const SKRIBBL_COLORS = [
  '#00b0ff', // 0: Sky Blue
  '#0050d0', // 1: Royal Blue
  '#001f70', // 2: Navy Blue
  '#e52521', // 3: Red
  '#8b0000', // 4: Dark Red
  '#ff7700', // 5: Orange
  '#ffd600', // 6: Yellow
  '#32c924', // 7: Lime Green
  '#0e6e16', // 8: Dark Green
  '#00e5ff', // 9: Cyan
  '#ff4081', // 10: Pink
  '#aa00ff', // 11: Purple
  '#4a148c', // 12: Deep Purple
  '#ffe0b2', // 13: Light Peach
  '#e0a96d', // 14: Tan
  '#82472b', // 15: Brown (Reference Default)
  '#3e2723', // 16: Dark Brown
  '#9e9e9e', // 17: Gray
]

export const TOTAL_EYES = 17
export const TOTAL_MOUTHS = 19
export const TOTAL_COLORS = SKRIBBL_COLORS.length

export function getRandomAvatar() {
  return {
    color: Math.floor(Math.random() * TOTAL_COLORS),
    eyes: Math.floor(Math.random() * TOTAL_EYES) + 1,
    mouth: Math.floor(Math.random() * TOTAL_MOUTHS) + 1,
  }
}

