import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getCodenamesTile, getPlayerAvatarUrl } from '../src/games/codenames/utils/cardTiles.js'
import { assignNextTileVariant } from '../server/games/codenames/codenamesBot.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.resolve(__dirname, '..', 'public')

console.log('Testing Codenames Card WebP Tile Mapping...')

// 1. Verify all 20 WebP tile files exist in public/images/characters/codenames
const categories = ['red', 'blue', 'neutral', 'assassin']
const categoryCodeMap = { red: 1, blue: 2, neutral: 3, assassin: 4 }
const variants = ['a', 'b', 'c', 'd', 'e']

for (const cat of categories) {
  const code = categoryCodeMap[cat]
  for (const v of variants) {
    const relPath = `images/characters/codenames/tile-${v}${code}.webp`
    const absPath = path.join(publicDir, relPath)
    assert.ok(fs.existsSync(absPath), `File must exist on disk: ${relPath}`)
  }
}
console.log('PASS  All 20 character tile WebP files exist on disk')

// 2. Verify getCodenamesTile returns valid existing URLs for all categories and diverse inputs
for (const cat of categories) {
  for (let id = 0; id < 25; id++) {
    const tileUrl = getCodenamesTile(cat, id.toString(), `WORD_${id}`)
    assert.ok(typeof tileUrl === 'string' && tileUrl.startsWith('/images/characters/codenames/tile-'), `URL format for ${cat} card ${id}`)
    const absPath = path.join(publicDir, tileUrl.replace(/^\//, ''))
    assert.ok(fs.existsSync(absPath), `Resolved image path must exist: ${tileUrl}`)
  }
}
console.log('PASS  getCodenamesTile generates valid, existent asset paths across all 25 board positions')

// 3. Verify deterministic consistency across clients
const urlA = getCodenamesTile('red', '7', 'SPY')
const urlB = getCodenamesTile('red', '7', 'SPY')
assert.strictEqual(urlA, urlB, 'Tile selection must be deterministic across clients')
console.log(`PASS  Deterministic mapping verified (red, id=7, word=SPY => ${urlA})`)

// 4. Verify invalid category gracefully returns null
assert.strictEqual(getCodenamesTile(undefined, '1', 'TEST'), null, 'Undefined category returns null')
assert.strictEqual(getCodenamesTile('unknown', '1', 'TEST'), null, 'Unknown category returns null')
console.log('PASS  Null safety verified for unrevealed or undefined categories')

// 5. Verify getPlayerAvatarUrl assigns valid team-themed character tiles
const redSpyAvatar = getPlayerAvatarUrl({ id: 'p1', team: 'red', role: 'SPYMASTER' })
const redOpAvatar = getPlayerAvatarUrl({ id: 'p2', team: 'red', role: 'OPERATIVE' })
const blueSpyAvatar = getPlayerAvatarUrl({ id: 'p3', team: 'blue', role: 'SPYMASTER' })
const blueOpAvatar = getPlayerAvatarUrl({ id: 'p4', team: 'blue', role: 'OPERATIVE' })
const specAvatar = getPlayerAvatarUrl({ id: 'p5', team: null, role: null })

assert.ok(redSpyAvatar.includes('1.webp'), `Red Spymaster gets code 1: ${redSpyAvatar}`)
assert.ok(redOpAvatar.includes('1.webp'), `Red Operative gets code 1: ${redOpAvatar}`)
assert.ok(blueSpyAvatar.includes('2.webp'), `Blue Spymaster gets code 2: ${blueSpyAvatar}`)
assert.ok(blueOpAvatar.includes('2.webp'), `Blue Operative gets code 2: ${blueOpAvatar}`)
assert.ok(specAvatar.includes('3.webp'), `Spectator gets code 3: ${specAvatar}`)
assert.ok(fs.existsSync(path.join(publicDir, redSpyAvatar.replace(/^\//, ''))), 'Avatar file exists')
console.log('PASS  Character image avatar assignment verified for all teams and roles')

// 6. Verify non-repeating random assignment across 5 opened cards
const mockRoom = { tileVariantPools: { red: [], blue: [], neutral: [], assassin: [] } }
const redCards = Array.from({ length: 9 }, (_, i) => ({ id: String(i), category: 'red' }))
for (const c of redCards) {
  assignNextTileVariant(mockRoom, c)
}

const first5Variants = redCards.slice(0, 5).map(c => c.tileVariant)
const uniqueFirst5 = new Set(first5Variants)
assert.strictEqual(uniqueFirst5.size, 5, 'First 5 opened cards must have 5 strictly unique variants')
assert.ok(redCards[5].tileVariant, '6th card must receive a variant')
console.log(`PASS  Non-repeating pool verified (first 5: [${first5Variants.join(', ')}], 6th: ${redCards[5].tileVariant})`)

console.log('\nAll Codenames Card WebP tile tests passed!')
