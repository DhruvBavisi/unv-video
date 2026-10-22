import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'

import { sessionSockets, connectPlayer, ensureResumeToken } from './shared/sessionRegistry.js'
import { normalizeOrigin, isOriginAllowed } from './shared/utils.js'

import {
  setUndercoverIo,
  rooms,
  findRoomByPlayer,
  broadcastRoom,
  reassignHostIfNeeded,
  getPublicRoomState,
  syncPlayerPrivateState,
  scheduleRevengerTimeout,
  scheduleGoddessTimeout,
  disconnectPlayer,
  checkAndDestroyEmptyRoom
} from './games/undercover/undercoverState.js'
import { registerUndercoverHandlers } from './games/undercover/undercoverHandlers.js'

import {
  setSkribblIo,
  drawRooms,
  findDrawRoomByPlayer,
  broadcastDrawRoomState,
  reassignDrawHostIfNeeded,
  resumeDrawTimersIfDrawer,
  clearDrawRateLimits,
  disconnectDrawPlayer
} from './games/skribbl/skribblState.js'
import { registerSkribblHandlers } from './games/skribbl/skribblHandlers.js'

import {
  setCodenamesIo,
  codenamesRooms,
  findCodenamesRoomByPlayer,
  broadcastCodenamesRoomState,
  disconnectCodenamesPlayer
} from './games/codenames/codenamesState.js'
import { registerCodenamesHandlers } from './games/codenames/codenamesHandlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '../.env.local')

if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8')
  envFile.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (match) {
      process.env[match[1]] = match[2]
    }
  })
}

const IS_DEV_BOTS_ENABLED = process.env.DEV_BOTS_ENABLED === 'true'

let devBotHelpers = {
  isEnabled: IS_DEV_BOTS_ENABLED,
  initBotManager: null,
  addBots: null,
  removeBots: null
}

if (IS_DEV_BOTS_ENABLED) {
  import('./games/undercover/dev/botManager.js').then(module => {
    devBotHelpers.initBotManager = module.initBotManager
    devBotHelpers.addBots = module.addBots
    devBotHelpers.removeBots = module.removeBots
    devBotHelpers.initBotManager(process.env.PORT || 3001)
  }).catch(err => {
    console.error('Failed to load bot manager:', err)
  })
}

const originList = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => normalizeOrigin(s))
  .filter(Boolean)

if (process.env.NODE_ENV === 'production' && originList.join(',') === 'http://localhost:5173') {
  console.error('[CONFIG] FRONTEND_ORIGIN must be set in production (comma-separated list supported). Exiting.')
  process.exit(1)
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin, originList)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked for origin: ${origin}`))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}

const app = express()

// Support Private Network Access (PNA) for Chrome/Chromium devices on local network
app.use((req, res, next) => {
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true')
  }
  next()
})

app.use(cors(corsOptions))

// Liveness probe for the host (Render healthCheckPath) and uptime checks.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: corsOptions,
})

if (io.engine) {
  io.engine.on('initial_headers', (headers, req) => {
    if (req?.headers?.['access-control-request-private-network']) {
      headers['Access-Control-Allow-Private-Network'] = 'true'
    }
  })
  io.engine.on('headers', (headers, req) => {
    if (req?.headers?.['access-control-request-private-network']) {
      headers['Access-Control-Allow-Private-Network'] = 'true'
    }
  })
}

// Bind io instances to game state modules
setUndercoverIo(io)
setSkribblIo(io)
setCodenamesIo(io)

// Cross-game context utilities
const sharedContext = {
  devBots: devBotHelpers,
  isRoomIdTaken(roomId) {
    return rooms.has(roomId) || drawRooms.has(roomId) || codenamesRooms.has(roomId)
  },
  isPlayerInOtherRooms(sessionId, excludeGame) {
    if (excludeGame !== 'undercover' && Array.from(rooms.values()).some(r => r.players.some(p => p.id === sessionId))) {
      return true
    }
    if (excludeGame !== 'skribbl' && Array.from(drawRooms.values()).some(r => r.players.some(p => p.id === sessionId))) {
      return true
    }
    if (excludeGame !== 'codenames' && Array.from(codenamesRooms.values()).some(r => r.players.some(p => p.id === sessionId))) {
      return true
    }
    return false
  }
}

// How long a room whose players are all disconnected is kept before reap.
const DISCONNECT_GRACE_MS = 5 * 60 * 1000

function reapAbandonedRooms() {
  const now = Date.now()

  // Undercover reap
  for (const [roomId, room] of rooms) {
    if (room.players.length === 0) {
      rooms.delete(roomId)
      continue
    }
    if (checkAndDestroyEmptyRoom(roomId, room)) continue
  }

  // Skribbl reap
  for (const [roomId, room] of drawRooms) {
    if (room.players.length === 0) {
      if (room.turnTimeout) clearTimeout(room.turnTimeout)
      if (room.wordChoiceTimeout) clearTimeout(room.wordChoiceTimeout)
      if (room.hintTimer) clearInterval(room.hintTimer)
      room.turnTimeout = null
      room.wordChoiceTimeout = null
      room.hintTimer = null
      drawRooms.delete(roomId)
      continue
    }
    const realPlayers = room.players.filter(p => !p.isBot)
    if (realPlayers.length === 0) {
      console.log('[ROOM] destroying empty draw room (no real players)', { roomId })
      if (room.turnTimeout) clearTimeout(room.turnTimeout)
      if (room.wordChoiceTimeout) clearTimeout(room.wordChoiceTimeout)
      if (room.hintTimer) clearInterval(room.hintTimer)
      room.turnTimeout = null
      room.wordChoiceTimeout = null
      room.hintTimer = null
      room.players.forEach(p => clearDrawRateLimits(p.id))
      drawRooms.delete(roomId)
      io.to(`draw:${roomId}`).emit('room-closed', { message: 'Room closed — all players left.' })
      continue
    }

    const allDisconnected = realPlayers.every((p) => !p.isConnected && p.disconnectedAt)
    if (allDisconnected) {
      const longestOffline = Math.max(...realPlayers.map(p => now - p.disconnectedAt))
      if (longestOffline > DISCONNECT_GRACE_MS) {
        console.log('[ROOM] destroying abandoned draw room', { roomId, longestOffline })
        if (room.turnTimeout) clearTimeout(room.turnTimeout)
        if (room.wordChoiceTimeout) clearTimeout(room.wordChoiceTimeout)
        if (room.hintTimer) clearInterval(room.hintTimer)
        room.turnTimeout = null
        room.wordChoiceTimeout = null
        room.hintTimer = null
        room.players.forEach(p => clearDrawRateLimits(p.id))
        drawRooms.delete(roomId)
        io.to(`draw:${roomId}`).emit('room-closed', { message: 'Room closed — all players disconnected.' })
        continue
      }
    }
  }

  // Codenames reap
  for (const [roomId, room] of codenamesRooms) {
    if (room.players.length === 0) {
      codenamesRooms.delete(roomId)
      continue
    }
    const realPlayers = room.players.filter(p => !p.isBot)
    if (realPlayers.length === 0) {
      console.log('[ROOM] destroying empty codenames room (no real players)', { roomId })
      codenamesRooms.delete(roomId)
      io.to(`codenames:${roomId}`).emit('room-closed', { message: 'Room closed — all players left.' })
      continue
    }

    const allDisconnected = realPlayers.every((p) => p.disconnectedAt)
    if (allDisconnected) {
      const longestOffline = Math.max(...realPlayers.map(p => Date.now() - p.disconnectedAt))
      if (longestOffline > DISCONNECT_GRACE_MS) {
        console.log('[ROOM] destroying abandoned codenames room', { roomId, longestOffline })
        codenamesRooms.delete(roomId)
      }
    }
  }

  // Clean stale session-socket entries
  for (const [sessionId] of sessionSockets) {
    if (!findRoomByPlayer(sessionId).room && !findDrawRoomByPlayer(sessionId).room && !findCodenamesRoomByPlayer(sessionId).room) {
      sessionSockets.delete(sessionId)
    }
  }
}

setInterval(reapAbandonedRooms, 60 * 1000)

io.on('connection', (socket) => {
  const socketState = {
    currentSessionId: null,
    currentRoomId: null
  }

  socket.on('register', ({ sessionId, resumeToken, roomId: clientRoomId }) => {
    if (!sessionId || typeof sessionId !== 'string') return
    socketState.currentSessionId = sessionId

    // If client provided neither a roomId nor a resumeToken, this is simply a socket registration,
    // not a session restoration attempt. Do not emit session-no-room.
    if (!clientRoomId && !resumeToken) {
      connectPlayer(socket, sessionId, io)
      return
    }

    let roomId = null
    let room = null
    let isDrawRoom = false
    let isCodenamesRoom = false

    // Target the specific room first if clientRoomId was provided
    if (clientRoomId) {
      const normalizedClientRoomId = (clientRoomId || '').trim().toUpperCase()
      if (drawRooms.has(normalizedClientRoomId)) {
        const dr = drawRooms.get(normalizedClientRoomId)
        if (dr.players.some(p => p.id === sessionId)) {
          roomId = normalizedClientRoomId
          room = dr
          isDrawRoom = true
        }
      } else if (codenamesRooms.has(normalizedClientRoomId)) {
        const cr = codenamesRooms.get(normalizedClientRoomId)
        if (cr.players.some(p => p.id === sessionId)) {
          roomId = normalizedClientRoomId
          room = cr
          isCodenamesRoom = true
        }
      } else if (rooms.has(normalizedClientRoomId)) {
        const ur = rooms.get(normalizedClientRoomId)
        if (ur.players.some(p => p.id === sessionId)) {
          roomId = normalizedClientRoomId
          room = ur
        }
      }
    }

    // Fallback search across active rooms if not resolved by clientRoomId
    if (!room) {
      const undercoverResult = findRoomByPlayer(sessionId)
      if (undercoverResult.room) {
        roomId = undercoverResult.roomId
        room = undercoverResult.room
      } else {
        const drawResult = findDrawRoomByPlayer(sessionId)
        if (drawResult.room) {
          roomId = drawResult.roomId
          room = drawResult.room
          isDrawRoom = true
        } else {
          const codenamesResult = findCodenamesRoomByPlayer(sessionId)
          if (codenamesResult.room) {
            roomId = codenamesResult.roomId
            room = codenamesResult.room
            isCodenamesRoom = true
          } else {
            socket.emit('session-no-room')
            return
          }
        }
      }
    }

    if (clientRoomId && (clientRoomId || '').trim().toUpperCase() !== (roomId || '').trim().toUpperCase()) {
      console.warn('[AUTH] register rejected - room mismatch', { sessionId, clientRoomId, roomId })
      socket.emit('session-no-room')
      return
    }

    const player = room.players.find((p) => p.id === sessionId)
    if (player && !player.resumeToken && !resumeToken) {
      ensureResumeToken(player)
    }

    // The only way to attach to an existing player identity is with its
    // private resume token. Without it we never disconnect another live
    // socket and never reveal secrets — the session is simply rejected.
    const tokenOk = player?.resumeToken && typeof resumeToken === 'string' && resumeToken === player.resumeToken
    if (!tokenOk) {
      console.warn('[AUTH] register rejected without matching resume token', { sessionId })
      socket.emit('session-expired')
      return
    }

    socketState.currentRoomId = roomId
    connectPlayer(socket, sessionId, io)

    if (isDrawRoom) {
      socket.join(`draw:${roomId}`)
      socket.join(sessionId) // Join private room for Skribbl direct messaging
    } else if (isCodenamesRoom) {
      socket.join(`codenames:${roomId}`)
    } else {
      socket.join(roomId)
    }

    player.isConnected = true
    player.disconnectedAt = null

    if (isDrawRoom) {
      reassignDrawHostIfNeeded(room)
      socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'skribbl' })
      console.log('[ROOM] draw session reconnected', { sessionId, roomId })
      resumeDrawTimersIfDrawer(room, sessionId)
      broadcastDrawRoomState(room)
      return
    }

    if (isCodenamesRoom) {
      socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'codenames' })
      console.log('[ROOM] codenames session reconnected', { sessionId, roomId })
      broadcastCodenamesRoomState(room)
      return
    }

    reassignHostIfNeeded(room)
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'undercover' })
    console.log('[ROOM] session reconnected', { sessionId, roomId })
    socket.emit('session-reconnected', getPublicRoomState(room))

    if (room.wordPair) {
      syncPlayerPrivateState(room, player, socket)
    }

    // Resume special role timers
    if (room.gamePhase === 'REVENGER_DECISION' && room.revengerId === sessionId && room.revengerDecisionRemainingMs !== undefined) {
      room.revengerDecisionEndsAt = Date.now() + room.revengerDecisionRemainingMs
      scheduleRevengerTimeout(room.id, sessionId, room.revengerDecisionRemainingMs)
      room.revengerDecisionRemainingMs = undefined
    } else if (room.gamePhase === 'GODDESS_DECISION' && room.goddessId === sessionId && room.goddessDecisionRemainingMs !== undefined) {
      room.goddessDecisionEndsAt = Date.now() + room.goddessDecisionRemainingMs
      scheduleGoddessTimeout(room.id, sessionId, room.goddessDecisionRemainingMs)
      room.goddessDecisionRemainingMs = undefined
    }

    broadcastRoom(room)
  })

  socket.on('disconnect', () => {
    if (!socketState.currentSessionId) return
    disconnectPlayer(socketState.currentSessionId, socket.id)
    disconnectDrawPlayer(socketState.currentSessionId, socket.id)
    disconnectCodenamesPlayer(socketState.currentSessionId, socket.id)
  })

  // Register game-specific handlers
  registerUndercoverHandlers(io, socket, socketState, sharedContext)
  registerSkribblHandlers(io, socket, socketState, sharedContext)
  registerCodenamesHandlers(io, socket, socketState, sharedContext)
})

const PORT = Number(process.env.PORT) || 3001
const HOST = '0.0.0.0'

httpServer.on('error', (error) => {
  console.error('[SERVER] HTTP server error:', error)
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error('[SERVER] uncaughtException', err?.stack || err)
})

process.on('unhandledRejection', (reason) => {
  console.error('[SERVER] unhandledRejection', reason?.stack || reason)
})

const shutdown = (signal) => {
  console.log(`[SERVER] ${signal} received; shutting down gracefully`)
  httpServer.close(() => {
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10000).unref()
}

process.once('SIGTERM', () => shutdown('SIGTERM'))
process.once('SIGINT', () => shutdown('SIGINT'))

httpServer.listen(PORT, HOST, () => {
  console.log(`UNDERCOVER server running on port ${PORT} (${HOST})`)
  console.log(`CORS allowed: Local network, private IPs, and ${process.env.NODE_ENV === 'production' ? originList.join(', ') : 'all development origins'}`)
})
