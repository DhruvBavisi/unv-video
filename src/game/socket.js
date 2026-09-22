import { io } from 'socket.io-client'
import { readIdentity } from './identity.js'

let socket = null
let listenersAttached = false

export function connectSocket(sessionId) {
  if (socket) return socket

  const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin

  socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    autoConnect: true,
  })

  socket.on('connect', () => {
    const { sessionId: storedId, resumeToken } = readIdentity()
    socket.emit('register', { sessionId: storedId || sessionId, resumeToken })
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