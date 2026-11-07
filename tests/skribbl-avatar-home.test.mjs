import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SKRIBBL_COLORS, TOTAL_COLORS, TOTAL_EYES, TOTAL_MOUTHS, getRandomAvatar } from '../src/games/skribbl/utils/skribblAvatarData.js'
import { EYE_LAYOUT, MOUTH_LAYOUT, getEyeTransform, getMouthTransform } from '../src/games/skribbl/utils/skribblAvatarLayout.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const skribblDir = path.join(rootDir, 'public', 'images', 'characters', 'skribbl')

console.log('Testing Skribbl Avatar, Home & Lobby Assets...')

// 1. Verify core assets exist on disk
assert.ok(fs.existsSync(path.join(skribblDir, 'body.webp')), 'body.webp must exist')
assert.ok(fs.existsSync(path.join(skribblDir, 'body-fill.webp')), 'body-fill.webp must exist')
assert.ok(fs.existsSync(path.join(skribblDir, 'logo.webp')), 'logo.webp must exist')
assert.ok(fs.existsSync(path.join(skribblDir, 'background.webp')), 'background.webp must exist')
assert.ok(fs.existsSync(path.join(skribblDir, 'dice.webp')), 'dice.webp must exist')
const diceStat = fs.statSync(path.join(skribblDir, 'dice.webp'))
assert.ok(diceStat.size > 20, 'dice.webp must have valid image size')
console.log('PASS: Core webp assets exist (body, body-fill, logo, background, dice)')

// 2. Verify all 16 eyes exist
for (let i = 1; i <= 16; i++) {
  const eyePath = path.join(skribblDir, 'eyes', `eye-${i}.webp`)
  assert.ok(fs.existsSync(eyePath), `eye-${i}.webp must exist on disk`)
}
console.log('PASS: All 16 eyes WebP files exist on disk')

// 3. Verify all 19 mouths exist
for (let j = 1; j <= 19; j++) {
  const mouthPath = path.join(skribblDir, 'mouth', `mouth-${j}.webp`)
  assert.ok(fs.existsSync(mouthPath), `mouth-${j}.webp must exist on disk`)
}
console.log('PASS: All 19 mouths WebP files exist on disk')

// 4. Verify constants & color palette
assert.strictEqual(TOTAL_COLORS, 18, 'Must have 18 colors')
assert.strictEqual(TOTAL_EYES, 16, 'Must have 16 eyes')
assert.strictEqual(TOTAL_MOUTHS, 19, 'Must have 19 mouths')
assert.strictEqual(SKRIBBL_COLORS.length, 18, 'Color array length must match 18')
console.log('PASS: Constants match asset library exactly (18 colors, 16 eyes, 19 mouths)')

// 5. Test Randomize function bounds across 50 iterations
for (let k = 0; k < 50; k++) {
  const rand = getRandomAvatar()
  assert.ok(rand.color >= 0 && rand.color < TOTAL_COLORS, `Color ${rand.color} within [0, 17]`)
  assert.ok(rand.eyes >= 1 && rand.eyes <= TOTAL_EYES, `Eyes ${rand.eyes} within [1, 16]`)
  assert.ok(rand.mouth >= 1 && rand.mouth <= TOTAL_MOUTHS, `Mouth ${rand.mouth} within [1, 19]`)
}
console.log('PASS: getRandomAvatar() produces valid ranges over 50 iterations')

// 6. Verify EYE_LAYOUT and MOUTH_LAYOUT manual transform mappings
for (let i = 1; i <= TOTAL_EYES; i++) {
  assert.ok(EYE_LAYOUT[i], `EYE_LAYOUT must define transform for eye ${i}`)
  assert.strictEqual(typeof EYE_LAYOUT[i].x, 'number', `Eye ${i} x must be a number`)
  assert.strictEqual(typeof EYE_LAYOUT[i].y, 'number', `Eye ${i} y must be a number`)
  assert.strictEqual(typeof EYE_LAYOUT[i].scale, 'number', `Eye ${i} scale must be a number`)
  const transform = getEyeTransform(i)
  assert.ok(transform.includes('translateX') && transform.includes('translateY') && transform.includes('scale'), `Eye ${i} transform valid`)
}
console.log('PASS: EYE_LAYOUT covers all 16 eyes with calibrated manual transforms')

for (let j = 1; j <= TOTAL_MOUTHS; j++) {
  assert.ok(MOUTH_LAYOUT[j], `MOUTH_LAYOUT must define transform for mouth ${j}`)
  assert.strictEqual(typeof MOUTH_LAYOUT[j].x, 'number', `Mouth ${j} x must be a number`)
  assert.strictEqual(typeof MOUTH_LAYOUT[j].y, 'number', `Mouth ${j} y must be a number`)
  assert.strictEqual(typeof MOUTH_LAYOUT[j].scale, 'number', `Mouth ${j} scale must be a number`)
  const transform = getMouthTransform(j)
  assert.ok(transform.includes('translateX') && transform.includes('translateY') && transform.includes('scale'), `Mouth ${j} transform valid`)
}
console.log('PASS: MOUTH_LAYOUT covers all 19 mouths with calibrated manual transforms')

// 7. Verify SkribblHome source code conforms to requirements
const homeCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'SkribblHome.jsx'), 'utf-8')

// Arrow row order: Eyes -> Mouth -> Color
const arrowSection = homeCode.slice(homeCode.indexOf('sk-home-arrow-col--left'), homeCode.indexOf('sk-home-arrow-col--right'))
assert.ok(arrowSection.indexOf('prevEyes') < arrowSection.indexOf('prevMouth'), 'Left arrows: Eyes must precede Mouth')
assert.ok(arrowSection.indexOf('prevMouth') < arrowSection.indexOf('prevColor'), 'Left arrows: Mouth must precede Color')

assert.ok(homeCode.includes('sk-home-avatar-stage'), 'SkribblHome must use tight sk-home-avatar-stage container')
assert.ok(homeCode.includes('/images/characters/skribbl/dice.webp'), 'SkribblHome must render dice.webp image')
assert.ok(homeCode.includes('sk-home-join-input-wrap'), 'SkribblHome must contain join input wrap')
assert.ok(homeCode.includes('bouncy={true}'), 'SkribblHome mascots/avatar must use bouncy={true}')
console.log('PASS: SkribblHome conforms to all requirements')

// 8. Verify Avatar Stability and Logo Gentle Breathing (Zero growing/shrinking on avatars, gentle logo breathing)
const cssCode = fs.readFileSync(path.join(rootDir, 'src', 'shared', 'styles', 'globals.css'), 'utf-8')
assert.ok(!cssCode.includes('skAvatarGlitchBody'), 'Must not have growing/shrinking skAvatarGlitchBody keyframes')
assert.ok(!cssCode.includes('skAvatarGlitchEyes'), 'Must not have growing/shrinking skAvatarGlitchEyes keyframes')
assert.ok(!cssCode.includes('skAvatarGlitchMouth'), 'Must not have growing/shrinking skAvatarGlitchMouth keyframes')
assert.ok(!cssCode.includes('skCrownGlitch'), 'Crown must not have jittering skCrownGlitch keyframes')
assert.ok(cssCode.includes('skLogoBreathe'), 'Must define skLogoBreathe keyframes for gentle title scaling')
assert.ok(cssCode.includes('rotate(-20deg)'), 'Crown must be rotated by -20deg')
assert.ok(cssCode.includes('skAvatarPopGlitch'), 'Must define skAvatarPopGlitch keyframes for interactive click pop')
console.log('PASS: Avatar stability (no growing/shrinking) and gentle title scaling verified in globals.css')

// 9. Verify Lobby component theme & structure
const lobbyCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'Lobby.jsx'), 'utf-8')
assert.ok(lobbyCode.includes('sk-lobby-view'), 'Lobby must use sk-lobby-view')
assert.ok(lobbyCode.includes('/images/characters/skribbl/logo.webp'), 'Lobby must render authentic logo.webp')
assert.ok(lobbyCode.includes('sk-lobby-card'), 'Lobby must render sk-lobby-card')
assert.ok(lobbyCode.includes('sk-lobby-code-box'), 'Lobby must render sk-lobby-code-box')
assert.ok(lobbyCode.includes('sk-lobby-players-list'), 'Lobby must render sk-lobby-players-list')
assert.ok(lobbyCode.includes('sk-lobby-btn-start'), 'Lobby must render sk-lobby-btn-start')
assert.ok(lobbyCode.includes('export function getAvatarColorClass'), 'getAvatarColorClass must remain exported')
console.log('PASS: Lobby component successfully upgraded to Skribbl theme')

// 10. Verify Boiling Line Stop-Motion Glitch Animation Controller
import { BOILING_CONFIG, LOGO_VARIANTS, AVATAR_FRAMES } from '../src/games/skribbl/hooks/useSkribblBoilingAnimation.js'

assert.strictEqual(BOILING_CONFIG.logo.fps, 5, 'Logo must be 5 FPS')
assert.strictEqual(BOILING_CONFIG.logo.intervalMs, 200, 'Logo interval must be 200ms')
assert.strictEqual(BOILING_CONFIG.logo.variantCount, 6, 'Logo must have 6 variants pool')
assert.strictEqual(LOGO_VARIANTS.length, 6, 'LOGO_VARIANTS must have 6 items')
assert.strictEqual(BOILING_CONFIG.avatars.fps, 10, 'Avatars must run at ~10 FPS')
assert.strictEqual(BOILING_CONFIG.avatars.minIntervalMs, 90, 'Avatars min interval 90ms')
assert.strictEqual(BOILING_CONFIG.avatars.maxIntervalMs, 130, 'Avatars max interval 130ms')
assert.strictEqual(AVATAR_FRAMES.length, 8, 'AVATAR_FRAMES must define 8 mascots')
AVATAR_FRAMES.forEach((frames, i) => {
  assert.ok(frames.length >= 4 && frames.length <= 5, `Avatar ${i} must have 4-5 face frames`)
})

assert.ok(homeCode.includes('useSkribblBoilingAnimation'), 'SkribblHome must invoke useSkribblBoilingAnimation')
assert.ok(homeCode.includes('sk-mascot-crown'), 'SkribblHome must render sk-mascot-crown on purple mascot')
assert.ok(homeCode.includes('sk-boil-filter'), 'SkribblHome must contain sk-boil-filter SVG element')
assert.ok(cssCode.includes('image-rendering: pixelated;'), 'globals.css must specify image-rendering: pixelated')

console.log('PASS: Boiling Line Stop-Motion animation verified')

// 11. Verify iPhone PWA Safe Area & Authentic Blue Doodle Background in Main Game
const pwaCss = fs.readFileSync(path.join(rootDir, 'src', 'shared', 'styles', 'sk-pwa-background.css'), 'utf-8')
const appCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'SkribblApp.jsx'), 'utf-8')
const drawingPhaseCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'DrawingPhase.jsx'), 'utf-8')

// Top bar white background & safe area inset padding
assert.ok(cssCode.includes('.sk-topbar-wrapper'), 'globals.css must define .sk-topbar-wrapper')
assert.ok(cssCode.includes('background: #ffffff;'), 'sk-topbar-wrapper must have solid #ffffff background')
assert.ok(cssCode.includes('env(safe-area-inset-top, 0px)'), 'sk-topbar-wrapper must account for env(safe-area-inset-top)')

// Main game blue doodle background in globals.css and sk-pwa-background.css
assert.ok(cssCode.includes('.sk-view--game'), 'globals.css must define .sk-view--game')
assert.ok(cssCode.includes('background-color: #0d3284;'), 'globals.css must set #0d3284 background on .sk-view--game')
assert.ok(pwaCss.includes("background-image: url('/images/characters/skribbl/background.webp');"), 'sk-pwa-background.css must set doodle background')
assert.ok(pwaCss.includes('background-color: #0d3284;'), 'sk-pwa-background.css must set #0d3284 background on .sk-view--game')

// Removal of pastel shapes from DrawingPhase
assert.ok(!drawingPhaseCode.includes('sk-bg-shapes'), 'DrawingPhase must not contain legacy pastel sk-bg-shapes')

// SkribblHome & Lobby top safe area padding
assert.ok(cssCode.includes('.sk-home-view') && cssCode.includes('padding: calc(clamp(16px, 4vw, 36px) + env(safe-area-inset-top, 0px))'), 'sk-home-view must include safe-area-inset-top')
assert.ok(cssCode.includes('.sk-lobby-view') && cssCode.includes('padding: calc(clamp(16px, 4vw, 32px) + env(safe-area-inset-top, 0px))'), 'sk-lobby-view must include safe-area-inset-top')

// SkribblApp dynamic page background: #ffffff in DRAWING_PHASE, #0d3284 in lobby/menu
assert.ok(appCode.includes("activePageBg = isInGame ? '#ffffff' : '#0d3284'"), 'SkribblApp must dynamically set #ffffff for drawing phase and #0d3284 for menus')
assert.ok(appCode.includes('usePageBackground(activePageBg)'), 'SkribblApp must pass activePageBg to usePageBackground')

console.log('PASS: iPhone PWA Safe Area and Blue Doodle Background verified across all surfaces')

// 12. Verify Transparent Safe Top, Red Leave Button, Minimal Network Bars, & Two-Tone Skeleton
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8')
const netStatusCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'SkribblNetworkStatus.jsx'), 'utf-8')
const skeletonCode = fs.readFileSync(path.join(rootDir, 'src', 'shared', 'components', 'ServerSkeletonScreen.jsx'), 'utf-8')

// Transparent safe top meta tag
assert.ok(indexHtml.includes('<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />') || indexHtml.includes('apple-mobile-web-app-status-bar-style'), 'index.html must configure apple status bar style for edge-to-edge transparent safe top')

// Red Leave Button
assert.ok(lobbyCode.includes('sk-lobby-btn-leave'), 'Lobby must render sk-lobby-btn-leave')
assert.ok(cssCode.includes('.sk-lobby-btn-leave'), 'globals.css must style .sk-lobby-btn-leave with red gradient and bevel shadow')

// Network Bars Icon
assert.ok(netStatusCode.includes('NetworkBarsIcon'), 'SkribblNetworkStatus must export and render NetworkBarsIcon')
assert.ok(cssCode.includes('.sk-network-bars'), 'globals.css must style .sk-network-bars')
assert.ok(cssCode.includes('.sk-network-bars--connected .sk-net-bar'), 'globals.css must color connected bars green')
assert.ok(cssCode.includes('.sk-network-bars--connecting .sk-net-bar'), 'globals.css must color connecting bars amber')
assert.ok(cssCode.includes('.sk-network-bars--disconnected .sk-net-bar-1'), 'globals.css must color disconnected bars red')

// Two-Tone Skeleton
assert.ok(!skeletonCode.includes('sk-server-skeleton__glow'), 'ServerSkeletonScreen must not render colored glows')
assert.ok(!skeletonCode.includes('sk-server-skeleton__action-btn--skribbl'), 'ServerSkeletonScreen must not use multi-color button variants')
assert.ok(!cssCode.includes('.sk-server-skeleton__card--undercover.is-selected'), 'globals.css must not have multi-color card highlights')

console.log('PASS: Transparent Safe Top, Red Leave Button, Network Bars Icon, and Two-Tone Skeleton verified')
console.log('All Skribbl Avatar, Home & Lobby tests passed successfully!')
