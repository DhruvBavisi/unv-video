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
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 20000,
    autoConnect: false,
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