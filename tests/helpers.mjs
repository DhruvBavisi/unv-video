import { io } from 'socket.io-client'

export const URL = process.env.TEST_URL || 'http://localhost:3005'

export function makeClient(name) {
  const socket = io(URL, { transports: ['websocket'], reconnection: false })
  const sessionId = `test-${name}-${Math.random().toString(36).slice(2, 10)}`
  const client = { socket, name, sessionId, secret: null, roomState: null, roomId: null }
  
  socket.on('role-assigned', (payload) => { client.secret = payload })
  socket.on('room-state', (state) => { client.roomState = state })
  
  return client
}

export function emitAck(socket, event, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for acknowledgement on event: ${event}`))
    }, timeoutMs)
    socket.emit(event, payload, (response) => {
      clearTimeout(timer)
      resolve(response)
    })
  })
}

export function waitForEvent(socket, event, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, listener)
      reject(new Error(`Timeout waiting for event ${event}`))
    }, timeout)
    const listener = (payload) => {
      clearTimeout(timer)
      resolve(payload)
    }
    socket.once(event, listener)
  })
}

export function waitForRoomState(client, predicate, timeout = 2000) {
  return new Promise((resolve, reject) => {
    if (predicate(client.roomState)) return resolve(client.roomState)
    const timer = setTimeout(() => {
      client.socket.off('room-state', listener)
      reject(new Error(`Timeout waiting for room state predicate: ${predicate.toString()}`))
    }, timeout)
    const listener = (state) => {
      if (predicate(state)) {
        clearTimeout(timer)
        client.socket.off('room-state', listener)
        resolve(state)
      }
    }
    client.socket.on('room-state', listener)
  })
}

export async function connectClients(clients) {
  await Promise.all(clients.map(cl => new Promise((res, rej) => {
    cl.socket.on('connect', res)
    cl.socket.on('connect_error', rej)
  })))
}

export function disconnectClients(clients) {
  clients.forEach(c => c.socket.disconnect())
}
