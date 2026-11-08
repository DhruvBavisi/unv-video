import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('Testing Server Connection & Verification of Skeleton Loading Removal...')

// 1. Verify socket.js exports background connection utilities
const socketJsPath = path.join(rootDir, 'src', 'shared', 'realtime', 'socket.js')
const socketCode = fs.readFileSync(socketJsPath, 'utf-8')

assert.ok(socketCode.includes('initBackgroundServerConnection'), 'socket.js must export initBackgroundServerConnection')
assert.ok(socketCode.includes('pingServerHealth'), 'socket.js must export pingServerHealth')
assert.ok(socketCode.includes('getServerUrl'), 'socket.js must export getServerUrl')
assert.ok(socketCode.includes('isServerConnected'), 'socket.js must export isServerConnected')
assert.ok(socketCode.includes('subscribeServerConnection'), 'socket.js must export subscribeServerConnection')
console.log('PASS: socket.js background connection utilities and subscriptions verified')

// 2. Verify ServerSkeletonScreen component is entirely removed from disk
const skeletonJsPath = path.join(rootDir, 'src', 'shared', 'components', 'ServerSkeletonScreen.jsx')
assert.ok(!fs.existsSync(skeletonJsPath), 'ServerSkeletonScreen.jsx must be completely removed from disk')
console.log('PASS: ServerSkeletonScreen component removed from disk')

// 3. Verify App.jsx has completely removed skeleton loading and navigates directly
const appJsPath = path.join(rootDir, 'src', 'app', 'App.jsx')
const appCode = fs.readFileSync(appJsPath, 'utf-8')

assert.ok(!appCode.includes('ServerSkeletonScreen'), 'App.jsx must not import or render ServerSkeletonScreen')
assert.ok(!appCode.includes('hasResolvedInitialConnection'), 'App.jsx must not block initial connection with skeleton')
assert.ok(!appCode.includes('pendingDestination'), 'App.jsx must not hold pending destinations for skeleton loading')
assert.ok(!appCode.includes('handleNavigateOrWait'), 'App.jsx must not intercept navigation with wait screens')
assert.ok(appCode.includes('handleNavigate'), 'App.jsx must directly navigate to target view')
assert.ok(appCode.includes('initBackgroundServerConnection'), 'App.jsx must call initBackgroundServerConnection on mount')
console.log('PASS: App.jsx direct navigation without skeleton loading verified')

// 4. Verify globals.css skeleton styles are entirely removed
const cssPath = path.join(rootDir, 'src', 'shared', 'styles', 'globals.css')
const cssCode = fs.readFileSync(cssPath, 'utf-8')

assert.ok(!cssCode.includes('.sk-server-skeleton'), 'globals.css must not contain .sk-server-skeleton')
assert.ok(!cssCode.includes('skServerShimmer'), 'globals.css must not contain skServerShimmer keyframes')
assert.ok(!cssCode.includes('.sk-skeleton-bone'), 'globals.css must not contain .sk-skeleton-bone')
assert.ok(!cssCode.includes('.sk-server-skeleton__status-pill'), 'globals.css must not contain .sk-server-skeleton__status-pill')
console.log('PASS: globals.css skeleton styles entirely removed')

console.log('All Server Connection & Skeleton Removal tests passed successfully!')
