import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { MAX_CLUE_LENGTH, MAX_CHAT_LENGTH } from '../shared/game-limits.js'
import { onRoundStart, onVoteTallied, onElimination, onGameEnd } from './specialRolesHooks.js'
import { SPECIAL_ROLES } from '../src/data/specialRoles.js'
import defaultWords from './drawWords.json' with { type: 'json' }

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

function normalizeOrigin(origin) {
  const value = String(origin || '').trim()
  if (!value) return value
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

const originList = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((s) => normalizeOrigin(s))
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
const drawRooms = new Map()
const sessionSockets = new Map()

// How long a room whose players are all disconnected is kept before reap.
const RECONNECT_GRACE_MS = 5 * 60 * 1000

let WORD_PAIRS = {
  places: [{ civilianWord: 'Ocean', undercoverWord: 'Swimming Pool' }],
  objects: [{ civilianWord: 'Camera', undercoverWord: 'Binoculars' }],
  'open-file': [{ civilianWord: 'Ocean', undercoverWord: 'Swimming Pool' }],
}

if (process.env.NODE_ENV === 'production') {
  try {
    const prodWordsPath = path.resolve(__dirname, 'prodWords.json')
    if (fs.existsSync(prodWordsPath)) {
      WORD_PAIRS = JSON.parse(fs.readFileSync(prodWordsPath, 'utf8'))
    }
  } catch (err) {
    console.error('Failed to load prodWords.json:', err)
  }
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
  if (typeof undercover !== 'number' || undercover < 0) return false
  if (typeof mrWhite !== 'number' || mrWhite < 0) return false
  if (undercover + mrWhite < 1) return false
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
    gameVersion: room.gameVersion || 0,
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
      role: (p.eliminated || room.gamePhase === 'RESULT') ? p.role : undefined,
      specialRole: (p.eliminated || room.gamePhase === 'RESULT') ? 
        ((room.gamePhase === 'REVENGER_DECISION' && room.revengerId === p.id) ? undefined : p.specialRole) 
        : undefined,
      specialRoleData: (() => {
        if (room.gamePhase === 'RESULT') return p.specialRoleData;
        if (!p.specialRoleData) return {};
        const safeData = { ...p.specialRoleData };
        delete safeData.partnerId;
        delete safeData.partnerName;
        delete safeData.duelId;
        delete safeData.used;
        return safeData;
      })(),
      points: room.gamePhase === 'RESULT' ? (p.points || 0) : 0,
      scoreBreakdown: room.gamePhase === 'RESULT' ? (p.scoreBreakdown || []) : [],
      playAgain: !!p.playAgain,
      continueAck: !!p.continueAck,
    })),
    configuration: { ...room.configuration },
    category: room.category,
    wordPair: room.gamePhase === 'RESULT' ? room.wordPair : undefined,
    specialRoleOutcomes: room.specialRoleOutcomes || [],
    revengerDecisionEndsAt: room.gamePhase === 'REVENGER_DECISION' ? (room.revengerDecisionEndsAt || null) : null,
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

function findDrawRoomByPlayer(sessionId) {
  for (const [roomId, room] of drawRooms) {
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

function broadcastDrawRoomState(room) {
  // Sanitize state per player
  for (const p of room.players) {
    io.to(p.id).emit('draw:room-state', getSafeStateForPlayer(room, p.id))
  }
}

function getSafeStateForPlayer(room, playerId) {
  const isDrawer = room.currentDrawerId === playerId
  const isReveal = room.phase === 'ROUND_REVEAL' || room.phase === 'GAME_RESULT'
  return {
    ...room,
    players: room.players.map(p => ({ ...p })),
    chatMessages: [...(room.chatMessages || [])],
    wordChoices: isDrawer ? room.wordChoices : undefined,
    selectedWord: (isDrawer || isReveal) ? room.selectedWord : undefined,
    strokes: undefined,
    turnTimeout: undefined,
    hintTimer: undefined
  }
}

function scheduleWordChoiceTimeout(room) {
  // 15 seconds timeout
  setTimeout(() => {
    const currentRoom = drawRooms.get(room.id)
    if (
      currentRoom && 
      currentRoom.phase === 'WORD_CHOICE' && 
      currentRoom.round === room.round && 
      currentRoom.turnIndex === room.turnIndex &&
      currentRoom.currentDrawerId === room.currentDrawerId
    ) {
      // Auto-select the first word if timeout expires
      if (!currentRoom.wordChoices || currentRoom.wordChoices.length === 0) {
        // No words available (pool exhausted) — skip this turn
        endDrawRound(currentRoom)
        return
      }
      const word = currentRoom.wordChoices[0]
      startDrawingTurn(currentRoom, word)
    }
  }, 15000)
}

function updateRoomHintString(room) {
  if (!room.selectedWord || !room.hintRevealed) return
  let str = ''
  for (let i = 0; i < room.selectedWord.length; i++) {
    str += room.hintRevealed[i] ? room.selectedWord[i] : '_'
  }
  room.hint = str
}

function startDrawingTurn(room, word) {
  if (room.turnTimeout) clearTimeout(room.turnTimeout)
  if (room.hintTimer) clearInterval(room.hintTimer)

  room.selectedWord = word
  room.usedWords = room.usedWords || []
  if (word && !room.usedWords.includes(word.toLowerCase())) {
    room.usedWords.push(word.toLowerCase())
  }
  
  room.phase = 'DRAWING'
  room.roundStartedAt = Date.now()
  room.roundEndsAt = Date.now() + (room.configuration.drawTimeSec * 1000)
  room.strokes = []
  room.guessedPlayerIds = []
  room.turnScores = {}
  
  // Initialize Hint System
  const numHints = room.configuration.hints ?? 2
  const isHidden = typeof room.configuration.gameMode === 'string' && room.configuration.gameMode.toUpperCase() === 'HIDDEN'
  
  if (isHidden || numHints <= 0 || !word) {
    room.hint = word ? word.replace(/[a-zA-Z0-9]/g, '_') : ''
  } else {
    room.hintRevealed = new Array(word.length).fill(false)
    const revealIndices = []
    for (let i = 0; i < word.length; i++) {
      if (/[^a-zA-Z0-9]/.test(word[i])) {
        room.hintRevealed[i] = true
      } else {
        revealIndices.push(i)
      }
    }
    
    // Shuffle indices
    for (let i = revealIndices.length - 1; i > 0; i--) {
       const j = Math.floor(Math.random() * (i + 1));
       [revealIndices[i], revealIndices[j]] = [revealIndices[j], revealIndices[i]];
    }
    
    const hintsToGive = Math.min(numHints, Math.max(0, revealIndices.length - 1))
    if (hintsToGive > 0) {
      const hintIntervalMs = (room.configuration.drawTimeSec * 1000) / (hintsToGive + 1)
      let hintsGiven = 0
      room.hintTimer = setInterval(() => {
        if (room.phase !== 'DRAWING') return clearInterval(room.hintTimer)
        if (hintsGiven >= hintsToGive) return clearInterval(room.hintTimer)
        
        const idx = revealIndices[hintsGiven]
        room.hintRevealed[idx] = true
        hintsGiven++
        updateRoomHintString(room)
        broadcastDrawRoomState(room)
      }, hintIntervalMs)
    }
    updateRoomHintString(room)
  }

  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'
  room.chatMessages = room.chatMessages || []
  room.chatMessages.push({
    id: crypto.randomUUID(),
    type: 'SYSTEM',
    message: `${drawerName} is drawing.`
  })
  if (room.chatMessages.length > 100) room.chatMessages.shift()
  
  broadcastDrawRoomState(room)
  
  // Schedule round end
  const expectedTurnIndex = room.turnIndex
  const expectedRound = room.round
  const expectedDrawerId = room.currentDrawerId
  
  room.turnTimeout = setTimeout(() => {
    const checkRoom = drawRooms.get(room.id)
    if (checkRoom && checkRoom.phase === 'DRAWING' && 
        checkRoom.round === expectedRound && 
        checkRoom.turnIndex === expectedTurnIndex &&
        checkRoom.currentDrawerId === expectedDrawerId) {
      endDrawRound(checkRoom)
    }
  }, room.configuration.drawTimeSec * 1000)
}

function endDrawRound(room) {
  if (room.phase !== 'DRAWING' && room.phase !== 'WORD_CHOICE') return
  
  if (room.turnTimeout) {
    clearTimeout(room.turnTimeout)
    room.turnTimeout = null
  }
  if (room.hintTimer) {
    clearInterval(room.hintTimer)
    room.hintTimer = null
  }

  room.phase = 'ROUND_REVEAL'
  room.hint = ''
  room.hintRevealed = null
  
  // Calculate and apply points
  const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
  let drawerPoints = 0
  
  room.turnScores = room.turnScores || {}
  
  if (drawerPlayer) {
    const sum = Object.values(room.turnScores).reduce((a, b) => a + b, 0)
    drawerPoints = Math.round(sum * 0.5)
    drawerPlayer.score += drawerPoints
    room.turnScores[room.currentDrawerId] = drawerPoints
  }
  
  // Apply guesser points to persistent totals exactly once here
  for (const [pid, pts] of Object.entries(room.turnScores)) {
    if (pid !== room.currentDrawerId) {
      const p = room.players.find(x => x.id === pid)
      if (p) {
        p.score += pts
      }
    }
  }
  
  // Add system message
  room.chatMessages.push({
    id: crypto.randomUUID(),
    type: 'SYSTEM',
    message: `The word was ${room.selectedWord || '(None Selected)'}.`
  })
  
  broadcastDrawRoomState(room)
  
  // Schedule next turn
  setTimeout(() => {
    const currentRoom = drawRooms.get(room.id)
    if (currentRoom && currentRoom.phase === 'ROUND_REVEAL' && currentRoom.round === room.round && currentRoom.turnIndex === room.turnIndex) {
      currentRoom.turnIndex++
      
      if (currentRoom.turnIndex < currentRoom.turnOrder.length) {
        // Next drawer
        currentRoom.currentDrawerId = currentRoom.turnOrder[currentRoom.turnIndex]
        currentRoom.phase = 'WORD_CHOICE'
        currentRoom.wordChoices = generateWordChoices(currentRoom)
        currentRoom.selectedWord = null
        currentRoom.strokes = []
        currentRoom.guessedPlayerIds = []
        currentRoom.turnScores = {}
        currentRoom.hint = ''
        currentRoom.hintRevealed = null
        
        io.to(`draw:${currentRoom.id}`).emit('draw:clear-canvas')
        scheduleWordChoiceTimeout(currentRoom)
        broadcastDrawRoomState(currentRoom)
      } else {
        // End of round
        if (currentRoom.round < currentRoom.totalRounds) {
          currentRoom.round++
          
          // Fisher-Yates shuffle using eligible player IDs
          const playerIds = [...currentRoom.players].filter(p => !p.spectator).map(p => p.id)
          if (playerIds.length === 0) {
            currentRoom.phase = 'GAME_RESULT'
            broadcastDrawRoomState(currentRoom)
            return
          }

          for (let i = playerIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            const temp = playerIds[i]
            playerIds[i] = playerIds[j]
            playerIds[j] = temp
          }
          currentRoom.turnOrder = playerIds
          currentRoom.turnIndex = 0
          currentRoom.currentDrawerId = currentRoom.turnOrder[currentRoom.turnIndex]
          
          currentRoom.phase = 'WORD_CHOICE'
          currentRoom.wordChoices = generateWordChoices(currentRoom)
          currentRoom.selectedWord = null
          currentRoom.strokes = []
          currentRoom.guessedPlayerIds = []
          currentRoom.turnScores = {}
          currentRoom.hint = ''
          currentRoom.hintRevealed = null
          
          io.to(`draw:${currentRoom.id}`).emit('draw:clear-canvas')
          scheduleWordChoiceTimeout(currentRoom)
          broadcastDrawRoomState(currentRoom)
        } else {
          // End of game
          currentRoom.phase = 'GAME_RESULT'
          broadcastDrawRoomState(currentRoom)
        }
      }
    }
  }, 5000)
}

function generateWordChoices(room) {
  room.usedWords = room.usedWords || []
  
  // defaultWords is imported at module scope
  
  let customWords = []
  if (Array.isArray(room.configuration.customWords)) {
    customWords = room.configuration.customWords.map(w => w.trim()).filter(Boolean)
  } else if (typeof room.configuration.customWords === 'string') {
    customWords = room.configuration.customWords.split(',').map(w => w.trim()).filter(Boolean)
  }

  // Build pool based on mode
  let pool = []
  if (room.configuration.useCustomOnly) {
    pool = [...customWords]
  } else if (room.configuration.gameMode && room.configuration.gameMode.toLowerCase() === 'combination') {
    pool = [...defaultWords, ...customWords]
  } else {
    pool = [...defaultWords]
  }
  
  // Deduplicate pool (case-insensitive, keep first occurrence)
  const seen = new Set()
  pool = pool.filter(w => {
    const key = w.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  
  // Remove already-used words (case-insensitive)
  const eligible = pool.filter(w => !room.usedWords.includes(w.toLowerCase()))
  
  // Never fall back to used words or default words when pool is exhausted
  if (eligible.length === 0) return []

  // Fisher-Yates shuffle on a copy
  const shuffled = [...eligible]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  
  const count = room.configuration.wordCount || 3
  return shuffled.slice(0, count)
}

function disconnectDrawPlayer(sessionId) {
  for (const [rid, dr] of drawRooms) {
    const player = dr.players.find((p) => p.id === sessionId)
    if (player) {
      player.isConnected = false
      player.disconnectedAt = Date.now()

      // Do NOT immediately end their turn on transient disconnect
      // Let the word-choice or drawing timeouts handle it naturally
      broadcastDrawRoomState(dr)
      break
    }
  }
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
    onGameEnd(room, { winner: room.winner })
    return true
  } else if (undercovers === 0 && mrWhites === 0) {
    room.gamePhase = 'RESULT'
    room.winner = 'CIVILIAN'
    onGameEnd(room, { winner: room.winner })
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

function assignSpecialRoles(room) {
  const specialRolesConfig = room.configuration.specialRoles || {}
  let availablePlayers = [...room.players]

  const assignRole = (roleKey, count) => {
    const assigned = []
    for (let i = 0; i < count; i++) {
      if (availablePlayers.length === 0) break
      
      let rIndex = availablePlayers.findIndex(p => p.isHost)
      if (rIndex === -1) {
        rIndex = Math.floor(Math.random() * availablePlayers.length)
      }
      
      const p = availablePlayers.splice(rIndex, 1)[0]
      p.specialRole = roleKey
      assigned.push(p)
    }
    return assigned
  }

  const joyFoolMeta = SPECIAL_ROLES.find(r => r.key === 'joyFool')
  if (specialRolesConfig.joyFool === true || specialRolesConfig.joyFool?.enabled === true) {
    if (room.players.length >= joyFoolMeta.minPlayers) {
      assignRole('joyFool', 1)
    }
  }

  const duelistsMeta = SPECIAL_ROLES.find(r => r.key === 'duelists')
  if (specialRolesConfig.duelists === true || specialRolesConfig.duelists?.enabled === true) {
    if (room.players.length >= duelistsMeta.minPlayers) {
      const duelists = assignRole('duelists', 2)
      if (duelists.length === 2) {
        const duelId = crypto.randomUUID()
        duelists[0].specialRoleData = { duelId, partnerId: duelists[1].id, partnerName: duelists[1].name, resolved: false }
        duelists[1].specialRoleData = { duelId, partnerId: duelists[0].id, partnerName: duelists[0].name, resolved: false }
      } else {
        duelists.forEach(p => { p.specialRole = null; availablePlayers.push(p); })
      }
    }
  }

  const loversMeta = SPECIAL_ROLES.find(r => r.key === 'lovers')
  if (specialRolesConfig.lovers === true || specialRolesConfig.lovers?.enabled === true) {
    if (room.players.length >= loversMeta.minPlayers) {
      const lovers = assignRole('lovers', 2)
      if (lovers.length === 2) {
        const loverId = crypto.randomUUID()
        lovers[0].specialRoleData = { loverId, partnerId: lovers[1].id, resolved: false }
        lovers[1].specialRoleData = { loverId, partnerId: lovers[0].id, resolved: false }
      } else {
        lovers.forEach(p => { p.specialRole = null; availablePlayers.push(p); })
      }
    }
  }

  const revengerMeta = SPECIAL_ROLES.find(r => r.key === 'revenger')
  if (specialRolesConfig.revenger === true || specialRolesConfig.revenger?.enabled === true) {
    if (room.players.length >= revengerMeta.minPlayers) {
      const revengers = assignRole('revenger', 1)
      if (revengers.length > 0) {
        revengers[0].specialRoleData = { resolved: false, decisionMade: false }
      }
    }
  }

  const boomerangMeta = SPECIAL_ROLES.find(r => r.key === 'boomerang')
  if (specialRolesConfig.boomerang === true || specialRolesConfig.boomerang?.enabled === true) {
    if (room.players.length >= boomerangMeta.minPlayers) {
      const boomerangs = assignRole('boomerang', 1)
      if (boomerangs.length > 0) {
        boomerangs[0].specialRoleData = { used: false }
      }
    }
  }

  const goddessMeta = SPECIAL_ROLES.find(r => r.key === 'goddessOfJustice')
  if (specialRolesConfig.goddessOfJustice === true || specialRolesConfig.goddessOfJustice?.enabled === true) {
    if (room.players.length >= goddessMeta.minPlayers) {
      const goddesses = assignRole('goddessOfJustice', 1)
      if (goddesses.length > 0) {
        goddesses[0].specialRoleData = { used: false }
      }
    }
  }
  const ghostMeta = SPECIAL_ROLES.find(r => r.key === 'ghost')
  if (specialRolesConfig.ghost === true || specialRolesConfig.ghost?.enabled === true) {
    if (room.players.length >= ghostMeta.minPlayers) {
      const ghosts = assignRole('ghost', 1)
      if (ghosts.length > 0) {
        ghosts[0].specialRoleData = {}
      }
    }
  }
}

function startCluePhase(room) {
  if (room.gamePhase === 'CLUE') return
  room.gamePhase = 'CLUE'
  room.submittedCluePlayerIds = []

  const active = getActivePlayers(room)
  let order = shuffle(active.map((p) => p.id))
  
  if (room.round === 1 && order.length > 1) {
    const firstPlayerId = order[0]
    const firstPlayer = room.players.find(p => p.id === firstPlayerId)
    if (firstPlayer?.role === 'MR_WHITE') {
      const nonMrWhiteIndices = []
      for (let i = 1; i < order.length; i++) {
        const p = room.players.find(x => x.id === order[i])
        if (p?.role !== 'MR_WHITE') {
          nonMrWhiteIndices.push(i)
        }
      }
      if (nonMrWhiteIndices.length > 0) {
        const swapIdx = nonMrWhiteIndices[Math.floor(Math.random() * nonMrWhiteIndices.length)]
        order[0] = order[swapIdx]
        order[swapIdx] = firstPlayerId
      }
    }
  }

  room.turnOrder = order
  room.currentTurnPlayerId = room.turnOrder.length > 0 ? room.turnOrder[0] : null
  room.turnIndex = 0

  onRoundStart(room)

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
  let category = room.category
  if (category === 'random') {
    const validCategories = Object.entries(WORD_PAIRS)
      .filter(([, pairs]) => Array.isArray(pairs) && pairs.length > 0)

    if (validCategories.length === 0) return

    const [selectedCategory, selectedPairs] =
      validCategories[Math.floor(Math.random() * validCategories.length)]

    const pair =
      selectedPairs[Math.floor(Math.random() * selectedPairs.length)]

    room.wordPair = {
      ...pair,
      category: selectedCategory
    }
  } else {
    if (!category || !WORD_PAIRS[category]) {
      category = Object.keys(WORD_PAIRS)[0] || 'open-file'
    }
    const pairs = WORD_PAIRS[category]
    if (!pairs || pairs.length === 0) return

    const pairIndex = Math.floor(Math.random() * pairs.length)
    const pair = pairs[pairIndex]

    room.wordPair = { ...pair, category }
  }
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

    let { roomId, room } = findRoomByPlayer(sessionId)
    let isDrawRoom = false
    
    if (!room) {
      const drawResult = findDrawRoomByPlayer(sessionId)
      if (drawResult.room) {
        roomId = drawResult.roomId
        room = drawResult.room
        isDrawRoom = true
      } else {
        socket.emit('session-no-room')
        return
      }
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
    
    if (isDrawRoom) {
      socket.join(`draw:${roomId}`)
      socket.join(sessionId) // Join private room for Skribbl direct messaging
    } else {
      socket.join(roomId)
    }
    
    player.isConnected = true
    player.disconnectedAt = null
    
    if (isDrawRoom) {
      socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'skribbl' })
      console.log('[ROOM] draw session reconnected', { sessionId, roomId })
      socket.emit('draw:room-state', getSafeStateForPlayer(room, sessionId))
      broadcastDrawRoomState(room)
      return
    }
    reassignHostIfNeeded(room)
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'undercover' })
    console.log('[ROOM] session reconnected', { sessionId, roomId })
    socket.emit('session-reconnected', getPublicRoomState(room))

    if (room.wordPair) {
      const role = player?.role || null
      const word = wordForRole(role, room.wordPair)
      const roleToReveal = (room.configuration.revealRoles || role === 'MR_WHITE') ? role : null
      socket.emit('role-assigned', { role: roleToReveal, word, specialRole: player?.specialRole || null })
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

    const config = getDefaultConfig(3)
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
        specialRole: null,
        specialRoleData: {},
        points: 0,
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
        specialRoles: { joyFool: false, duelists: false, lovers: false, revenger: false, boomerang: false, goddessOfJustice: false, ghost: false, falafelVendor: false, mrMeme: false }
      },
      category: 'open-file',
      specialRoleOutcomes: [],
      gameVersion: 0,
    }

    rooms.set(roomId, room)
    currentSessionId = sessionId
    currentRoomId = roomId
    socket.join(roomId)
    connectPlayer(socket, sessionId)
    callback?.({ room: getPublicRoomState(room), resumeToken: room.players[0].resumeToken, playerName: room.players[0].name })
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
      // Never overwrite the existing player's authoritative name!
      currentSessionId = sessionId
      currentRoomId = normalizedId
      socket.join(normalizedId)
      connectPlayer(socket, sessionId)
      ensureResumeToken(existing)
      const publicState = getPublicRoomState(room)
      console.log('[ROOM] join successful (rejoin)', { roomId: normalizedId, playerId: sessionId })
      socket.emit('session-token', { resumeToken: existing.resumeToken, roomId: normalizedId, playerName: existing.name, gameMode: 'undercover' })

      if (room.wordPair) {
        const role = existing.role || null
        const word = wordForRole(role, room.wordPair)
        const roleToReveal = (room.configuration.revealRoles || role === 'MR_WHITE') ? role : null
        socket.emit('role-assigned', { role: roleToReveal, word, specialRole: existing.specialRole || null })
      }

      callback?.({ room: publicState, resumeToken: existing.resumeToken, playerName: existing.name })
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
      specialRole: null,
      specialRoleData: {},
      points: 0,
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
    socket.emit('session-token', { resumeToken: room.players[room.players.length - 1].resumeToken, roomId: normalizedId, playerName: trimmed, gameMode: 'undercover' })
    callback?.({ room: publicState, resumeToken: room.players[room.players.length - 1].resumeToken, playerName: trimmed })
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

  // ==========================================
  // SKRIBBL / DRAWGAME EVENTS
  // ==========================================


  
  socket.on('draw:create-room', ({ sessionId, playerName }, callback) => {
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    
    // Ensure player is not already in a draw room
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === sessionId)) {
        return callback?.({ error: 'ALREADY_IN_DRAW_ROOM' })
      }
    }

    let roomId = makeRoomId()
    while (drawRooms.has(roomId) || rooms.has(roomId)) roomId = makeRoomId()

    const room = {
      id: roomId,
      hostId: sessionId,
      status: 'LOBBY',
      phase: 'LOBBY',
      players: [{
        id: sessionId,
        name: trimmed,
        isHost: true,
        isConnected: true,
        spectator: false,
        score: 0
      }],
      configuration: {
        maxPlayers: 8,
        drawTimeSec: 80,
        rounds: 3,
        wordCount: 3,
        hints: 2,
        gameMode: 'NORMAL',
        customWords: '',
        useCustomOnly: false
      },
      usedWords: []
    }

    drawRooms.set(roomId, room)
    currentSessionId = sessionId
    socket.join(`draw:${roomId}`)
    socket.join(sessionId) // Join private room for Skribbl direct messaging
    connectPlayer(socket, sessionId)
    
    const player = room.players[0]
    ensureResumeToken(player)
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'skribbl' })
    
    callback?.({ room: getSafeStateForPlayer(room, sessionId) })
  })

  socket.on('draw:join-room', ({ sessionId, roomId, playerName }, callback) => {
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    const normalizedId = (roomId || '').trim().toUpperCase()

    const room = drawRooms.get(normalizedId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })

    const existing = room.players.find(p => p.id === sessionId)
    if (existing) {
      existing.isConnected = true
      existing.name = trimmed
      existing.disconnectedAt = null
      currentSessionId = sessionId
      socket.join(`draw:${normalizedId}`)
      socket.join(sessionId) // Join private room for Skribbl direct messaging
      connectPlayer(socket, sessionId)
      
      if (!existing.resumeToken) ensureResumeToken(existing)
      socket.emit('session-token', { resumeToken: existing.resumeToken, roomId: normalizedId, playerName: existing.name, gameMode: 'skribbl' })
      
      callback?.({ room: getSafeStateForPlayer(room, sessionId) })
      broadcastDrawRoomState(room)
      return
    }

    if (room.players.length >= room.configuration.maxPlayers) {
      return callback?.({ error: 'ROOM_FULL' })
    }

    if (room.players.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      return callback?.({ error: 'NAME_TAKEN' })
    }

    const newPlayer = {
      id: sessionId,
      name: trimmed,
      isHost: false,
      isConnected: true,
      spectator: room.status !== 'LOBBY',
      score: 0
    }
    room.players.push(newPlayer)

    currentSessionId = sessionId
    socket.join(`draw:${normalizedId}`)
    socket.join(sessionId) // Join private room for Skribbl direct messaging
    connectPlayer(socket, sessionId)
    
    ensureResumeToken(newPlayer)
    socket.emit('session-token', { resumeToken: newPlayer.resumeToken, roomId: normalizedId, playerName: newPlayer.name, gameMode: 'skribbl' })
    
    callback?.({ room: getSafeStateForPlayer(room, sessionId) })
    broadcastDrawRoomState(room)
  })



  socket.on('draw:leave-room', (callback) => {
    if (!currentSessionId) return callback?.({ error: 'NOT_IN_ROOM' })
    
    let foundRoomId = null
    let foundRoom = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        foundRoomId = rid
        foundRoom = dr
        break
      }
    }

    if (!foundRoom) return callback?.({ error: 'NOT_IN_ROOM' })

    const idx = foundRoom.players.findIndex(p => p.id === currentSessionId)
    if (idx !== -1) {
      const wasHost = foundRoom.players[idx].isHost
      foundRoom.players.splice(idx, 1)
      socket.leave(`draw:${foundRoomId}`)
      socket.leave(currentSessionId) // Cleanup private room
      
      if (foundRoom.players.length === 0) {
        drawRooms.delete(foundRoomId)
      } else if (wasHost) {
        const nextHost = foundRoom.players.find(p => p.isConnected) || foundRoom.players[0]
        if (nextHost) {
          nextHost.isHost = true
          foundRoom.hostId = nextHost.id
        }
        broadcastDrawRoomState(foundRoom)
      } else {
        broadcastDrawRoomState(foundRoom)
      }
    }
    
    callback?.({ success: true })
  })

  socket.on('draw:update-config', (config) => {
    if (!currentSessionId || typeof config !== 'object') return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.hostId === currentSessionId) {
        room = dr
        break
      }
    }
    if (!room || room.status !== 'LOBBY') return
    
    if (config.drawTimeSec !== undefined) {
      room.configuration.drawTimeSec = Math.max(45, Math.min(120, parseInt(config.drawTimeSec) || 80))
    }
    if (config.rounds !== undefined) {
      room.configuration.rounds = Math.max(1, Math.min(10, parseInt(config.rounds) || 3))
    }
    if (config.wordCount !== undefined) {
      room.configuration.wordCount = Math.max(1, Math.min(5, parseInt(config.wordCount) || 3))
    }
    if (config.hints !== undefined) {
      room.configuration.hints = Math.max(0, Math.min(3, parseInt(config.hints) || 2))
    }
    if (config.gameMode !== undefined && ['NORMAL', 'HIDDEN', 'COMBINATION'].includes(config.gameMode)) {
      room.configuration.gameMode = config.gameMode
    }
    if (config.customWords !== undefined) {
      room.configuration.customWords = String(config.customWords).substring(0, 5000)
    }
    if (config.useCustomOnly !== undefined) {
      room.configuration.useCustomOnly = !!config.useCustomOnly
    }
    
    broadcastDrawRoomState(room)
  })



  socket.on('draw:start-game', () => {
    if (!currentSessionId) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.hostId === currentSessionId) {
        room = dr
        break
      }
    }
    if (!room || room.status !== 'LOBBY') return
    if (room.players.length < 2) return // Need at least 2 players to start

    // Set up turn order and basic game state
    room.status = 'PLAYING'
    room.phase = 'WORD_CHOICE'
    room.round = 1
    room.totalRounds = room.configuration.rounds
    
    // Fisher-Yates shuffle using eligible player IDs
    const playerIds = [...room.players].filter(p => !p.spectator).map(p => p.id)
    if (playerIds.length === 0) return // Cannot start if no eligible players

    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = playerIds[i]
      playerIds[i] = playerIds[j]
      playerIds[j] = temp
    }
    room.turnOrder = playerIds
    room.turnIndex = 0
    room.currentDrawerId = room.turnOrder[room.turnIndex]
    
    room.wordChoices = generateWordChoices(room)
    room.selectedWord = null
    room.strokes = []
    
    // Clear canvas for all clients on new game
    io.to(`draw:${room.id}`).emit('draw:clear-canvas')
    
    // Start word-choice timeout
    scheduleWordChoiceTimeout(room)
    
    broadcastDrawRoomState(room)
  })



  socket.on('draw:choose-word', (payload, callback) => {
    if (!currentSessionId) return callback?.({ error: 'No session' })
    const word = payload?.word
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === currentSessionId && dr.phase === 'WORD_CHOICE') {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ error: 'Not your turn or wrong phase' })
    if (room.selectedWord) return callback?.({ error: 'Already selected a word' })
    
    if (!room.wordChoices || !room.wordChoices.includes(word)) {
      if (!room.wordChoices || room.wordChoices.length === 0) {
        // Safe fallback if pool exhausted
        endDrawRound(room)
        return callback?.({ success: true, endedEarly: true })
      } else {
        return callback?.({ error: 'Invalid word choice' })
      }
    }

    startDrawingTurn(room, word)
    callback?.({ success: true })
  })

  socket.on('draw:stroke', (strokeData) => {
    if (!currentSessionId) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === currentSessionId && dr.phase === 'DRAWING') {
        room = dr
        break
      }
    }
    if (!room) return

    // Stroke Validation
    if (!strokeData || typeof strokeData !== 'object') return
    if (typeof strokeData.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(strokeData.color)) return
    if (typeof strokeData.size !== 'number' || strokeData.size < 1 || strokeData.size > 100) return
    if (!Array.isArray(strokeData.points) || strokeData.points.length > 500) return
    if (strokeData.tool && strokeData.tool !== 'brush' && strokeData.tool !== 'eraser' && strokeData.tool !== 'fill') return
    
    for (const pt of strokeData.points) {
      if (typeof pt.x !== 'number' || typeof pt.y !== 'number' || pt.x < -0.2 || pt.x > 1.2 || pt.y < -0.2 || pt.y > 1.2) {
        return // Reject malformed stroke entirely
      }
    }

    if (strokeData.isComplete !== false) {
      room.strokes.push(strokeData)
      io.to(`draw:${room.id}`).emit('draw:stroke', strokeData)
    } else {
      socket.to(`draw:${room.id}`).emit('draw:stroke', strokeData)
    }
  })

  socket.on('draw:undo', () => {
    if (!currentSessionId) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === currentSessionId && dr.phase === 'DRAWING') {
        room = dr
        break
      }
    }
    if (!room || !room.strokes || room.strokes.length === 0) return

    room.strokes.pop()
    io.to(`draw:${room.id}`).emit('draw:undo')
  })

  socket.on('draw:clear-canvas', () => {
    if (!currentSessionId) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === currentSessionId && dr.phase === 'DRAWING') {
        room = dr
        break
      }
    }
    if (!room) return

    room.strokes = []
    io.to(`draw:${room.id}`).emit('draw:clear-canvas')
  })

  function normalizeGuess(value) {
    if (typeof value !== 'string') return ''
    return value.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim()
  }

  socket.on('draw:guess', ({ message }) => {
    if (!currentSessionId) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room || room.phase !== 'DRAWING') return
    if (room.currentDrawerId === currentSessionId) return // Drawer can't guess

    if (typeof message !== 'string') return
    const trimmed = message.trim()
    if (!trimmed || trimmed.length > 120) return

    const player = room.players.find(p => p.id === currentSessionId)
    if (!player) return

    if (!room.chatMessages) room.chatMessages = []
    if (!room.guessedPlayerIds) room.guessedPlayerIds = []

    const normGuess = normalizeGuess(trimmed)
    const normTarget = normalizeGuess(room.selectedWord)

    if (room.guessedPlayerIds.includes(currentSessionId)) {
      if (normGuess === normTarget) {
        return // Drop duplicate correct guesses
      }
      // Otherwise, allow as normal chat
      const chatMsg = {
        id: crypto.randomUUID(),
        playerId: currentSessionId,
        playerName: player.name,
        type: 'CHAT',
        message: trimmed
      }
      room.chatMessages.push(chatMsg)
      if (room.chatMessages.length > 100) room.chatMessages.shift()
      broadcastDrawRoomState(room)
      return
    }

    let msgType = 'CHAT'
    
    // Close guess logic
    const isClose = (guess, target) => {
      if (!guess || !target) return false
      if (guess === target) return false
      if (Math.abs(guess.length - target.length) > 2) return false
      if (target.includes(guess) && target.length - guess.length <= 2) return true
      if (guess.includes(target) && guess.length - target.length <= 2) return true
      
      let matches = 0
      for(let i = 0; i < Math.min(guess.length, target.length); i++) {
         if (guess[i] === target[i]) matches++
      }
      return matches >= target.length - 1 && target.length > 3
    }

    if (normGuess === normTarget) {
      msgType = 'CORRECT'
      room.guessedPlayerIds.push(currentSessionId)
      
      const timeRemaining = Math.max(0, (room.roundEndsAt - Date.now()) / 1000)
      const basePoints = Math.round(500 * timeRemaining / room.configuration.drawTimeSec)
      
      const order = room.guessedPlayerIds.length
      let multiplier = 0.50
      if (order === 1) multiplier = 1.00
      else if (order === 2) multiplier = 0.80
      else if (order === 3) multiplier = 0.65
      
      const points = Math.max(50, Math.round(basePoints * multiplier))
      if (!room.turnScores) room.turnScores = {}
      room.turnScores[currentSessionId] = points
      // player.score += points // DO NOT apply yet, wait for ROUND_REVEAL
      
      const eligiblePlayers = room.players.filter(p => !p.spectator && p.id !== room.currentDrawerId)
      const isEarlyFinish = room.guessedPlayerIds.length >= eligiblePlayers.length
      
      if (isEarlyFinish) {
        // Broadcast the message FIRST so it shows in chat, then trigger round end.
        const chatMsg = {
          id: crypto.randomUUID(),
          playerId: currentSessionId,
          playerName: player.name,
          type: msgType,
          message: null
        }
        room.chatMessages.push(chatMsg)
        if (room.chatMessages.length > 100) room.chatMessages.shift()
        
        broadcastDrawRoomState(room) // Broadcast first so the chat message is immediately visible in DRAWING phase
        endDrawRound(room)
        return // avoid double-broadcasting below
      }
    } else if (isClose(normGuess, normTarget)) {
      msgType = 'CLOSE'
    }

    const chatMsg = {
      id: crypto.randomUUID(),
      playerId: currentSessionId,
      playerName: player.name,
      type: msgType,
      message: msgType === 'CHAT' ? trimmed : null
    }

    room.chatMessages.push(chatMsg)
    if (room.chatMessages.length > 100) {
      room.chatMessages.shift()
    }

    broadcastDrawRoomState(room)
  })

  socket.on('draw:request-strokes', (callback) => {
    if (!currentSessionId) return callback?.({ strokes: [] })
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ strokes: [] })
    callback?.({ strokes: room.strokes || [] })
  })

  socket.on('draw:play-again', (callback) => {
    if (!currentSessionId) return callback?.({ success: false, error: 'NOT_IN_ROOM' })
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.hostId === currentSessionId) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ success: false, error: 'NOT_HOST_OR_ROOM_NOT_FOUND' })
    if (room.phase !== 'GAME_RESULT') return callback?.({ success: false, error: 'GAME_NOT_ENDED' })

    room.status = 'LOBBY'
    room.phase = 'LOBBY'
    room.round = 1
    room.turnOrder = []
    room.turnIndex = 0
    room.currentDrawerId = null
    room.selectedWord = null
    room.wordChoices = []
    room.strokes = []
    room.chatMessages = []
    room.guessedPlayerIds = []
    room.turnScores = {}
    room.usedWords = []
    
    room.players.forEach(p => {
      p.score = 0
      p.spectator = false
    })

    io.to(`draw:${room.id}`).emit('draw:clear-canvas')
    
    broadcastDrawRoomState(room)
    callback?.({ success: true })
  })

  // Simple mock word generator


  socket.on('play-again', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'ACTIVE' || room.gamePhase !== 'RESULT') return callback?.({ success: false, error: 'GAME_NOT_ENDED' })

    const player = room.players.find(p => p.id === currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    
    player.playAgain = true
    player.status = player.isHost ? 'READY' : 'JOINED'
    if (player.spectator) {
      player.spectator = false
    }

    const requiredPlayers = room.players.filter(p => p.isConnected && !p.isBot)
    const allOptedIn = requiredPlayers.length > 0 && requiredPlayers.every(p => p.playAgain)

    if (allOptedIn) {
      // Re-validate configuration based on final player count when entering lobby
      room.configuration.totalPlayers = Math.max(3, room.players.length)
      if (!validateConfig(room.configuration, room)) {
        const defConfig = getDefaultConfig(room.configuration.totalPlayers)
        room.configuration.undercover = defConfig.undercover
        room.configuration.mrWhite = defConfig.mrWhite
      }
      room.configuration.civilians = room.configuration.totalPlayers - room.configuration.undercover - room.configuration.mrWhite

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
      room.revengerId = null
    room.revengerDecisionEndsAt = null
      room.goddessId = null
      room.chat = []
      room.turnOrder = []
      room.currentTurnPlayerId = null
      room.turnIndex = 0
      room.submittedCluePlayerIds = []
      room.specialRoleOutcomes = []
      room.baseScoringResolved = false

      room.players.forEach(p => {
        if (!p.playAgain) {
          p.status = p.isHost ? 'READY' : 'JOINED'
        }
        p.eliminated = false
        p.spectator = false
        p.role = null
        p.word = null
        p.specialRole = null
        p.specialRoleData = {}
        p.points = 0
        p.scoreBreakdown = []
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
    
    const hostPlayer = room.players.find(p => p.id === currentSessionId)
    if (room.status !== 'LOBBY') {
      if (!(room.status === 'ACTIVE' && room.gamePhase === 'RESULT' && hostPlayer?.playAgain)) {
        return
      }
    }
    
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
      specialRoles: config.specialRoles ?? room.configuration.specialRoles,
    }
    broadcastRoom(room)
  })

  socket.on('update-category', ({ category }) => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    if (room.hostId !== currentSessionId) return
    
    const hostPlayer = room.players.find(p => p.id === currentSessionId)
    if (room.status !== 'LOBBY') {
      if (!(room.status === 'ACTIVE' && room.gamePhase === 'RESULT' && hostPlayer?.playAgain)) {
        return
      }
    }
    
    if (typeof category !== 'string') return
    room.category = category
    broadcastRoom(room)
  })

  socket.on('host-new-game', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'NOT_IN_ROOM' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status === 'LOBBY' || room.gamePhase === 'RESULT') return callback?.({ success: false, error: 'INVALID_PHASE' })

    room.gameVersion++

    room.status = 'ACTIVE'
    room.phase = 'ACTIVE'
    room.gamePhase = null
    room.winner = null
    room.round = 1
    room.wordPair = null
    room.clues = []
    room.chat = []
    room.votes = {}
    room.lockedVotes = []
    room.voteResult = null
    room.eliminationResult = null
    room.mrWhiteGuesserId = null
    room.mrWhiteLiveGuess = ''
    room.mrWhiteGuessSubmitted = false
    room.pendingMrWhiteElimination = null
    room.turnOrder = []
    room.currentTurnPlayerId = null
    room.turnIndex = 0
    room.submittedCluePlayerIds = []
    room.specialRoleOutcomes = []
    room.baseScoringResolved = false
    room.revengerId = null
    room.revengerDecisionEndsAt = null
    room.goddessId = null

    room.players.forEach((p) => {
      p.eliminated = false
      p.spectator = false
      p.status = 'PLAYING'
      p.role = null
      p.word = null
      p.specialRole = null
      p.specialRoleData = {}
      p.points = 0
      p.scoreBreakdown = []
      p.playAgain = false
      p.continueAck = false
    })

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
    })

    assignSpecialRoles(room)

    room.players.forEach((p) => {
      const pSocketId = sessionSockets.get(p.id)
      if (pSocketId) {
        const pSocket = io.sockets.sockets.get(pSocketId)
        if (pSocket) {
          const word = wordForRole(p.role, room.wordPair)
          const roleToReveal = (room.configuration.revealRoles || p.role === 'MR_WHITE') ? p.role : null
          pSocket.emit('role-assigned', { role: roleToReveal, word, specialRole: p.specialRole || null })
        }
      }
    })

    startCluePhase(room)
    callback?.({ success: true })
  })

  socket.on('host-return-to-lobby', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'NOT_IN_ROOM' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status === 'LOBBY') return callback?.({ success: false, error: 'INVALID_PHASE' })

    room.gameVersion++

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
    room.specialRoleOutcomes = []
    room.baseScoringResolved = false
    room.revengerId = null
    room.revengerDecisionEndsAt = null
    room.goddessId = null

    room.players.forEach(p => {
      p.status = p.isHost ? 'READY' : 'JOINED'
      p.eliminated = false
      p.spectator = false
      p.role = null
      p.word = null
      p.specialRole = null
      p.specialRoleData = {}
      p.points = 0
      p.scoreBreakdown = []
      p.playAgain = false
      p.continueAck = false
    })

    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('start-game', () => {
    if (!currentSessionId || !currentRoomId) return
    const room = rooms.get(currentRoomId)
    if (!room) return
    if (room.hostId !== currentSessionId) return
    if (room.status !== 'LOBBY') return
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
    room.specialRoleOutcomes = []
    room.baseScoringResolved = false

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
      p.specialRole = null
      p.specialRoleData = {}
      p.points = 0
      p.scoreBreakdown = []
    })

    assignSpecialRoles(room)

    room.players.forEach((p) => {
      const word = wordForRole(p.role, room.wordPair)

      const socketId = sessionSockets.get(p.id)
      if (socketId) {
        const roleToReveal = (room.configuration.revealRoles || p.role === 'MR_WHITE') ? p.role : null
        io.to(socketId).emit('role-assigned', { role: roleToReveal, word, specialRole: p.specialRole })
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

  socket.on('host-skip-clue-round', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status !== 'ACTIVE' || room.gamePhase !== 'CLUE') return callback?.({ success: false, error: 'INVALID_PHASE' })

    startVotePhase(room)
    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('host-revote', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status !== 'ACTIVE' || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'INVALID_PHASE' })

    const hasVoteStateToReset = Object.keys(room.votes || {}).length > 0 ||
      (room.lockedVotes || []).length > 0 ||
      Boolean(room.voteResult?.tie)

    if (!hasVoteStateToReset) return callback?.({ success: false, error: 'INVALID_PHASE' })

    room.votes = {}
    room.lockedVotes = []
    room.voteResult = null
    room.votingAttempt = (room.votingAttempt || 1) + 1
    room.gamePhase = 'VOTE'

    broadcastRoom(room)
    callback?.({ success: true })
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

    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!isGhostSpectator && (player.eliminated || player.spectator)) {
      return callback?.({ success: false, error: 'ELIMINATED_PLAYERS_CANNOT_CHAT' })
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
    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!player || (!isGhostSpectator && (player.eliminated || player.spectator))) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    
    if (room.lockedVotes.includes(currentSessionId)) return callback?.({ success: false, error: 'VOTE_ALREADY_LOCKED' })
    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator) return callback?.({ success: false, error: 'INVALID_TARGET' })

    if (currentSessionId === targetId) return callback?.({ success: false, error: 'SELF_VOTING_NOT_ALLOWED' })

    if (room.votes[currentSessionId] === targetId) {
      delete room.votes[currentSessionId]
    } else {
      room.votes[currentSessionId] = targetId
    }
    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('lock-vote', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })
    
    const player = room.players.find((p) => p.id === currentSessionId)
    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!player || (!isGhostSpectator && (player.eliminated || player.spectator))) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    
    if (room.lockedVotes.includes(currentSessionId)) return callback?.({ success: false, error: 'VOTE_ALREADY_LOCKED' })
    if (!room.votes[currentSessionId]) return callback?.({ success: false, error: 'NO_VOTE_SELECTED' })

    room.lockedVotes.push(currentSessionId)
    
    const eligibleVoters = room.players.filter((p) => {
      if (p.status !== 'PLAYING') return false
      const ghostSpec = p.eliminated === true && p.specialRole === 'ghost'
      return ghostSpec || (!p.eliminated && !p.spectator)
    })
    const votingComplete = room.lockedVotes.length === eligibleVoters.length
    
    console.log('[VOTING DEBUG]')
    console.log(`room=${room.id}`)
    console.log(`round=${room.round}`)
    console.log(`attempt=${room.votingAttempt || 1}`)
    console.log(`eligibleVoters=${eligibleVoters.length}`)
    console.log(`confirmedVoters=${room.lockedVotes.length}`)
    console.log(`remainingVoters=${eligibleVoters.length - room.lockedVotes.length}`)
    console.log(`votingComplete=${votingComplete}`)

    if (votingComplete) {
      console.log('resolving=true')
      // Resolve votes
      const voteCounts = {}
      for (const voterId of room.lockedVotes) {
        const targetId = room.votes[voterId]
        voteCounts[targetId] = (voteCounts[targetId] || 0) + 1
      }
      
      let finalVoteCounts = voteCounts
      const tallyResult = onVoteTallied(room, voteCounts)
      if (tallyResult && tallyResult.redirectedTally) {
        finalVoteCounts = tallyResult.redirectedTally
      }
      
      let maxVotes = 0
      let mostVoted = []
      
      for (const [targetId, count] of Object.entries(finalVoteCounts)) {
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
          const cascaded = onElimination(room, eliminatedId) || []
          
          const newlyEliminated = [eliminatedPlayer, ...cascaded]
          room.mrWhiteQueue = newlyEliminated.filter(p => p.role === 'MR_WHITE').map(p => p.id)
          
          room.voteResult = { tie: false, eliminated: eliminatedId }
          room.gamePhase = 'ELIMINATION'
          room.eliminationResult = {
            playerId: eliminatedId,
            playerName: eliminatedPlayer.name,
            role: eliminatedPlayer.role,
            voteCount: maxVotes,
            isVoteElimination: true,
            startedAt: Date.now(),
            specialRole: eliminatedPlayer.specialRole,
            specialRoleOutcomes: room.specialRoleOutcomes
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
          
          const hasMrWhite = newlyEliminated.some(p => p.role === 'MR_WHITE')
          const delay = hasMrWhite ? 5000 : 6500
          
          const version = room.gameVersion
          setTimeout(() => {
            advanceFromElimination(room.id, version)
          }, delay)
        }
      } else {
        // Tie
        room.voteResult = { tie: true, tiedPlayers: mostVoted }
        
        const goddess = room.players.find(p => p.specialRole === 'goddessOfJustice')
        if (goddess && !goddess.specialRoleData?.used) {
          room.gamePhase = 'GODDESS_DECISION'
          room.goddessId = goddess.id
          
          const version = room.gameVersion
          setTimeout(() => {
            const currentRoom = rooms.get(room.id)
            if (!currentRoom || currentRoom.gamePhase !== 'GODDESS_DECISION' || currentRoom.gameVersion !== version) return
            if (currentRoom.goddessId !== goddess.id) return
            
            const currentGoddess = currentRoom.players.find(p => p.id === goddess.id)
            if (currentGoddess && currentGoddess.specialRoleData) {
              currentGoddess.specialRoleData.used = true
            }
            
            currentRoom.votes = {}
            currentRoom.lockedVotes = []
            currentRoom.voteResult = null
            currentRoom.votingAttempt = (currentRoom.votingAttempt || 1) + 1
            currentRoom.gamePhase = 'VOTE'
            currentRoom.goddessId = null
            broadcastRoom(currentRoom)
          }, 15000)
        } else {
          // No special-role decision is required: immediately start the next vote attempt.
          room.votes = {}
          room.lockedVotes = []
          room.voteResult = null
          room.votingAttempt = (room.votingAttempt || 1) + 1
          room.gamePhase = 'VOTE'
        }
      }
    }
    
    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('unlock-vote', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })

    const player = room.players.find((p) => p.id === currentSessionId)
    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!player || (!isGhostSpectator && (player.eliminated || player.spectator))) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    if (!room.lockedVotes.includes(currentSessionId)) return callback?.({ success: false, error: 'VOTE_NOT_LOCKED' })

    room.lockedVotes = room.lockedVotes.filter((id) => id !== currentSessionId)
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

  // Revenger selects target to eliminate
  socket.on('submit-revenger-decision', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'REVENGER_DECISION') return callback?.({ success: false })
    
    if (currentSessionId !== room.revengerId) return callback?.({ success: false, error: 'NOT_REVENGER' })
    const revenger = room.players.find(p => p.id === currentSessionId)
    if (!revenger || revenger.specialRole !== 'revenger') return callback?.({ success: false })
    if (revenger.specialRoleData?.decisionMade) return callback?.({ success: false, error: 'ALREADY_DECIDED' })
    
    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator || targetId === currentSessionId) {
      return callback?.({ success: false, error: 'INVALID_TARGET' })
    }
    
    revenger.specialRoleData.decisionMade = true
    revenger.specialRoleData.resolved = true
    
    target.eliminated = true
    target.spectator = true
    
    const cascadedPlayers = onElimination(room, target.id)
    const newlyEliminated = [target, ...cascadedPlayers]
    
    if (!room.mrWhiteQueue) room.mrWhiteQueue = []
    newlyEliminated.forEach(p => {
      if (p.role === 'MR_WHITE') room.mrWhiteQueue.push(p.id)
    })
    
    room.specialRoleOutcomes = room.specialRoleOutcomes || []
    room.specialRoleOutcomes.push({
      role: 'revenger',
      revengerName: revenger.name,
      targetName: target.name,
      message: `REVENGER\n${revenger.name} took down ${target.name}`
    })
    
    room.eliminationResult = {
      playerId: target.id,
      playerName: target.name,
      role: target.role,
      specialRole: target.specialRole,
      isRevengerElimination: true,
      isVoteElimination: true,
      startedAt: Date.now(),
      specialRoleOutcomes: room.specialRoleOutcomes
    }
    room.gamePhase = 'ELIMINATION'
    room.revengerId = null
    room.revengerDecisionEndsAt = null
    broadcastRoom(room)
    
    const hasMrWhite = newlyEliminated.some(p => p.role === 'MR_WHITE')
    const delay = hasMrWhite ? 5000 : 6500
    const version = room.gameVersion
    setTimeout(() => {
      advanceFromElimination(room.id, version)
    }, delay)
    
    callback?.({ success: true })
  })

  // Goddess selects target to eliminate from tied players
  socket.on('submit-goddess-decision', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'GODDESS_DECISION') return callback?.({ success: false })
    
    if (currentSessionId !== room.goddessId) return callback?.({ success: false, error: 'NOT_GODDESS' })
    const goddess = room.players.find(p => p.id === currentSessionId)
    if (!goddess || goddess.specialRole !== 'goddessOfJustice') return callback?.({ success: false })
    if (goddess.specialRoleData?.used) return callback?.({ success: false, error: 'ALREADY_DECIDED' })
    
    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator || !(room.voteResult?.tiedPlayers || []).includes(targetId)) {
      return callback?.({ success: false, error: 'INVALID_TARGET' })
    }
    
    goddess.specialRoleData.used = true
    
    target.eliminated = true
    target.spectator = true
    
    const cascadedPlayers = onElimination(room, target.id) || []
    const newlyEliminated = [target, ...cascadedPlayers]
    
    if (!room.mrWhiteQueue) room.mrWhiteQueue = []
    newlyEliminated.forEach(p => {
      if (p.role === 'MR_WHITE') room.mrWhiteQueue.push(p.id)
    })
    
    room.specialRoleOutcomes = room.specialRoleOutcomes || []
    room.specialRoleOutcomes.push({
      role: 'goddessOfJustice',
      goddessName: goddess.name,
      targetName: target.name,
      message: `GODDESS OF JUSTICE\n${goddess.name} resolved the tie against ${target.name}`
    })
    
    room.voteResult = { tie: false, eliminated: target.id }
    room.eliminationResult = {
      playerId: target.id,
      playerName: target.name,
      role: target.role,
      specialRole: target.specialRole,
      isVoteElimination: true,
      startedAt: Date.now(),
      specialRoleOutcomes: room.specialRoleOutcomes
    }
    room.gamePhase = 'ELIMINATION'
    room.goddessId = null
    broadcastRoom(room)
    
    const hasMrWhite = newlyEliminated.some(p => p.role === 'MR_WHITE')
    const delay = hasMrWhite ? 5000 : 6500
    const version = room.gameVersion
    setTimeout(() => {
      advanceFromElimination(room.id, version)
    }, delay)
    
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
      onGameEnd(room, { winner: room.winner })
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

      const version = room.gameVersion
      setTimeout(() => {
        advanceAfterMrWhiteWrongGuess(room.id, version)
      }, 1800)
    }
    
    callback?.({ success: true })
  })

  function advanceAfterMrWhiteWrongGuess(roomId, expectedVersion) {
    const room = rooms.get(roomId)
    if (!room) return
    if (expectedVersion !== undefined && room.gameVersion !== expectedVersion) return
    room.eliminationResult = null
    room.pendingMrWhiteElimination = null

    if (!evaluateWinCondition(room)) {
      if (room.mrWhiteQueue && room.mrWhiteQueue.length > 0) {
        room.gamePhase = 'ELIMINATION'
        advanceFromElimination(roomId, expectedVersion)
        return
      }

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
  function advanceFromElimination(roomId, expectedVersion) {
    const room = rooms.get(roomId)
    if (!room || room.gamePhase !== 'ELIMINATION') return
    if (expectedVersion !== undefined && room.gameVersion !== expectedVersion) return
    
    const eliminatedId = room.eliminationResult?.playerId
    const eliminatedPlayer = room.players.find((p) => p.id === eliminatedId)
    if (!eliminatedPlayer) return
    
    if (
      eliminatedPlayer.specialRole === 'revenger' && 
      !eliminatedPlayer.specialRoleData?.decisionMade && 
      room.eliminationResult?.isVoteElimination
    ) {
      room.gamePhase = 'REVENGER_DECISION'
      room.revengerId = eliminatedId
      room.revengerDecisionEndsAt = Date.now() + 20000
      room.eliminationResult = null
      
      const version = room.gameVersion
      setTimeout(() => {
        const currentRoom = rooms.get(roomId)
        if (!currentRoom || currentRoom.gamePhase !== 'REVENGER_DECISION' || currentRoom.gameVersion !== version) return
        if (currentRoom.revengerId !== eliminatedId) return
        
        const revenger = currentRoom.players.find(p => p.id === eliminatedId)
        if (!revenger || revenger.specialRoleData?.decisionMade) return
        
        revenger.specialRoleData.decisionMade = true
        revenger.specialRoleData.resolved = true
        
        currentRoom.revengerId = null
        currentRoom.revengerDecisionEndsAt = null
        currentRoom.gamePhase = 'ELIMINATION'
        
        currentRoom.specialRoleOutcomes = currentRoom.specialRoleOutcomes || []
        currentRoom.specialRoleOutcomes.push({
          role: 'revenger',
          revengerName: revenger.name,
          targetName: 'no one',
          message: `REVENGER\n${revenger.name} faded away without taking anyone down`
        })
        
        advanceFromElimination(currentRoom.id, currentRoom.gameVersion)
      }, 20000)
      
      broadcastRoom(room)
      return
    }
    
    if (room.mrWhiteQueue && room.mrWhiteQueue.length > 0) {
      const mrWhiteId = room.mrWhiteQueue.shift()
      const mrWhitePlayer = room.players.find((p) => p.id === mrWhiteId)
      if (mrWhitePlayer) {
        console.log('[ELIMINATION MR_WHITE_GUESS]', { roomId: room.id, player: mrWhiteId })
        room.eliminationResult = {
          ...room.eliminationResult,
          playerId: mrWhiteId,
          playerName: mrWhitePlayer.name,
          role: 'MR_WHITE',
          isMrWhiteGuessing: true,
        }
        room.pendingMrWhiteElimination = room.eliminationResult
        room.gamePhase = 'MR_WHITE_GUESS'
        room.mrWhiteGuesserId = mrWhiteId
        room.mrWhiteLiveGuess = ''
        room.mrWhiteGuessSubmitted = false
        room.votes = {}
        room.lockedVotes = []
      }
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
    disconnectDrawPlayer(currentSessionId)
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

  socket.on('host-make-host', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === currentSessionId) return callback?.({ success: false, error: 'CANNOT_MAKE_SELF_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })
    
    const targetPlayer = room.players.find(p => p.id === targetId)
    if (!targetPlayer) return callback?.({ success: false, error: 'TARGET_NOT_FOUND' })

    const currentHostPlayer = room.players.find(p => p.id === currentSessionId)
    if (currentHostPlayer) currentHostPlayer.isHost = false
    targetPlayer.isHost = true
    room.hostId = targetId

    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('host-kick-player', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === currentSessionId) return callback?.({ success: false, error: 'CANNOT_KICK_SELF' })
    
    const targetIndex = room.players.findIndex(p => p.id === targetId)
    if (targetIndex === -1) return callback?.({ success: false, error: 'TARGET_NOT_FOUND' })

    const targetPlayer = room.players[targetIndex]

    // Remove from active game structures
    room.turnOrder = (room.turnOrder || []).filter(id => id !== targetId)
    room.submittedCluePlayerIds = (room.submittedCluePlayerIds || []).filter(id => id !== targetId)
    
    if (room.votes && room.votes[targetId]) {
      delete room.votes[targetId]
    }
    for (const voterId in room.votes) {
      if (room.votes[voterId] === targetId) delete room.votes[voterId]
    }
    room.lockedVotes = (room.lockedVotes || []).filter(id => id !== targetId)

    if (room.currentTurnPlayerId === targetId) {
      // Advance turn if the kicked player was currently playing
      // Since turnIndex is currently at the kicked player, we can just point to the next player
      // or rather, because we removed them from turnOrder, the next player is now at turnIndex
      if (room.turnIndex < room.turnOrder.length) {
        room.currentTurnPlayerId = room.turnOrder[room.turnIndex]
      } else {
        startVotePhase(room)
      }
    } else {
      // Adjust turnIndex if the kicked player was before the current player
      const originalIndex = room.turnOrder.findIndex(id => id === targetId) // Note: already removed above, this is wrong.
      // Better way: we don't know where they were. We should just re-find the current player's index.
      if (room.currentTurnPlayerId) {
        const newIndex = room.turnOrder.indexOf(room.currentTurnPlayerId)
        if (newIndex !== -1) room.turnIndex = newIndex
      }
    }

    // Completely remove target from room
    room.players.splice(targetIndex, 1)

    // Check win condition if active
    if (room.status === 'ACTIVE' && room.gamePhase !== 'RESULT') {
      evaluateWinCondition(room)
    }

    const targetSocketId = sessionSockets.get(targetId)
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      if (targetSocket) {
        targetSocket.emit('player-kicked')
        targetSocket.leave(currentRoomId)
      }
      sessionSockets.delete(targetId)
    }

    // Adjust config if in lobby
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
