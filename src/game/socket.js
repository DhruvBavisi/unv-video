import { io } from 'socket.io-client'
import { readIdentity } from './identity.js'

let socket = null
let listenersAttached = false

export function connectSocket(sessionId) {
  if (socket) return socket

  const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.SOCKET_URL
  const socketUrl = (
    configuredSocketUrl ||
    (import.meta.env.PROD ? 'https://undercover-server.onrender.com' : window.location.origin)
  ).trim()

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
  })

  return socket
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
  }
}