export const ROLE_DISTRIBUTIONS = {
  3: { civilian: 2, undercover: 1, mrWhite: 0 },
  4: { civilian: 3, undercover: 1, mrWhite: 0 },
  5: { civilian: 3, undercover: 1, mrWhite: 1 },
  6: { civilian: 4, undercover: 1, mrWhite: 1 },
  7: { civilian: 4, undercover: 2, mrWhite: 1 },
  8: { civilian: 5, undercover: 2, mrWhite: 1 },
  9: { civilian: 5, undercover: 3, mrWhite: 1 },
  10: { civilian: 6, undercover: 3, mrWhite: 1 },
  11: { civilian: 6, undercover: 3, mrWhite: 2 },
  12: { civilian: 7, undercover: 3, mrWhite: 2 },
  13: { civilian: 7, undercover: 4, mrWhite: 2 },
  14: { civilian: 8, undercover: 4, mrWhite: 2 },
  15: { civilian: 8, undercover: 5, mrWhite: 2 },
  16: { civilian: 9, undercover: 5, mrWhite: 2 },
  17: { civilian: 9, undercover: 5, mrWhite: 3 },
  18: { civilian: 10, undercover: 5, mrWhite: 3 },
  19: { civilian: 10, undercover: 6, mrWhite: 3 },
  20: { civilian: 11, undercover: 4, mrWhite: 3 },
}

export const PLAYER_COUNTS = Object.keys(ROLE_DISTRIBUTIONS).map(Number)
