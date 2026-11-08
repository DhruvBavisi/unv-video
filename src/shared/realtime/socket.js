import { io } from 'socket.io-client'
import { readIdentity } from '../session/identity.js'

let socket = null
let listenersAttached = false
const connectionListeners = new Set()
let warmingInterval = null

export function getServerUrl() {
  const metaEnv = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {}
  const procEnv = typeof process !== 'undefined' && process.env ? process.env : {}
  
  let rawUrl = (
    metaEnv.VITE_SOCKET_URL ||
    metaEnv.SOCKET_URL ||
    procEnv.VITE_SOCKET_URL ||
    procEnv.SOCKET_URL ||
    ''
  ).trim()

  // Filter out dead or legacy servers (e.g. old word-party endpoints from previous configs)
  if (rawUrl.includes('word-party')) {
    rawUrl = ''
  }

  if (rawUrl) {
    return rawUrl
  }

  // Canonical production server on Render
  if (metaEnv.PROD || (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app'))) {
    return 'https://undercover-server.onrender.com'
  }

  return (typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'http://localhost:3001').trim()
}

/**
 * Pings the server HTTP health endpoint to wake up cold sleeping instances (e.g. Render free tier)
 * immediately in parallel with Socket.io connection.
 */
export function pingServerHealth() {
  if (typeof window === 'undefined') return
  try {
    const healthUrl = `${getServerUrl()}/health`
    fetch(healthUrl, { mode: 'cors', cache: 'no-store' })
      .then((res) => {
        if (res.ok && socket && !socket.connected) {
          socket.connect()
        }
      })
      .catch(() => {})
  } catch {
    // Non-blocking ping failure tolerated
  }
}

export function isServerConnected() {
  return !!(socket && socket.connected)
}

function notifyConnectionListeners(connected) {
  for (const listener of connectionListeners) {
    try {
      listener(connected)
    } catch (err) {
      console.error('[socket] connection listener error:', err)
    }
  }
}

/**
 * Subscribe to server connection status changes.
 * Returns an unsubscribe cleanup function.
 */
export function subscribeServerConnection(callback) {
  connectionListeners.add(callback)
  // Immediately dispatch current connection status
  try {
    callback(isServerConnected())
  } catch (err) {
    console.error('[socket] initial connection listener error:', err)
  }
  return () => {
    connectionListeners.delete(callback)
  }
}

/**
 * Returns a Promise that resolves when the server connection is established,
 * or resolves false if the timeout is reached.
 */
export function waitForServerConnection(timeoutMs = 15000) {
  if (isServerConnected()) {
    return Promise.resolve(true)
  }

  pingServerHealth()
  const sock = connectSocket()
  if (sock && !sock.connected) {
    sock.connect()
  }

  return new Promise((resolve) => {
    let settled = false
    let cleanup = null

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        cleanup?.()
        resolve(isServerConnected())
      }
    }, timeoutMs)

    cleanup = subscribeServerConnection((connected) => {
      if (connected && !settled) {
        settled = true
        clearTimeout(timer)
        cleanup?.()
        resolve(true)
      }
    })
  })
}

/**
 * Starts continuous background warming loop until connected.
 */
export function startServerWarming(sessionId) {
  if (typeof window === 'undefined') return
  pingServerHealth()
  const sock = connectSocket(sessionId)
  if (sock && !sock.connected) {
    sock.connect()
  }

  if (!warmingInterval) {
    warmingInterval = setInterval(() => {
      if (isServerConnected()) {
        clearInterval(warmingInterval)
        warmingInterval = null
        return
      }
      pingServerHealth()
      if (socket && !socket.connected) {
        socket.connect()
      }
    }, 2000)
  }
}

export function connectSocket(sessionId) {
  if (socket) {
    if (!socket.connected) {
      socket.connect()
    }
    return socket
  }

  const socketUrl = getServerUrl()

  socket = io(socketUrl, {
    // Attempt WebSocket first for instant zero-handshake connection, with polling fallback
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 3000,
    timeout: 20000,
    autoConnect: true,
    path: '/socket.io/',
  })

  socket.on('connect', () => {
    if (warmingInterval) {
      clearInterval(warmingInterval)
      warmingInterval = null
    }
    const { sessionId: storedId, resumeToken, roomId } = readIdentity()
    socket.emit('register', { sessionId: storedId || sessionId, resumeToken, roomId })
    notifyConnectionListeners(true)
  })

  socket.on('disconnect', () => {
    notifyConnectionListeners(false)
  })

  socket.on('connect_error', () => {
    notifyConnectionListeners(false)
  })

  if (!socket.connected) {
    socket.connect()
  }

  return socket
}

/**
 * Starts background server connection immediately.
 * Called as soon as the app mounts or script loads so the server connects immediately.
 */
export function initBackgroundServerConnection(sessionId) {
  startServerWarming(sessionId)
  return connectSocket(sessionId)
}

export function hasListenersAttached() {
  return listenersAttached
}

export function markListenersAttached() {
  listenersAttached = true
}

export function getSocket() {
  return socket
}

export function disconnectSocket() {
  if (warmingInterval) {
    clearInterval(warmingInterval)
    warmingInterval = null
  }
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
    listenersAttached = false
    notifyConnectionListeners(false)
  }
}

// Immediately warm and connect to server as soon as module is evaluated in the browser
if (typeof window !== 'undefined') {
  setTimeout(() => {
    try {
      const { sessionId } = readIdentity()
      initBackgroundServerConnection(sessionId)
    } catch {}
  }, 0)
}
