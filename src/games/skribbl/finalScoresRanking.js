// Pure helper: sorted, ranked players for the final-score screen. No React imports.
export function rankPlayers(players) {
  const sorted = (players || [])
    .filter((p) => p && !p.spectator)
    .map((p) => ({ ...p, score: Number.isFinite(p.score) ? p.score : 0 }))
    .sort((a, b) => b.score - a.score || String(a.name).localeCompare(String(b.name)))

  let prevScore = null
  let prevRank = 0
  return sorted.map((p, index) => {
    const rank = p.score === prevScore ? prevRank : index + 1
    prevScore = p.score
    prevRank = rank
    return { ...p, rank }
  })
}
