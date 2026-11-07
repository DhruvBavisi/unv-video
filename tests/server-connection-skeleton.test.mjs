import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

console.log('Testing Server Connection & Skeleton Loading Screen...')

// 1. Verify socket.js exports background connection utilities
const socketJsPath = path.join(rootDir, 'src', 'shared', 'realtime', 'socket.js')
const socketCode = fs.readFileSync(socketJsPath, 'utf-8')

assert.ok(socketCode.includes('initBackgroundServerConnection'), 'socket.js must export initBackgroundServerConnection')
assert.ok(socketCode.includes('pingServerHealth'), 'socket.js must export pingServerHealth')
assert.ok(socketCode.includes('getServerUrl'), 'socket.js must export getServerUrl')
assert.ok(socketCode.includes('isServerConnected'), 'socket.js must export isServerConnected')
assert.ok(socketCode.includes('subscribeServerConnection'), 'socket.js must export subscribeServerConnection')
console.log('PASS: socket.js background connection utilities and subscriptions verified')

// 2. Verify ServerSkeletonScreen component structure
const skeletonJsPath = path.join(rootDir, 'src', 'shared', 'components', 'ServerSkeletonScreen.jsx')
assert.ok(fs.existsSync(skeletonJsPath), 'ServerSkeletonScreen.jsx must exist on disk')
const skeletonCode = fs.readFileSync(skeletonJsPath, 'utf-8')

assert.ok(skeletonCode.includes('sk-server-skeleton'), 'Component must render .sk-server-skeleton container')
assert.ok(skeletonCode.includes('role="status"'), 'Component must include role="status" for accessibility')
assert.ok(skeletonCode.includes('aria-live="polite"'), 'Component must include aria-live="polite"')
assert.ok(skeletonCode.includes('sk-server-skeleton__status-pill'), 'Component must render status pill')
assert.ok(skeletonCode.includes('sk-server-skeleton__status-dot'), 'Component must render pulsing status dot')
assert.ok(skeletonCode.includes('sk-server-skeleton__card--undercover'), 'Component must render Undercover card')
assert.ok(skeletonCode.includes('sk-server-skeleton__card--skribbl'), 'Component must render Skribbl card')
assert.ok(skeletonCode.includes('sk-server-skeleton__card--codenames'), 'Component must render Codenames card')
assert.ok(skeletonCode.includes('onConnectRedirect'), 'Component must forward to destination on connect')
assert.strictEqual((skeletonCode.match(/<button/g) || []).length, 0, 'ServerSkeletonScreen must contain ZERO button elements')
assert.ok(skeletonCode.includes('sk-server-skeleton__card-btn-bone'), 'Component must render shimmer button bone placeholder')
console.log('PASS: ServerSkeletonScreen component markup & zero-button skeleton verified')

// 3. Verify App.jsx integration
const appJsPath = path.join(rootDir, 'src', 'app', 'App.jsx')
const appCode = fs.readFileSync(appJsPath, 'utf-8')

assert.ok(appCode.includes('ServerSkeletonScreen'), 'App.jsx must import and use ServerSkeletonScreen')
assert.ok(appCode.includes('initBackgroundServerConnection'), 'App.jsx must call initBackgroundServerConnection on mount')
assert.ok(appCode.includes('subscribeServerConnection'), 'App.jsx must subscribe to server connection status')
assert.ok(appCode.includes('hasResolvedInitialConnection'), 'App.jsx must track connection resolution')
assert.ok(appCode.includes('onConnectRedirect'), 'App.jsx must handle onConnectRedirect')
assert.ok(appCode.includes('handleNavigateOrWait'), 'App.jsx must intercept navigation when server is connecting behind')
console.log('PASS: App.jsx background connection and skeleton loading integration verified')

// 4. Verify globals.css skeleton styles
const cssPath = path.join(rootDir, 'src', 'shared', 'styles', 'globals.css')
const cssCode = fs.readFileSync(cssPath, 'utf-8')

assert.ok(cssCode.includes('.sk-server-skeleton'), 'globals.css must define .sk-server-skeleton')
assert.ok(cssCode.includes('skServerShimmer'), 'globals.css must define skServerShimmer keyframes')
assert.ok(cssCode.includes('.sk-skeleton-bone'), 'globals.css must define .sk-skeleton-bone with shimmer')
assert.ok(cssCode.includes('.sk-server-skeleton__status-pill'), 'globals.css must style status pill')
assert.ok(cssCode.includes('skPulseDot'), 'globals.css must define skPulseDot animation for status dot')
assert.ok(cssCode.includes('.sk-server-skeleton__card-btn-bone'), 'globals.css must style card button bone')
assert.ok(cssCode.includes('@media (prefers-reduced-motion: reduce)'), 'globals.css must support prefers-reduced-motion')
console.log('PASS: globals.css skeleton shimmer and responsive design verified')

console.log('All Server Connection & Skeleton Loading Screen tests passed successfully!')

