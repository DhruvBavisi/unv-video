import assert from 'node:assert/strict'
import { rankPlayers } from '../src/drawgame/finalScoresRanking.js'

const ranked = rankPlayers([
  { id: 'a', name: 'Ann', score: 100 },
  { id: 'b', name: 'Bob', score: 300 },
  { id: 'c', name: 'Cy', score: 300 },
  { id: 'd', name: 'Di', score: 50, spectator: true },
  { id: 'e', name: 'Ed' },
])
assert.deepEqual(ranked.map((p) => [p.id, p.rank]), [['b', 1], ['c', 1], ['a', 3], ['e', 4]])
assert.equal(ranked.find((p) => p.id === 'e').score, 0)
assert.deepEqual(rankPlayers(null), [])
console.log('skribbl final scores ranking: OK')
