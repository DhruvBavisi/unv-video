import { io } from 'socket.io-client'
import { readIdentity } from '../session/identity.js'

let socket = null
let listenersAttached = false
const connectionListeners = new Set()

export function getServerUrl() {
  const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.SOCKET_URL
  return (
    configuredSocketUrl ||
    (import.meta.env.PROD ? 'https://undercover-server.onrender.com' : window.location.origin)
  ).trim()
}

/**
 * Pings the server HTTP health endpoint to wake up cold sleeping instances (e.g. Render free tier)
 * immediately in parallel with Socket.io connection.
 */
export function pingServerHealth() {
  if (typeof window === 'undefined') return
  try {
    const healthUrl = `${getServerUrl()}/health`
    fetch(healthUrl, { mode: 'cors', cache: 'no-store' }).catch(() => {})
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

export function connectSocket(sessionId) {
  if (socket) {
    if (!socket.connected && !socket.active) {
      socket.connect()
    }
    return socket
  }

  const socketUrl = getServerUrl()

  socket = io(socketUrl, {
    // Establish reliably through Render's HTTP transport, then upgrade to WebSocket.
    transports: ['polling', 'websocket'],
    tryAllTransports: true,
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
    autoConnect: false,
    path: '/socket.io/',
  })

  socket.on('connect', () => {
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
 * Called as soon as the app mounts so the server wakes up behind the scenes.
 */
export function initBackgroundServerConnection(sessionId) {
  pingServerHealth()
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
  if (socket) {
    socket.removeAllListeners()
    socket.disconnect()
    socket = null
    listenersAttached = false
    notifyConnectionListeners(false)
  }
}
