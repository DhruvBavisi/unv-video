import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('Testing Crown Placement, Manual Controls, Boiling Vibration & Codenames Crown...')

// 1. Verify HostCrown component
const hostCrownPath = path.join(rootDir, 'src', 'shared', 'components', 'HostCrown.jsx')
assert.ok(fs.existsSync(hostCrownPath), 'HostCrown.jsx must exist')
const hostCrownCode = fs.readFileSync(hostCrownPath, 'utf-8')
assert.ok(hostCrownCode.includes('viewBox="0 0 32 26"'), 'HostCrown must have viewBox 0 0 32 26')
assert.ok(hostCrownCode.includes('#ffd000'), 'HostCrown must have golden body fill')
assert.ok(hostCrownCode.includes('#ff2e55'), 'HostCrown must include ruby center jewel')
assert.ok(hostCrownCode.includes('#3388ff'), 'HostCrown must include sapphire blue jewel')
assert.ok(hostCrownCode.includes('#2bd652'), 'HostCrown must include emerald green jewel')
console.log('PASS: HostCrown component verified')

// 2. Verify CROWN_LAYOUT & manual controls in skribblAvatarLayout.js
const layoutCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'utils', 'skribblAvatarLayout.js'), 'utf-8')
assert.ok(layoutCode.includes('export const CROWN_LAYOUT'), 'skribblAvatarLayout.js must export CROWN_LAYOUT')
assert.ok(layoutCode.includes('export function getCrownStyle'), 'skribblAvatarLayout.js must export getCrownStyle')
assert.ok(layoutCode.includes('export function getCrownSize'), 'skribblAvatarLayout.js must export getCrownSize')
console.log('PASS: CROWN_LAYOUT & helper functions verified in skribblAvatarLayout.js')

// 3. Verify CrownManualControls component
const manualControlsPath = path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'CrownManualControls.jsx')
assert.ok(fs.existsSync(manualControlsPath), 'CrownManualControls.jsx must exist')
const manualControlsCode = fs.readFileSync(manualControlsPath, 'utf-8')
assert.ok(manualControlsCode.includes('CrownManualControls'), 'Must export CrownManualControls')
assert.ok(manualControlsCode.includes('skribbl:crown-update'), 'Must broadcast live crown updates')
console.log('PASS: CrownManualControls component verified')

// 4. Verify SkribblHome mascot #7 crown & manual controls integration
const skribblHomeCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'SkribblHome.jsx'), 'utf-8')
assert.ok(skribblHomeCode.includes('HostCrown'), 'SkribblHome must import HostCrown')
assert.ok(skribblHomeCode.includes('getCrownStyle'), 'SkribblHome must import getCrownStyle')
assert.ok(skribblHomeCode.includes('CrownManualControls'), 'SkribblHome must render CrownManualControls')
console.log('PASS: SkribblHome mascot #7 crown & manual controls verified')

// 5. Verify Skribbl Lobby host crown & manual controls integration
const skribblLobbyCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'Lobby.jsx'), 'utf-8')
assert.ok(skribblLobbyCode.includes('HostCrown'), 'Skribbl Lobby must import HostCrown')
assert.ok(skribblLobbyCode.includes('getCrownStyle'), 'Skribbl Lobby must import getCrownStyle')
assert.ok(skribblLobbyCode.includes('CrownManualControls'), 'Skribbl Lobby must render CrownManualControls')
assert.ok(!skribblLobbyCode.includes('<span className="sk-lobby-host-crown" title="Room Host">👑</span>'), 'Skribbl Lobby must not use emoji crown on avatar')
console.log('PASS: Skribbl Lobby host crown & manual controls verified')

// 6. Verify Exact Title Vibration Filter on Skribbl Avatar
const skribblAvatarCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'skribbl', 'components', 'SkribblAvatar.jsx'), 'utf-8')
assert.ok(skribblAvatarCode.includes('useSkribblBoilingAnimation'), 'SkribblAvatar must invoke useSkribblBoilingAnimation')
const globalsCss = fs.readFileSync(path.join(rootDir, 'src', 'shared', 'styles', 'globals.css'), 'utf-8')
assert.ok(globalsCss.includes('.sk-assembled-avatar') && globalsCss.includes('filter: url(#sk-boil-filter)'), 'globals.css must apply filter: url(#sk-boil-filter) to .sk-assembled-avatar')
console.log('PASS: Exact title vibration animation applied to Skribbl Avatar')

// 7. Verify CodenamesCrown component matches authentic codenames.game crown
const cnCrownPath = path.join(rootDir, 'src', 'games', 'codenames', 'components', 'CodenamesCrown.jsx')
assert.ok(fs.existsSync(cnCrownPath), 'CodenamesCrown.jsx must exist')
const cnCrownCode = fs.readFileSync(cnCrownPath, 'utf-8')
assert.ok(cnCrownCode.includes('#fed700'), 'CodenamesCrown must use authentic golden yellow fill')
assert.ok(cnCrownCode.includes('viewBox="0 0 576 512"'), 'CodenamesCrown must have viewBox 0 0 576 512')
assert.ok(cnCrownCode.includes('M309 106'), 'CodenamesCrown must use authentic crown path')
assert.ok(cnCrownCode.includes('cn-host-crown'), 'CodenamesCrown must have cn-host-crown class')
console.log('PASS: CodenamesCrown component verified')

// 8. Verify CODENAMES_CROWN_LAYOUT in codenamesCrownLayout.js
const cnLayoutPath = path.join(rootDir, 'src', 'games', 'codenames', 'utils', 'codenamesCrownLayout.js')
assert.ok(fs.existsSync(cnLayoutPath), 'codenamesCrownLayout.js must exist')
const cnLayoutCode = fs.readFileSync(cnLayoutPath, 'utf-8')
assert.ok(cnLayoutCode.includes('CODENAMES_CROWN_LAYOUT'), 'Must export CODENAMES_CROWN_LAYOUT')
assert.ok(cnLayoutCode.includes('getCodenamesCrownStyle'), 'Must export getCodenamesCrownStyle')
assert.ok(cnLayoutCode.includes('getCodenamesCrownSize'), 'Must export getCodenamesCrownSize')
console.log('PASS: CODENAMES_CROWN_LAYOUT & helpers verified in codenamesCrownLayout.js')

// 9. Verify CodenamesCrownManualControls component
const cnControlsPath = path.join(rootDir, 'src', 'games', 'codenames', 'components', 'CodenamesCrownManualControls.jsx')
assert.ok(fs.existsSync(cnControlsPath), 'CodenamesCrownManualControls.jsx must exist')
const cnControlsCode = fs.readFileSync(cnControlsPath, 'utf-8')
assert.ok(cnControlsCode.includes('CodenamesCrownManualControls'), 'Must export CodenamesCrownManualControls')
assert.ok(cnControlsCode.includes('codenames:crown-update'), 'Must broadcast live codenames crown updates')
console.log('PASS: CodenamesCrownManualControls component verified')

// 10. Verify Codenames Lobby avatar crown uses CodenamesCrown and manual controls
const codenamesLobbyCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'codenames', 'components', 'CodenamesLobby.jsx'), 'utf-8')
assert.ok(codenamesLobbyCode.includes('CodenamesCrown'), 'CodenamesLobby must import CodenamesCrown')
assert.ok(codenamesLobbyCode.includes('getCodenamesCrownStyle'), 'CodenamesLobby must import getCodenamesCrownStyle')
assert.ok(codenamesLobbyCode.includes('CodenamesCrownManualControls'), 'CodenamesLobby must render CodenamesCrownManualControls')
assert.ok(!codenamesLobbyCode.includes('<div className="cn-avatar-crown">👑</div>'), 'CodenamesLobby must not use emoji crown on avatar')
console.log('PASS: Codenames Lobby avatar crown uses CodenamesCrown and manual controls')

// 11. Verify Codenames Board avatar crown uses CodenamesCrown and manual controls
const codenamesBoardCode = fs.readFileSync(path.join(rootDir, 'src', 'games', 'codenames', 'components', 'CodenamesBoard.jsx'), 'utf-8')
assert.ok(codenamesBoardCode.includes('CodenamesCrown'), 'CodenamesBoard must import CodenamesCrown')
assert.ok(codenamesBoardCode.includes('getCodenamesCrownStyle'), 'CodenamesBoard must import getCodenamesCrownStyle')
assert.ok(codenamesBoardCode.includes('CodenamesCrownManualControls'), 'CodenamesBoard must render CodenamesCrownManualControls')
assert.ok(!codenamesBoardCode.includes('<div className="cn-board-crown">👑</div>'), 'CodenamesBoard must not use emoji crown on avatar')
console.log('PASS: Codenames Board avatar crown uses CodenamesCrown and manual controls')

// 12. Verify Spectator Row Crown Clipping Fix in codenames.css
const codenamesCss = fs.readFileSync(path.join(rootDir, 'src', 'games', 'codenames', 'styles', 'codenames.css'), 'utf-8')
assert.ok(codenamesCss.includes('.cn-spectator-content') && codenamesCss.includes('padding-top: 10px;'),
          'codenames.css must give .cn-spectator-content padding-top: 10px to prevent crown clipping')
assert.ok(codenamesCss.includes('.cn-lobby-body .cn-spectator-content') && codenamesCss.includes('padding-top: 10px;'),
          'codenames.css must give .cn-lobby-body .cn-spectator-content padding-top: 10px')
console.log('PASS: Spectator row crown clipping fix verified in codenames.css')

// 13. Verify that manual crown controls are strictly dev-only and removed from production
assert.ok(manualControlsCode.includes('if (!import.meta.env.DEV) return null'), 'CrownManualControls must return null in non-DEV environments')
assert.ok(cnControlsCode.includes('if (!import.meta.env.DEV) return null'), 'CodenamesCrownManualControls must return null in non-DEV environments')
assert.ok(skribblHomeCode.includes('{import.meta.env.DEV && <CrownManualControls defaultMode="home" />}'), 'SkribblHome must guard CrownManualControls with import.meta.env.DEV')
assert.ok(skribblLobbyCode.includes('{import.meta.env.DEV && <CrownManualControls defaultMode="lobby" />}'), 'Skribbl Lobby must guard CrownManualControls with import.meta.env.DEV')
assert.ok(codenamesLobbyCode.includes('{import.meta.env.DEV && <CodenamesCrownManualControls defaultMode="lobby" />}'), 'Codenames Lobby must guard CodenamesCrownManualControls with import.meta.env.DEV')
assert.ok(codenamesBoardCode.includes('{import.meta.env.DEV && <CodenamesCrownManualControls defaultMode="board" />}'), 'Codenames Board must guard CodenamesCrownManualControls with import.meta.env.DEV')
assert.ok(layoutCode.includes('typeof window !== \'undefined\' && import.meta.env.DEV'), 'skribblAvatarLayout must only use localStorage overrides in DEV')
assert.ok(cnLayoutCode.includes('typeof window !== \'undefined\' && import.meta.env.DEV'), 'codenamesCrownLayout must only use localStorage overrides in DEV')
console.log('PASS: Crown controls strictly guarded from production')

console.log('All tests passed successfully!')
