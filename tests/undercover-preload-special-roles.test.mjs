import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const publicDir = path.join(rootDir, 'public')

console.log('Testing Undercover Special Roles Preloading & Image Resilience...')

// 1. Verify preloadUndercoverAssets.js exists and exports expected APIs
const preloadModulePath = path.join(rootDir, 'src', 'games', 'undercover', 'utils', 'preloadUndercoverAssets.js')
assert.ok(fs.existsSync(preloadModulePath), 'preloadUndercoverAssets.js must exist on disk')

const preloadCode = fs.readFileSync(preloadModulePath, 'utf-8')
assert.ok(preloadCode.includes('getSpecialRoleAssetUrls'), 'Must export getSpecialRoleAssetUrls')
assert.ok(preloadCode.includes('preloadSpecialRoles'), 'Must export preloadSpecialRoles')
assert.ok(preloadCode.includes('areSpecialRolesPreloaded'), 'Must export areSpecialRolesPreloaded')
assert.ok(preloadCode.includes('handleUndercoverImageError'), 'Must export handleUndercoverImageError')
console.log('PASS: preloadUndercoverAssets.js exports required preloader and error handling APIs')

// 2. Dynamically import preloader and verify all enumerated asset URLs exist on disk
const { getSpecialRoleAssetUrls, preloadSpecialRoles, areSpecialRolesPreloaded } = await import('../src/games/undercover/utils/preloadUndercoverAssets.js')
const assetUrls = getSpecialRoleAssetUrls()

assert.ok(assetUrls.length >= 20, `Must enumerate at least 20 character assets to preload (found ${assetUrls.length})`)

for (const url of assetUrls) {
  const diskPath = path.join(publicDir, url.replace(/^\//, ''))
  assert.ok(fs.existsSync(diskPath), `Preload asset must exist on disk: ${diskPath}`)
}
console.log(`PASS: All ${assetUrls.length} Undercover character assets exist on disk`)

// 3. Verify preloadSpecialRoles() executes and resolves cleanly in Node environment
const preloadResult = await preloadSpecialRoles()
assert.ok(Array.isArray(preloadResult), 'preloadSpecialRoles must return array of results')
assert.strictEqual(areSpecialRolesPreloaded(), true, 'areSpecialRolesPreloaded() must return true after resolution')
console.log('PASS: preloadSpecialRoles() successfully resolves and updates status')

// 4. Verify ModeSelect integration (preloads on mount and panel interaction)
const modeSelectPath = path.join(rootDir, 'src', 'shared', 'components', 'ModeSelect.jsx')
const modeSelectCode = fs.readFileSync(modeSelectPath, 'utf-8')
assert.ok(modeSelectCode.includes('preloadSpecialRoles'), 'ModeSelect must import preloadSpecialRoles')
assert.ok(modeSelectCode.includes('useEffect('), 'ModeSelect must invoke preloader in useEffect on mount')
assert.ok(modeSelectCode.includes('onMouseEnter={preloadSpecialRoles}'), 'ModeSelect must preload on panel hover/touch')
console.log('PASS: ModeSelect proactively preloads special role assets')

// 5. Verify OnlineGame integration (preloads on mount & ensures images loaded before create room)
const onlineGamePath = path.join(rootDir, 'src', 'games', 'undercover', 'OnlineGame.jsx')
const onlineGameCode = fs.readFileSync(onlineGamePath, 'utf-8')
assert.ok(onlineGameCode.includes('preloadSpecialRoles'), 'OnlineGame must import preloadSpecialRoles')
assert.ok(onlineGameCode.includes('handleOpenCreate'), 'OnlineGame must define handleOpenCreate')
assert.ok(onlineGameCode.includes('handleUndercoverImageError'), 'OnlineGame must use handleUndercoverImageError')
assert.ok(onlineGameCode.includes('loading="eager"'), 'OnlineGame must use eager loading for character images')
console.log('PASS: OnlineGame ensures special role images are loaded before entering create game page')

// 6. Verify App.jsx integration (background warmup on app startup)
const appPath = path.join(rootDir, 'src', 'app', 'App.jsx')
const appCode = fs.readFileSync(appPath, 'utf-8')
assert.ok(appCode.includes('preloadSpecialRoles'), 'App.jsx must import preloadSpecialRoles')
assert.ok(appCode.includes('preloadSpecialRoles()'), 'App.jsx must call preloadSpecialRoles on initial mount')
console.log('PASS: App.jsx starts background asset warming on app mount')

// 7. Verify CluePhase & EliminationOverlay error fallback resilience
const cluePhasePath = path.join(rootDir, 'src', 'games', 'undercover', 'components', 'CluePhase.jsx')
const clueCode = fs.readFileSync(cluePhasePath, 'utf-8')
assert.ok(clueCode.includes('handleUndercoverImageError'), 'CluePhase must use handleUndercoverImageError')

const elimPath = path.join(rootDir, 'src', 'games', 'undercover', 'components', 'EliminationOverlay.jsx')
const elimCode = fs.readFileSync(elimPath, 'utf-8')
assert.ok(elimCode.includes('handleUndercoverImageError'), 'EliminationOverlay must use handleUndercoverImageError')
console.log('PASS: In-game components equipped with error fallback to prevent broken question marks')

console.log('All Undercover special roles preloading & image resilience tests passed!')

