import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { MAX_CLUE_LENGTH, MAX_CHAT_LENGTH } from '../shared/game-limits.js'

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

let initBotManager, addBots, removeBots
if (IS_DEV_BOTS_ENABLED) {
  import('./dev/botManager.js').then(module => {
    initBotManager = module.initBotManager
    addBots = module.addBots
    removeBots = module.removeBots
    initBotManager(process.env.PORT || 3001)
  }).catch(err => {
    console.error('Failed to load bot manager:', err)
  })
}

const app = express()
app.use(cors())

const httpServer = createServer(app)

const originList = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const allowedOrigin = originList.length === 1 ? originList[0] : originList

if (process.env.NODE_ENV === 'production' && originList.join(',') === 'http://localhost:5173') {
  console.error('[CONFIG] FRONTEND_ORIGIN must be set in production (comma-separated list supported). Exiting.')
  process.exit(1)
}

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

const rooms = new Map()
const sessionSockets = new Map()

// How long a room whose players are all disconnected is kept before reap.
const RECONNECT_GRACE_MS = 5 * 60 * 1000

const WORD_PAIRS = {
  places: [{ civilianWord: 'Ocean', undercoverWord: 'Swimming Pool' }],
  objects: [{ civilianWord: 'Camera', undercoverWord: 'Binoculars' }],
  'open-file': [{ civilianWord: 'Ocean', undercoverWord: 'Swimming Pool' }],
}

let clueIdCounter = 0
let chatIdCounter = 0

function makeRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let id = ''
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)]
  return id
}

function validateConfig(config, room) {
  const totalPlayers = config.totalPlayers ?? room.configuration.totalPlayers
  const undercover = config.undercover ?? room.configuration.undercover
  const mrWhite = config.mrWhite ?? room.configuration.mrWhite
  if (typeof totalPlayers !== 'number' || totalPlayers < 3 || totalPlayers > 20) return false
  if (typeof undercover !== 'number' || undercover < 1) return false
  if (typeof mrWhite !== 'number' || mrWhite < 0) return false
  if (undercover + mrWhite > Math.floor(totalPlayers / 2)) return false
  const civilianCount = totalPlayers - undercover - mrWhite
  if (civilianCount < Math.ceil(totalPlayers / 2)) return false
  return civilianCount + undercover + mrWhite === totalPlayers
}

function getDefaultConfig(totalPlayers) {
  const defaults = {
    3: { undercover: 1, mrWhite: 0 }, 4: { undercover: 1, mrWhite: 0 },
    5: { undercover: 1, mrWhite: 1 }, 6: { undercover: 1, mrWhite: 1 },
    7: { undercover: 2, mrWhite: 1 }, 8: { undercover: 2, mrWhite: 1 },
    9: { undercover: 3, mrWhite: 1 }, 10: { undercover: 3, mrWhite: 1 },
    11: { undercover: 3, mrWhite: 2 }, 12: { undercover: 3, mrWhite: 2 },
    13: { undercover: 4, mrWhite: 2 }, 14: { undercover: 4, mrWhite: 2 },
    15: { undercover: 5, mrWhite: 2 }, 16: { undercover: 5, mrWhite: 2 },
    17: { undercover: 5, mrWhite: 3 }, 18: { undercover: 5, mrWhite: 3 },
    19: { undercover: 6, mrWhite: 3 }, 20: { undercover: 4, mrWhite: 3 },
  }
  const def = defaults[totalPlayers]
  if (!def) return { totalPlayers, undercover: 1, mrWhite: 0 }
  return { totalPlayers, undercover: def.undercover, mrWhite: def.mrWhite }
}

function getPublicRoomState(room) {
  return {
    roomId: room.id,
    hostId: room.hostId,
    status: room.status,
    round: room.round,
    phase: room.phase,
    gamePhase: room.gamePhase,
    currentTurnPlayerId: room.currentTurnPlayerId || null,
    turnOrder: room.turnOrder || [],
    submittedCluePlayerIds: room.submittedCluePlayerIds || [],
    votes: room.votes || {},
    lockedVotes: room.lockedVotes || [],
    votingAttempt: room.votingAttempt || 1,
    voteResult: room.voteResult || null,
    eliminationResult: room.eliminationResult || null,
    mrWhiteGuesserId: room.mrWhiteGuesserId || null,
    mrWhiteLiveGuess: room.mrWhiteLiveGuess || '',
    winner: room.winner || null,
    clues: (room.clues || []).map((c) => ({
      id: c.id,
      roundNumber: c.roundNumber,
      playerId: c.playerId,
      playerName: c.playerName,
      text: c.text,
      submittedAt: c.submittedAt,
      turnIndex: c.turnIndex,
    })),
    chat: (room.chat || []).map((m) => ({
      id: m.id,
      playerId: m.playerId,
      playerName: m.playerName,
      text: m.text,
      sentAt: m.sentAt,
    })),
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isConnected: p.isConnected,
      status: p.status,
      eliminated: p.eliminated,
      spectator: p.spectator,
      role: p.eliminated ? p.role : undefined,
      playAgain: !!p.playAgain,
      continueAck: !!p.continueAck,
    })),
    configuration: { ...room.configuration },
    category: room.category,
  }
}

function findRoomByPlayer(sessionId) {
  for (const [roomId, room] of rooms) {
    if (room.players.some((p) => p.id === sessionId)) {
      return { roomId, room }
    }
  }
  return { roomId: null, room: null }
}

function broadcastRoom(room) {
  io.to(room.id).emit('room-state', getPublicRoomState(room))
}

function connectPlayer(socket, sessionId) {
  const oldSocketId = sessionSockets.get(sessionId)
  if (oldSocketId && oldSocketId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(oldSocketId)
    if (oldSocket) {
      oldSocket.disconnect(true)
    }
  }
  sessionSockets.set(sessionId, socket.id)
}

function disconnectPlayer(sessionId) {
  const { roomId, room } = findRoomByPlayer(sessionId)
  if (!room) return { roomId: null, room: null }

  const player = room.players.find((p) => p.id === sessionId)
  if (player) {
    player.isConnected = false
    player.disconnectedAt = Date.now()
  }

  // Check if the room should be destroyed because only bots remain connected
  // (all real players have disconnected / left)
  const realPlayers = room.players.filter(p => !p.isBot)
  const allRealDisconnected = realPlayers.length > 0 && realPlayers.every(p => !p.isConnected)
  if (realPlayers.length === 0 || allRealDisconnected) {
    // If zero real players, destroy immediately
    if (realPlayers.length === 0) {
      checkAndDestroyEmptyRoom(roomId, room)
      return { roomId: null, room: null }
    }
    // If real players exist but all disconnected, let reapAbandonedRooms handle
    // the grace period — just broadcast the updated state for now
  }

  if (room.players.some((p) => p.isConnected)) {
    reassignHostIfNeeded(room)
  }
  broadcastRoom(room)
  return { roomId, room }
}

// A player's private reconnect credential.  Generated once per player;
// re-registering a session WITHOUT it is rejected (see register).
function ensureResumeToken(player) {
  if (player.resumeToken) return player.resumeToken
  player.resumeToken = crypto.randomUUID()
  return player.resumeToken
}

function removePlayer(sessionId) {
  const { roomId, room } = findRoomByPlayer(sessionId)
  if (!room) return { roomId: null, room: null }

  const idx = room.players.findIndex((p) => p.id === sessionId)
  if (idx === -1) return { roomId: null, room: null }

  const wasHost = room.players[idx].isHost
  room.players.splice(idx, 1)
  sessionSockets.delete(sessionId)

  // Check if room should be destroyed (no players at all, or only bots remain)
  if (checkAndDestroyEmptyRoom(roomId, room)) {
    return { roomId: null, room: null }
  }

  if (wasHost) {
    const nextHost = room.players.find(p => p.isConnected && !p.isBot) || room.players[0]
    if (nextHost) {
      nextHost.isHost = true
      room.hostId = nextHost.id
    }
  }
  return { roomId, room }
}

// Destroy a room if it has zero real (non-bot) players.
// Returns true if the room was destroyed.
function checkAndDestroyEmptyRoom(roomId, room) {
  if (!room) return false
  const realPlayers = room.players.filter(p => !p.isBot)
  if (realPlayers.length === 0) {
    console.log('[ROOM] destroying empty room (no real players)', { roomId })
    rooms.delete(roomId)
    io.to(roomId).emit('room-closed', { message: 'Room closed — all players left.' })
    return true
  }
  return false
}

function getActivePlayers(room) {
  return room.players.filter((p) => !p.eliminated && !p.spectator && p.status === 'PLAYING')
}

function evaluateWinCondition(room) {
  const active = getActivePlayers(room)
  const undercovers = active.filter(p => p.role === 'UNDERCOVER').length
  const civilians = active.filter(p => p.role === 'CIVILIAN').length
  const mrWhites = active.filter(p => p.role === 'MR_WHITE').length

  const imposters = undercovers + mrWhites

  if ((civilians <= 1 && imposters > 0) || civilians < imposters) {
    room.gamePhase = 'RESULT'
    if (undercovers > 0 && mrWhites > 0) {
      room.winner = 'BOTH_IMPOSTERS'
    } else if (undercovers > 0) {
      room.winner = 'UNDERCOVER'
    } else {
      room.winner = 'MR_WHITE'
    }
    return true
  } else if (undercovers === 0 && mrWhites === 0) {
    room.gamePhase = 'RESULT'
    room.winner = 'CIVILIAN'
    return true
  }
  
  return false
}

function shuffle(array) {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function startCluePhase(room) {
  if (room.gamePhase === 'CLUE') return
  room.gamePhase = 'CLUE'
  room.submittedCluePlayerIds = []

  const active = getActivePlayers(room)
  room.turnOrder = shuffle(active.map((p) => p.id))
  room.currentTurnPlayerId = room.turnOrder.length > 0 ? room.turnOrder[0] : null
  room.turnIndex = 0

  console.log('[CLUE] phase started', {
    roomId: room.id,
    round: room.round,
    turnOrder: room.turnOrder,
    firstPlayer: room.currentTurnPlayerId,
  })

  broadcastRoom(room)
}

function startVotePhase(room) {
  room.currentTurnPlayerId = null
  room.gamePhase = 'VOTE'
  room.votes = {}
  room.lockedVotes = []
  room.voteResult = null
  room.votingAttempt = 1
  console.log('[VOTE] phase started', { roomId: room.id })
}

function advanceTurn(room) {
  room.turnIndex++
  if (room.turnIndex < room.turnOrder.length) {
    room.currentTurnPlayerId = room.turnOrder[room.turnIndex]
    console.log('[CLUE] turn advanced', {
      roomId: room.id,
      turnIndex: room.turnIndex,
      currentTurnPlayerId: room.currentTurnPlayerId,
    })
  } else {
    startVotePhase(room)
  }
  broadcastRoom(room)
}

function assignWords(room) {
  const category = room.category || 'open-file'
  const pairs = WORD_PAIRS[category]
  if (!pairs || pairs.length === 0) return

  const pairIndex = Math.floor(Math.random() * pairs.length)
  const pair = pairs[pairIndex]

  room.wordPair = { ...pair, category }
}

// Single source of truth for a player's secret word by role.
function wordForRole(role, wordPair) {
  if (!wordPair) return null
  return role === 'MR_WHITE' ? null : (role === 'UNDERCOVER' ? wordPair.undercoverWord : wordPair.civilianWord)
}

// After a roster change, make sure the host slot points at a live player.
function reassignHostIfNeeded(room) {
  const host = room.players.find((p) => p.id === room.hostId)
  if (host && host.isConnected) return

  const next = room.players.find((p) => p.isConnected)
  if (!next) return
  if (host) host.isHost = false
  if (next) {
    next.isHost = true
    room.hostId = next.id
  }
}


// Rooms where every player has been disconnected past the grace window,
// plus stale session-socket mappings, are removed so abandoned games do
// not accumulate on the server.
function reapAbandonedRooms() {
  const now = Date.now()
  for (const [roomId, room] of rooms) {
    if (room.players.length === 0) {
      rooms.delete(roomId)
      continue
    }
    // Destroy rooms with only bots remaining
    if (checkAndDestroyEmptyRoom(roomId, room)) continue
    // Destroy rooms where all players have been disconnected past the grace window
    if (room.players.some((p) => p.isConnected)) continue
    const allStale = room.players.every((p) => (p.disconnectedAt || 0) > 0 && now - p.disconnectedAt >= RECONNECT_GRACE_MS)
    if (!allStale) continue
    console.log('[ROOM] reaping abandoned room', { roomId })
    rooms.delete(roomId)
    io.to(roomId).emit('room-closed', { message: 'Room closed — all players disconnected.' })
  }

  for (const [sessionId] of sessionSockets) {
    if (!findRoomByPlayer(sessionId).room) sessionSockets.delete(sessionId)
  }
}
setInterval(reapAbandonedRooms, 60 * 1000)

io.on('connection', (socket) => {
  let currentSessionId = null
  let currentRoomId = null

  socket.on('register', ({ sessionId, resumeToken, roomId: clientRoomId }) => {
    if (!sessionId || typeof sessionId !== 'string') return
    currentSessionId = sessionId

    const { roomId, room } = findRoomByPlayer(sessionId)
    if (!room) {
      socket.emit('session-no-room')
      return
    }

    if (clientRoomId && clientRoomId !== roomId) {
      console.warn('[AUTH] register rejected - room mismatch', { sessionId, clientRoomId, roomId })
      socket.emit('session-no-room')
      return
    }

    const player = room.players.find((p) => p.id === sessionId)
    if (player && !player.resumeToken && !resumeToken) {
      ensureResumeToken(player)
    }

    // The only way to attach to an existing player identity is with its
    // private resume token.  Without it we never disconnect another live
    // socket and never reveal secrets — the session is simply rejected.
    const tokenOk = player?.resumeToken && typeof resumeToken === 'string' && resumeToken === player.resumeToken
    if (!tokenOk) {
      console.warn('[AUTH] register rejected without matching resume token', { sessionId })
      socket.emit('session-expired')
      return
    }

    currentRoomId = roomId
    connectPlayer(socket, sessionId)
    socket.join(roomId)
    player.isConnected = true
    player.disconnectedAt = null
    reassignHostIfNeeded(room)
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId })
    console.log('[ROOM] session reconnected', { sessionId, roomId })
    socket.emit('session-reconnected', getPublicRoomState(room))

    if (room.wordPair) {
      const role = player?.role || null
      const word = wordForRole(role, room.wordPair)
      const roleToReveal = (room.configuration.revealRoles || role === 'MR_WHITE') ? role : null
      socket.emit('role-assigned', { role: roleToReveal, word })
    }

    broadcastRoom(room)
  })

  socket.on('create-room', ({ sessionId, playerName }, callback) => {
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    if (!/^[\p{L}\p{N} .'-]{2,24}$/u.test(trimmed)) {
      return callback?.({ error: 'INVALID_NAME_FORMAT' })
    }

    const existing = findRoomByPlayer(sessionId)
    if (existing.room) {
      return callback?.({ error: 'ALREADY_IN_ROOM' })
    }

    let roomId = makeRoomId()
    while (rooms.has(roomId)) roomId = makeRoomId()

    const config = getDefaultConfig(5)
    const room = {
      id: roomId,
      hostId: sessionId,
      status: 'LOBBY',
      round: 1,
      phase: 'LOBBY',
      gamePhase: null,
      currentTurnPlayerId: null,
      turnOrder: [],
      turnIndex: 0,
      submittedCluePlayerIds: [],
      clues: [],
      chat: [],
      votes: {},
      lockedVotes: [],
      voteResult: null,
      wordPair: null,
      players: [{
        id: sessionId,
        name: trimmed,
        isHost: true,
        isConnected: true,
        status: 'READY',
        role: null,
        word: null,
        eliminated: false,
        spectator: false,
        resumeToken: crypto.randomUUID(),
      }],
      configuration: {
        totalPlayers: config.totalPlayers,
        undercover: config.undercover,
        mrWhite: config.mrWhite,
        civilians: config.totalPlayers - config.undercover - config.mrWhite,
        revealRoles: false,
      },
      category: 'open-file',
    }

    rooms.set(roomId, room)
    currentSessionId = sessionId
    currentRoomId = roomId
    socket.join(roomId)
    connectPlayer(socket, sessionId)
    callback?.({ room: getPublicRoomState(room), resumeToken: room.players[0].resumeToken })
  })

  socket.on('join-room', ({ sessionId, roomId, playerName, isBot }, callback) => {
    console.log('[ROOM] JOIN_ROOM received', { socketId: socket.id, roomId, playerId: sessionId })
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    if (!/^[\p{L}\p{N} .'-]{2,24}$/u.test(trimmed)) {
      return callback?.({ error: 'INVALID_NAME_FORMAT' })
    }
    if (!roomId || typeof roomId !== 'string') {
      return callback?.({ error: 'INVALID_ROOM_ID' })
    }
    const normalizedId = roomId.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(normalizedId)) {
      return callback?.({ error: 'INVALID_ROOM_ID_FORMAT' })
    }

    const room = rooms.get(normalizedId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })

    const existing = room.players.find((p) => p.id === sessionId)
    if (existing) {
      existing.isConnected = true
      existing.disconnectedAt = null
      existing.name = trimmed
      currentSessionId = sessionId
      currentRoomId = normalizedId
      socket.join(normalizedId)
      connectPlayer(socket, sessionId)
      ensureResumeToken(existing)
      const publicState = getPublicRoomState(room)
      console.log('[ROOM] join successful (rejoin)', { roomId: normalizedId, playerId: sessionId })
      socket.emit('session-token', { resumeToken: existing.resumeToken, roomId: normalizedId })

      if (room.wordPair) {
        const role = existing.role || null
        const word = wordForRole(role, room.wordPair)
        const roleToReveal = (room.configuration.revealRoles || role === 'MR_WHITE') ? role : null
        socket.emit('role-assigned', { role: roleToReveal, word })
      }

      callback?.({ room: publicState, resumeToken: existing.resumeToken })
      broadcastRoom(room)
      return
    }

    const isMidGame = room.status !== 'LOBBY'

    if (!isMidGame && room.players.length >= 20) {
      return callback?.({ error: 'ROOM_FULL' })
    }
    if (room.players.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return callback?.({ error: 'NAME_TAKEN' })
    }

    room.players.push({
      id: sessionId,
      name: trimmed,
      isHost: false,
      isConnected: true,
      status: isMidGame ? 'SPECTATING' : 'JOINED',
      role: null,
      word: null,
      eliminated: false,
      spectator: isMidGame,
      isBot: IS_DEV_BOTS_ENABLED ? !!isBot : false,
      resumeToken: crypto.randomUUID(),
    })

    currentSessionId = sessionId
    currentRoomId = normalizedId
    socket.join(normalizedId)
    connectPlayer(socket, sessionId)
    const publicState = getPublicRoomState(room)
    console.log('[ROOM] join successful', { roomId: normalizedId, playerId: sessionId })
    socket.emit('session-token', { resumeToken: room.players[room.players.length - 1].resumeToken, roomId: normalizedId })
    callback?.({ room: publicState, resumeToken: room.players[room.players.length - 1].resumeToken })
    if (room.status === 'LOBBY') {
      const newTotal = Math.max(3, room.players.length)
      const defConfig = getDefaultConfig(newTotal)
      room.configuration.totalPlayers = defConfig.totalPlayers
      room.configuration.undercover = defConfig.undercover
      room.configuration.mrWhite = defConfig.mrWhite
      room.configuration.civilians = newTotal - defConfig.undercover - defConfig.mrWhite
    }

    broadcastRoom(room)
  })

  socket.on('leave-room', (callback) => {
    if (!currentSessionId) {
      return callback?.({ error: 'NOT_IN_ROOM' })
    }

    const { roomId, room } = findRoomByPlayer(currentSessionId)
    if (!room) {
      currentRoomId = null
      return callback?.({ error: 'NOT_IN_ROOM' })
    }

    const removed = removePlayer(currentSessionId)
    currentRoomId = null

    socket.leave(roomId)

    if (removed.room) {
      if (removed.room.status === 'LOBBY') {
        const newTotal = Math.max(3, removed.room.players.length)
        const defConfig = getDefaultConfig(newTotal)
        removed.room.configuration.totalPlayers = defConfig.totalPlayers
        removed.room.configuration.undercover = defConfig.undercover
        removed.room.configuration.mrWhite = defConfig.mrWhite
        removed.room.configuration.civilians = newTotal - defConfig.undercover - defConfig.mrWhite
      }
      broadcastRoom(removed.room)
    }

    callback?.({ success: true })
    socket.emit('leave-confirmed')
  })

  socket.on('play-again', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'ACTIVE' || room.gamePhase !== 'RESULT') return callback?.({ success: false, error: 'GAME_NOT_ENDED' })

    const player = room.players.find(p => p.id === currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    
    const isFirstToPlayAgain = room.players.filter(p => p.playAgain).length === 0

    player.playAgain = true
    player.status = player.isHost ? 'READY' : 'JOINED'
    if (player.spectator) {
      player.spectator = false
    }

    if (isFirstToPlayAgain) {
      const newTotal = Math.max(3, room.players.length)
      const defConfig = getDefaultConfig(newTotal)
      room.configuration.totalPlayers = defConfig.totalPlayers
      room.configuration.undercover = defConfig.undercover
      room.configuration.mrWhite = defConfig.mrWhite
      room.configuration.civilians = newTotal - defConfig.undercover - defConfig.mrWhite
    }

    const requiredPlayers = room.players.filter(p => p.isConnected && !p.isBot)
    const allOptedIn = requiredPlayers.length > 0 && requiredPlayers.every(p => p.playAgain)

    if (allOptedIn) {
      room.status = 'LOBBY'
      room.phase = 'LOBBY'
      room.gamePhase = 'LOBBY'
      room.winner = null
      room.round = 1
      room.wordPair = null
      room.clues = []
      room.votes = {}
      room.lockedVotes = []
      room.voteResult = null
      room.eliminationResult = null
      room.mrWhiteGuesserId = null
      room.mrWhiteLiveGuess = ''
      room.pendingMrWhiteElimination = null
      room.chat = []
      room.turnOrder = []
      room.currentTurnPlayerId = null
      room.turnIndex = 0
      room.submittedCluePlayerIds = []

      room.players.forEach(p => {
        if (!p.playAgain) {
          p.status = p.isHost ? 'READY' : 'JOINED'
        }
        p.eliminated = false
        p.spectator = false
        p.role = null
        p.word = null
        p.playAgain = false
        p.continueAck = false
      })
    }

    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('toggle-ready', () => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    const player = room.players.find((p) => p.id === currentSessionId)
    if (!player || player.isHost) return
    player.status = player.status === 'READY' ? 'JOINED' : 'READY'
    broadcastRoom(room)
  })

  socket.on('update-config', (config) => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    if (room.hostId !== currentSessionId) return
    if (room.status !== 'LOBBY') return
    if (!validateConfig(config, room)) return
    room.configuration = {
      ...room.configuration,
      totalPlayers: config.totalPlayers ?? room.configuration.totalPlayers,
      undercover: config.undercover ?? room.configuration.undercover,
      mrWhite: config.mrWhite ?? room.configuration.mrWhite,
      civilians: config.totalPlayers !== undefined
        ? config.totalPlayers - (config.undercover ?? room.configuration.undercover) - (config.mrWhite ?? room.configuration.mrWhite)
        : room.configuration.civilians,
      revealRoles: config.revealRoles ?? room.configuration.revealRoles,
    }
    broadcastRoom(room)
  })

  socket.on('update-category', ({ category }) => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    if (room.hostId !== currentSessionId) return
    if (typeof category !== 'string') return
    room.category = category
    broadcastRoom(room)
  })

  socket.on('start-game', () => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    if (room.hostId !== currentSessionId) return
    if (room.players.length !== room.configuration.totalPlayers) return
    if (!room.players.every((p) => p.status === 'READY')) return

    room.status = 'ACTIVE'
    room.phase = 'ACTIVE'
    room.round = 1
    room.clues = []
    room.chat = []
    room.votes = {}
    room.lockedVotes = []
    room.voteResult = null

    assignWords(room)

    const { totalPlayers, undercover, mrWhite } = room.configuration
    const rolePool = []
    for (let i = 0; i < mrWhite; i++) rolePool.push('MR_WHITE')
    for (let i = 0; i < undercover; i++) rolePool.push('UNDERCOVER')
    for (let i = 0; i < totalPlayers - undercover - mrWhite; i++) rolePool.push('CIVILIAN')
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]]
    }

    room.players.forEach((p, i) => {
      p.role = rolePool[i]
      p.status = 'PLAYING'
      p.eliminated = false
      p.spectator = false

      const word = wordForRole(p.role, room.wordPair)

      const socketId = sessionSockets.get(p.id)
      if (socketId) {
        const roleToReveal = (room.configuration.revealRoles || p.role === 'MR_WHITE') ? p.role : null
        io.to(socketId).emit('role-assigned', { role: roleToReveal, word })
      }
    })

    startCluePhase(room)
  })

  socket.on('start-clue-phase', () => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    if (room.hostId !== currentSessionId) return
    if (room.status !== 'ACTIVE') return

    startCluePhase(room)
  })

  socket.on('submit-clue', ({ clue: rawClue }, callback) => {
    if (!currentSessionId || !currentRoomId) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    const room = rooms.get(currentRoomId)
    if (!room) {
      return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    }

    const player = room.players.find((p) => p.id === currentSessionId)
    if (!player) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    if (room.gamePhase !== 'CLUE') {
      return callback?.({ success: false, error: 'CLUE_PHASE_NOT_ACTIVE' })
    }

    if (room.currentTurnPlayerId !== currentSessionId) {
      return callback?.({ success: false, error: 'NOT_YOUR_TURN' })
    }

    if (room.submittedCluePlayerIds.includes(currentSessionId)) {
      return callback?.({ success: false, error: 'CLUE_ALREADY_SUBMITTED' })
    }

    if (player.eliminated || player.spectator) {
      return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    }

    const clue = String(rawClue || '').trim()

    if (!clue) {
      return callback?.({ success: false, error: 'EMPTY_CLUE' })
    }

    if (clue.length > MAX_CLUE_LENGTH) {
      return callback?.({ success: false, error: 'CLUE_TOO_LONG' })
    }

    clueIdCounter++
    const clueRecord = {
      id: `clue-${clueIdCounter}`,
      roundNumber: room.round,
      playerId: currentSessionId,
      playerName: player.name,
      text: clue,
      submittedAt: Date.now(),
      turnIndex: room.turnIndex,
    }

    room.clues.push(clueRecord)
    room.submittedCluePlayerIds.push(currentSessionId)

    console.log('[CLUE] submitted', {
      roomId: room.id,
      playerId: currentSessionId,
      playerName: player.name,
      clue: clue,
      turnIndex: room.turnIndex,
    })

    callback?.({ success: true })

    advanceTurn(room)
  })

  socket.on('send-chat-message', ({ text: rawText }, callback) => {
    if (!currentSessionId || !currentRoomId) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    const room = rooms.get(currentRoomId)
    if (!room) {
      return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    }

    const player = room.players.find((p) => p.id === currentSessionId)
    if (!player) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    if (room.status !== 'ACTIVE') {
      return callback?.({ success: false, error: 'GAME_NOT_ACTIVE' })
    }

    const text = String(rawText || '').trim()

    if (!text) {
      return callback?.({ success: false, error: 'EMPTY_MESSAGE' })
    }

    if (text.length > MAX_CHAT_LENGTH) {
      return callback?.({ success: false, error: 'MESSAGE_TOO_LONG' })
    }

    chatIdCounter++
    const message = {
      id: `msg-${chatIdCounter}`,
      playerId: currentSessionId,
      playerName: player.name,
      text,
      sentAt: Date.now(),
      roundNumber: room.round,
    }

    room.chat.push(message)

    if (room.chat.length > 200) {
      room.chat = room.chat.slice(-200)
    }

    console.log('[CHAT] message received', { roomId: room.id, playerName: player.name, text })

    callback?.({ success: true })

    io.to(currentRoomId).emit('chat-message', {
      id: message.id,
      playerId: message.playerId,
      playerName: message.playerName,
      text: message.text,
      sentAt: message.sentAt,
    })
  })

  socket.on('select-vote', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })
    
    const player = room.players.find((p) => p.id === currentSessionId)
    if (!player || player.eliminated || player.spectator) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    
    if (room.lockedVotes.includes(currentSessionId)) return callback?.({ success: false, error: 'VOTE_ALREADY_LOCKED' })

    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator) return callback?.({ success: false, error: 'INVALID_TARGET' })

    if (currentSessionId === targetId) return callback?.({ success: false, error: 'SELF_VOTING_NOT_ALLOWED' })

    room.votes[currentSessionId] = targetId
    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('lock-vote', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })
    
    const player = room.players.find((p) => p.id === currentSessionId)
    if (!player || player.eliminated || player.spectator) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    
    if (room.lockedVotes.includes(currentSessionId)) return callback?.({ success: false, error: 'VOTE_ALREADY_LOCKED' })
    if (!room.votes[currentSessionId]) return callback?.({ success: false, error: 'NO_VOTE_SELECTED' })

    room.lockedVotes.push(currentSessionId)
    
    const activePlayers = getActivePlayers(room)
    const votingComplete = room.lockedVotes.length === activePlayers.length
    
    console.log('[VOTING DEBUG]')
    console.log(`room=${room.id}`)
    console.log(`round=${room.round}`)
    console.log(`attempt=${room.votingAttempt || 1}`)
    console.log(`eligibleVoters=${activePlayers.length}`)
    console.log(`confirmedVoters=${room.lockedVotes.length}`)
    console.log(`remainingVoters=${activePlayers.length - room.lockedVotes.length}`)
    console.log(`votingComplete=${votingComplete}`)

    if (votingComplete) {
      console.log('resolving=true')
      // Resolve votes
      const voteCounts = {}
      for (const voterId of room.lockedVotes) {
        const targetId = room.votes[voterId]
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1
      }
      
      let maxVotes = 0
      let mostVoted = []
      
      for (const [targetId, count] of Object.entries(voteCounts)) {
        if (count > maxVotes) {
          maxVotes = count
          mostVoted = [targetId]
        } else if (count === maxVotes) {
          mostVoted.push(targetId)
        }
      }
      
      if (mostVoted.length === 1) {
        // Clear majority
        const eliminatedId = mostVoted[0]
        const eliminatedPlayer = room.players.find(p => p.id === eliminatedId)
        if (eliminatedPlayer) {
          eliminatedPlayer.eliminated = true
          eliminatedPlayer.spectator = true
          
          room.voteResult = { tie: false, eliminated: eliminatedId }
          room.gamePhase = 'ELIMINATION'
          room.eliminationResult = {
            playerId: eliminatedId,
            playerName: eliminatedPlayer.name,
            role: eliminatedPlayer.role,
            voteCount: maxVotes,
            startedAt: Date.now(),
          }
          
          console.log(`[ELIMINATION DEBUG]
VOTE RESOLVED
room=${room.id}
round=${room.round}
eliminatedPlayerId=${eliminatedId}
eliminatedPlayerName=${eliminatedPlayer.name}
role=${eliminatedPlayer.role}`)

          console.log(`[ELIMINATION DEBUG]
SERVER PHASE=${room.gamePhase}
ELIMINATION RESULT=`, room.eliminationResult)

          const activePlayersRemaining = getActivePlayers(room).length
          console.log('[ELIMINATION]', {
            roomId: room.id,
            player: eliminatedId,
            role: eliminatedPlayer.role,
            activePlayersRemaining,
          })

          broadcastRoom(room)
          
          const isMrWhite = eliminatedPlayer.role === 'MR_WHITE'
          const delay = isMrWhite ? 5000 : 6500
          
          setTimeout(() => {
            advanceFromElimination(room.id)
          }, delay)
        }
      } else {
        // Tie
        room.voteResult = { tie: true, tiedPlayers: mostVoted }
        room.votes = {}
        room.lockedVotes = []
        room.votingAttempt = (room.votingAttempt || 1) + 1
        // Remain in VOTE phase
      }
    }
    
    broadcastRoom(room)
    callback?.({ success: true })
  })

  // Mr White sends live typing updates while guessing
  socket.on('mr-white-live-guess', ({ text }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'MR_WHITE_GUESS') return callback?.({ success: false, error: 'NOT_MR_WHITE_GUESS_PHASE' })
    if (currentSessionId !== room.mrWhiteGuesserId) return callback?.({ success: false, error: 'NOT_MR_WHITE' })
    const player = room.players.find(p => p.id === currentSessionId)
    if (!player || player.role !== 'MR_WHITE') return callback?.({ success: false, error: 'INVALID_ROLE' })
    if (room.mrWhiteGuessSubmitted) return callback?.({ success: false, error: 'ALREADY_SUBMITTED' })
    const sanitized = String(text || '').slice(0, 40)
    room.mrWhiteLiveGuess = sanitized
    io.to(currentRoomId).emit('mr-white-live-guess-update', { text: sanitized })
    callback?.({ success: true })
  })

  socket.on('submit-mr-white-guess', ({ guess }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'MR_WHITE_GUESS') return callback?.({ success: false, error: 'NOT_MR_WHITE_GUESS_PHASE' })
    if (room.mrWhiteGuessSubmitted) return callback?.({ success: false, error: 'ALREADY_SUBMITTED' })
    
    if (currentSessionId !== room.mrWhiteGuesserId) return callback?.({ success: false, error: 'NOT_MR_WHITE' })
    
    const player = room.players.find(p => p.id === currentSessionId)
    if (!player || player.role !== 'MR_WHITE') return callback?.({ success: false, error: 'INVALID_ROLE' })

    const cleanGuess = String(guess || '').trim().toLowerCase()
    if (!cleanGuess) return callback?.({ success: false, error: 'EMPTY_GUESS' })
    const civilianWord = String(room.wordPair?.civilianWord || '').toLowerCase()
    
    room.mrWhiteGuessSubmitted = true
    room.mrWhiteLiveGuess = cleanGuess
    broadcastRoom(room)

    if (cleanGuess === civilianWord) {
      room.gamePhase = 'RESULT'
      room.winner = 'MR_WHITE'
      room.eliminationResult = null
      room.mrWhiteGuessSubmitted = false
      room.mrWhiteLiveGuess = ''
      broadcastRoom(room)
    } else {
      chatIdCounter++
      const systemMessage = {
        id: `msg-${chatIdCounter}`,
        playerId: 'system',
        playerName: 'System',
        text: "MR. WHITE'S GUESS WAS INCORRECT. The investigation continues.",
        sentAt: Date.now()
      }
      room.chat.push(systemMessage)
      io.to(currentRoomId).emit('chat-message', systemMessage)

      // Trigger Mr. White's exit animation on clients after wrong guess
      const pendingElim = room.pendingMrWhiteElimination || {
        playerId: player.id,
        playerName: player.name,
        role: player.role,
      }

      room.gamePhase = 'ELIMINATION'
      room.eliminationResult = {
        ...pendingElim,
        startedAt: Date.now(),
        isMrWhiteWrongGuessExit: true,
        submittedGuess: cleanGuess,
      }
      room.mrWhiteGuessSubmitted = false
      room.mrWhiteLiveGuess = ''
      
      broadcastRoom(room)

      setTimeout(() => {
        advanceAfterMrWhiteWrongGuess(room.id)
      }, 1800)
    }
    
    callback?.({ success: true })
  })

  function advanceAfterMrWhiteWrongGuess(roomId) {
    const room = rooms.get(roomId)
    if (!room) return
    room.eliminationResult = null
    room.pendingMrWhiteElimination = null

    if (!evaluateWinCondition(room)) {
      // Next round preparation
      room.round++
      room.gamePhase = 'CLUE'
      room.votes = {}
      room.lockedVotes = []
      room.voteResult = null
      
      const newActive = getActivePlayers(room)
      room.turnOrder = shuffle(newActive.map((p) => p.id))
      room.currentTurnPlayerId = room.turnOrder.length > 0 ? room.turnOrder[0] : null
      room.turnIndex = 0
      room.submittedCluePlayerIds = []
    }
    broadcastRoom(room)
  }

  // Auto-advances from ELIMINATION phase. Called via timeout.
  function advanceFromElimination(roomId) {
    const room = rooms.get(roomId)
    if (!room || room.gamePhase !== 'ELIMINATION') return
    
    const eliminatedId = room.eliminationResult?.playerId
    const eliminatedPlayer = room.players.find((p) => p.id === eliminatedId)
    if (!eliminatedPlayer) return
    
    if (eliminatedPlayer.role === 'MR_WHITE') {
      console.log('[ELIMINATION MR_WHITE_GUESS]', { roomId: room.id, player: eliminatedId })
      // Keep eliminationResult so clients render the guess UI inside the overlay
      room.eliminationResult = {
        ...room.eliminationResult,
        isMrWhiteGuessing: true,
      }
      room.pendingMrWhiteElimination = room.eliminationResult
      room.gamePhase = 'MR_WHITE_GUESS'
      room.mrWhiteGuesserId = eliminatedId
      room.mrWhiteLiveGuess = ''
      room.mrWhiteGuessSubmitted = false
      room.votes = {}
      room.lockedVotes = []
    } else {
      if (!evaluateWinCondition(room)) {
        const active = getActivePlayers(room)
        console.log('[ELIMINATION NEXT]', { roomId: room.id, round: room.round + 1, activePlayers: active.length })
        room.round++
        room.gamePhase = 'CLUE'
        room.votes = {}
        room.lockedVotes = []
        room.voteResult = null
        room.eliminationResult = null
        
        room.turnOrder = shuffle(active.map((p) => p.id))
        room.currentTurnPlayerId = room.turnOrder.length > 0 ? room.turnOrder[0] : null
        room.turnIndex = 0
        room.submittedCluePlayerIds = []
      } else {
        room.eliminationResult = null
      }
    }
    broadcastRoom(room)
  }

  socket.on('disconnect', () => {
    if (!currentSessionId) return
    disconnectPlayer(currentSessionId)
  })

  socket.on('add-dev-bots', (callback) => {
    if (!IS_DEV_BOTS_ENABLED) return callback?.({ error: 'DEV_BOTS_DISABLED' })
    if (!currentSessionId || !currentRoomId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ error: 'NOT_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ error: 'GAME_IN_PROGRESS' })

    const botCount = room.players.filter(p => p.isBot).length
    if (botCount >= 4) return callback?.({ error: '4 development bots are already in this room.' })
    
    const availableSlots = 20 - room.players.length
    if (availableSlots < 4) return callback?.({ error: `Only ${availableSlots} slots available. Cannot add 4 bots.` })
    
    addBots(currentRoomId, 4)
    callback?.({ success: true })
  })

  socket.on('remove-dev-bots', (callback) => {
    if (!IS_DEV_BOTS_ENABLED) return callback?.({ error: 'DEV_BOTS_DISABLED' })
    if (!currentSessionId || !currentRoomId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ error: 'NOT_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ error: 'GAME_IN_PROGRESS' })

    removeBots(currentRoomId)

    // Remove bots from the room players array since disconnect only marks them offline
    room.players = room.players.filter(p => !p.isBot)

    if (room.status === 'LOBBY') {
      const newTotal = Math.max(3, room.players.length)
      const defConfig = getDefaultConfig(newTotal)
      room.configuration.totalPlayers = defConfig.totalPlayers
      room.configuration.undercover = defConfig.undercover
      room.configuration.mrWhite = defConfig.mrWhite
      room.configuration.civilians = newTotal - defConfig.undercover - defConfig.mrWhite
    }

    broadcastRoom(room)
    callback?.({ success: true })
  })
})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`UNDERCOVER server running on port ${PORT}`)
  console.log(`CORS allowed origin: ${allowedOrigin}`)
})
