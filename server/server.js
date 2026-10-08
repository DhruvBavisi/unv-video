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
import { generateCodenamesBoard } from './codenames/boardGenerator.js'

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
let initDrawBotManager, addDrawBots, removeDrawBots
if (IS_DEV_BOTS_ENABLED) {
  import('./dev/botManager.js').then(module => {
    initBotManager = module.initBotManager
    addBots = module.addBots
    removeBots = module.removeBots
    initBotManager(process.env.PORT || 3001)
  }).catch(err => {
    console.error('Failed to load bot manager:', err)
  })

  import('./dev/drawBotManager.js').then(module => {
    initDrawBotManager = module.initDrawBotManager
    addDrawBots = module.addDrawBots
    removeDrawBots = module.removeDrawBots
    initDrawBotManager(process.env.PORT || 3001)
  }).catch(err => {
    console.error('Failed to load draw bot manager:', err)
  })
}

const app = express()
app.use(cors())

// Liveness probe for the host (Render healthCheckPath) and uptime checks.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

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
const codenamesRooms = new Map()
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
    skippedCluePlayerIds: room.skippedCluePlayerIds || [],
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
        const isRolePublic = (p.eliminated || room.gamePhase === 'RESULT') ? 
          ((room.gamePhase === 'REVENGER_DECISION' && room.revengerId === p.id) ? false : true) 
          : false;
        
        if (!isRolePublic) return {};

        if (!p.specialRoleData) return {};
        const safeData = { ...p.specialRoleData };
        delete safeData.partnerId;
        delete safeData.partnerName;
        delete safeData.duelId;
        delete safeData.loverId;
        delete safeData.used;
        delete safeData.falafelTargetId;
        delete safeData.usedThisRound;
        delete safeData.resolved;
        delete safeData.decisionMade;
        delete safeData.joyFoolResolved;
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


function getCodenamesPublicState(room) {
  return {
    id: room.id,
    status: room.status,
    phase: room.phase,
    hostId: room.hostId,
    teams: room.teams,
    spymasterSlots: {
      redTaken: !!(room.spymasters && room.spymasters.red),
      blueTaken: !!(room.spymasters && room.spymasters.blue)
    },
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isConnected: p.isConnected,
      team: p.team
    })),
    currentTeam: room.currentTeam,
    startingTeam: room.startingTeam,
    board: room.board ? room.board.map(card => ({
      id: card.id,
      word: card.word,
      revealed: card.revealed,
      category: card.revealed ? card.category : undefined
    })) : undefined
  }
}

function getCodenamesPrivateState(room, playerId) {
  const publicState = getCodenamesPublicState(room)
  const myPlayer = room.players.find(p => p.id === playerId)
  if (myPlayer) {
    const pubPlayer = publicState.players.find(p => p.id === playerId)
    if (pubPlayer) {
      pubPlayer.role = myPlayer.role
    }
    
    if (myPlayer.role === 'SPYMASTER' && room.board) {
      publicState.board = room.board.map(card => ({
        id: card.id,
        word: card.word,
        revealed: card.revealed,
        category: card.category
      }))
    }
  }
  return publicState
}

function broadcastCodenamesRoomState(room) {
  const roomName = \`codenames:${room.id}\`
  const socketsInRoom = io.sockets.adapter.rooms.get(roomName)
  if (!socketsInRoom) return
  
  for (const socketId of socketsInRoom) {
    const socket = io.sockets.sockets.get(socketId)
    if (!socket) continue
    
    let playerId = null
    for (const [sId, sckId] of sessionSockets.entries()) {
      if (sckId === socketId) {
        playerId = sId
        break
      }
    }
    
    if (playerId && room.players.some(p => p.id === playerId)) {
      socket.emit('codenames:room-state', getCodenamesPrivateState(room, playerId))
    } else {
      socket.emit('codenames:room-state', getCodenamesPublicState(room))
    }
  }
}

function findCodenamesRoomByPlayer(sessionId) {
  for (const [roomId, room] of codenamesRooms) {
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
  sessionSockets.set(sessionId, socket.id)
  
  if (oldSocketId && oldSocketId !== socket.id) {
    const oldSocket = io.sockets.sockets.get(oldSocketId)
    if (oldSocket) {
      oldSocket.disconnect(true)
    }
  }
}

function disconnectPlayer(sessionId, socketId) {
  if (socketId && sessionSockets.get(sessionId) !== socketId) {
    return { roomId: null, room: null }
  }

  sessionSockets.delete(sessionId)

  const { roomId, room } = findRoomByPlayer(sessionId)
  if (!room) return { roomId: null, room: null }

  const player = room.players.find((p) => p.id === sessionId)
  if (player) {
    player.isConnected = false
    player.disconnectedAt = Date.now()

    if (room.gamePhase === 'VOTE') {
      checkAndResolveVotes(room)
    } else if (room.gamePhase === 'REVENGER_DECISION' && room.revengerId === sessionId) {
      if (room.revengerDecisionEndsAt) {
        room.revengerDecisionRemainingMs = Math.max(0, room.revengerDecisionEndsAt - Date.now())
        room.revengerDecisionEndsAt = null
      }
    } else if (room.gamePhase === 'GODDESS_DECISION' && room.goddessId === sessionId) {
      if (room.goddessDecisionEndsAt) {
        room.goddessDecisionRemainingMs = Math.max(0, room.goddessDecisionEndsAt - Date.now())
        room.goddessDecisionEndsAt = null
      }
    }
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

function resumeDrawTimersIfDrawer(room, sessionId) {
  if (room.currentDrawerId === sessionId) {
    if (room.phase === 'WORD_CHOICE' && room.wordChoiceRemainingMs !== undefined) {
      scheduleWordChoiceTimeout(room, room.wordChoiceRemainingMs)
      room.wordChoiceRemainingMs = undefined
    } else if (room.phase === 'DRAWING' && room.drawingRemainingMs !== undefined) {
      startDrawingTurn(room, room.selectedWord, true)
      room.drawingRemainingMs = undefined
    }
  }
}

function getSafeStateForPlayer(room, playerId) {
  const isDrawer = room.currentDrawerId === playerId
  const isReveal = room.phase === 'ROUND_REVEAL' || room.phase === 'GAME_RESULT'
  const hasGuessed = room.guessedPlayerIds?.includes(playerId)
  return {
    ...room,
    players: room.players.map(p => ({ ...p })),
    chatMessages: [...(room.chatMessages || [])],
    wordChoices: isDrawer ? room.wordChoices : undefined,
    selectedWord: (isDrawer || isReveal || hasGuessed) ? room.selectedWord : undefined,
    strokes: undefined,
    turnTimeout: undefined,
    hintTimer: undefined,
    playerRecords: undefined
  }
}

function scheduleWordChoiceTimeout(room, durationMs = 15000) {
  const expectedRound = room.round
  const expectedTurnIndex = room.turnIndex
  const expectedDrawerId = room.currentDrawerId
  
  room.wordChoiceEndsAt = Date.now() + durationMs
  
  room.wordChoiceTimeout = setTimeout(() => {
    const currentRoom = drawRooms.get(room.id)
    if (
      currentRoom && 
      currentRoom.phase === 'WORD_CHOICE' && 
      currentRoom.round === expectedRound && 
      currentRoom.turnIndex === expectedTurnIndex &&
      currentRoom.currentDrawerId === expectedDrawerId
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
  }, durationMs)
}

function updateRoomHintString(room) {
  if (!room.selectedWord || !room.hintRevealed) return
  let str = ''
  for (let i = 0; i < room.selectedWord.length; i++) {
    str += room.hintRevealed[i] ? room.selectedWord[i] : '_'
  }
  room.hint = str
}

function startDrawingTurn(room, word, isResume = false) {
  if (room.turnTimeout) { clearTimeout(room.turnTimeout); room.turnTimeout = null; }
  if (room.hintTimer) { clearInterval(room.hintTimer); room.hintTimer = null; }

  if (!isResume) {
    room.selectedWord = word
    room.usedWords = room.usedWords || []
    if (word && !room.usedWords.includes(word.toLowerCase())) {
      room.usedWords.push(word.toLowerCase())
    }
    room.phase = 'DRAWING'
    room.roundStartedAt = Date.now()
    room.strokes = []
    room.guessedPlayerIds = []
    room.turnScores = {}
    room.reactions = {}
    room.hintsGiven = 0
  }
  
  const durationMs = isResume && room.drawingRemainingMs != null ? room.drawingRemainingMs : (room.configuration.drawTimeSec * 1000)
  room.roundEndsAt = Date.now() + durationMs

  // Initialize Hint System
  let numHints = room.configuration.hints ?? 2
  if (word && word.length >= 10) numHints = 3
  const isHidden = typeof room.configuration.gameMode === 'string' && room.configuration.gameMode.toUpperCase() === 'HIDDEN'
  
  if (isHidden || numHints <= 0 || !word) {
    if (!isResume) room.hint = word ? word.replace(/[a-zA-Z0-9]/g, '_') : ''
  } else {
    if (!isResume) {
      room.hintRevealed = new Array(word.length).fill(false)
      const revealIndices = []
      for (let i = 0; i < word.length; i++) {
        if (/[^a-zA-Z0-9]/.test(word[i])) {
          room.hintRevealed[i] = true
        } else {
          revealIndices.push(i)
        }
      }
      for (let i = revealIndices.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [revealIndices[i], revealIndices[j]] = [revealIndices[j], revealIndices[i]];
      }
      room.revealIndices = revealIndices
      room.hintsToGive = Math.min(word.length <= 4 ? 1 : numHints, Math.max(0, revealIndices.length - 1))
    }
    
    if (room.hintsToGive > 0 && room.hintsGiven < room.hintsToGive) {
      const hintsRemaining = room.hintsToGive - room.hintsGiven
      const hintIntervalMs = isResume ? (durationMs / (hintsRemaining + 1)) : ((room.configuration.drawTimeSec * 1000) / (room.hintsToGive + 1))
      const expectedDrawerId = room.currentDrawerId
      room.hintTimer = setInterval(() => {
        if (!drawRooms.has(room.id) || room.phase !== 'DRAWING' || room.currentDrawerId !== expectedDrawerId) {
          return clearInterval(room.hintTimer)
        }
        if (room.hintsGiven >= room.hintsToGive) return clearInterval(room.hintTimer)
        
        const idx = room.revealIndices[room.hintsGiven]
        room.hintRevealed[idx] = true
        room.hintsGiven++
        updateRoomHintString(room)
        broadcastDrawRoomState(room)
      }, hintIntervalMs)
    }
    if (!isResume) updateRoomHintString(room)
  }

  if (!isResume) {
    const drawerPlayer = room.players.find(p => p.id === room.currentDrawerId)
    const drawerName = drawerPlayer ? drawerPlayer.name : 'Someone'
    room.chatMessages = room.chatMessages || []
    room.chatMessages.push({
      id: crypto.randomUUID(),
      type: 'SYSTEM',
      message: `${drawerName} is drawing.`
    })
    if (room.chatMessages.length > 100) room.chatMessages.shift()
  }
  
  broadcastDrawRoomState(room)
  
  if (IS_DEV_BOTS_ENABLED && !isResume) {
    room.players.forEach(p => {
      if (p.isBot) {
        io.to(p.id).emit('draw:dev-secret-word', room.selectedWord)
      }
    })
  }
  
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
  }, durationMs)
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
    if (room.playerRecords && room.playerRecords[room.currentDrawerId]) {
      room.playerRecords[room.currentDrawerId].score = drawerPlayer.score
    }
  }
  
  // Apply guesser points to persistent totals exactly once here
  for (const [pid, pts] of Object.entries(room.turnScores)) {
    if (pid !== room.currentDrawerId) {
      const p = room.players.find(x => x.id === pid)
      if (p) {
        p.score += pts
        if (room.playerRecords && room.playerRecords[pid]) {
          room.playerRecords[pid].score = p.score
        }
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
  
  room.turnSequence = (room.turnSequence || 0) + 1
  const expectedTurnSequence = room.turnSequence
  const expectedRound = room.round
  
  // Schedule next turn
  room.turnTimeout = setTimeout(() => {
    const currentRoom = drawRooms.get(room.id)
    if (currentRoom && currentRoom.phase === 'ROUND_REVEAL' && currentRoom.round === expectedRound && currentRoom.turnSequence === expectedTurnSequence) {
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
        currentRoom.reactions = {}
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
          currentRoom.reactions = {}
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

function disconnectDrawPlayer(sessionId, socketId) {
  if (socketId && sessionSockets.get(sessionId) !== socketId) {
    return
  }

  for (const [rid, dr] of drawRooms) {
    const player = dr.players.find((p) => p.id === sessionId)
    if (player) {
      player.isConnected = false
      player.disconnectedAt = Date.now()

      // Pause drawer timers
      if (dr.currentDrawerId === sessionId) {
        if (dr.phase === 'WORD_CHOICE' && dr.wordChoiceEndsAt) {
          dr.wordChoiceRemainingMs = Math.max(0, dr.wordChoiceEndsAt - Date.now())
          dr.wordChoiceEndsAt = null
          if (dr.wordChoiceTimeout) { clearTimeout(dr.wordChoiceTimeout); dr.wordChoiceTimeout = null }
        } else if (dr.phase === 'DRAWING' && dr.roundEndsAt) {
          dr.drawingRemainingMs = Math.max(0, dr.roundEndsAt - Date.now())
          dr.roundEndsAt = null
          if (dr.turnTimeout) { clearTimeout(dr.turnTimeout); dr.turnTimeout = null }
          if (dr.hintTimer) { clearInterval(dr.hintTimer); dr.hintTimer = null }
        }
      }

      broadcastDrawRoomState(dr)

      break
    }
  }
}

function removeDrawPlayer(sessionId) {
  let foundRoomId = null
  let foundRoom = null
  for (const [rid, dr] of drawRooms) {
    if (dr.players.some(p => p.id === sessionId)) {
      foundRoomId = rid
      foundRoom = dr
      break
    }
  }

  if (!foundRoom) return { roomId: null, room: null }

  const idx = foundRoom.players.findIndex(p => p.id === sessionId)
  if (idx === -1) return { roomId: null, room: null }

  const wasHost = foundRoom.players[idx].isHost
  const isDrawer = foundRoom.currentDrawerId === sessionId
  
  if (foundRoom.currentDrawerId === sessionId) {
    foundRoom.currentDrawerId = null
  }

  const kickedTurnIndex = foundRoom.turnOrder ? foundRoom.turnOrder.indexOf(sessionId) : -1
  if (foundRoom.turnOrder) {
    foundRoom.turnOrder = foundRoom.turnOrder.filter(id => id !== sessionId)
    if (kickedTurnIndex !== -1 && foundRoom.turnIndex !== undefined && kickedTurnIndex <= foundRoom.turnIndex) {
      foundRoom.turnIndex--
    }
  }
  
  foundRoom.players.splice(idx, 1)

  if (foundRoom.guessedPlayerIds) {
    foundRoom.guessedPlayerIds = foundRoom.guessedPlayerIds.filter(id => id !== sessionId)
  }
  if (foundRoom.scores) {
    delete foundRoom.scores[sessionId]
  }
  if (foundRoom.turnScores) {
    delete foundRoom.turnScores[sessionId]
  }

  const realPlayers = foundRoom.players.filter(p => !p.isBot)
  if (realPlayers.length === 0) {
    console.log('[ROOM] destroying empty draw room', { roomId: foundRoomId })
    if (foundRoom.turnTimeout) clearTimeout(foundRoom.turnTimeout)
    if (foundRoom.hintTimer) clearInterval(foundRoom.hintTimer)
    drawRooms.delete(foundRoomId)
    io.to(`draw:${foundRoomId}`).emit('room-closed', { message: 'Room closed — all players left.' })
    return { roomId: foundRoomId, room: null }
  }

  if (isDrawer && (foundRoom.phase === 'WORD_CHOICE' || foundRoom.phase === 'DRAWING')) {
    endDrawRound(foundRoom)
  }

  if (wasHost) {
    const nextHost = foundRoom.players.find(p => p.isConnected && !p.isBot) || foundRoom.players[0]
    if (nextHost) {
      nextHost.isHost = true
      foundRoom.hostId = nextHost.id
    }
  }

  return { roomId: foundRoomId, room: foundRoom }
}

function disconnectCodenamesPlayer(sessionId, socketId) {
  if (socketId && sessionSockets.get(sessionId) !== socketId) return
  const { roomId, room } = findCodenamesRoomByPlayer(sessionId)
  if (!room) return
  const player = room.players.find((p) => p.id === sessionId)
  if (player) player.isConnected = false
  broadcastCodenamesRoomState(room)
}

function removeCodenamesPlayer(sessionId) {
  const { roomId, room } = findCodenamesRoomByPlayer(sessionId)
  if (!room) return { roomId: null, room: null }
  const idx = room.players.findIndex(p => p.id === sessionId)
  if (idx !== -1) {
    const wasHost = room.players[idx].isHost
    room.players.splice(idx, 1)

    if (room.teams) {
      if (room.teams.red) room.teams.red = room.teams.red.filter(id => id !== sessionId)
      if (room.teams.blue) room.teams.blue = room.teams.blue.filter(id => id !== sessionId)
    }
    if (room.spymasters) {
      if (room.spymasters.red === sessionId) room.spymasters.red = null
      if (room.spymasters.blue === sessionId) room.spymasters.blue = null
    }

    const realPlayers = room.players.filter(p => !p.isBot)
    if (realPlayers.length === 0) {
      codenamesRooms.delete(roomId)
      io.to(`codenames:${roomId}`).emit('room-closed', { message: 'Room closed.' })
      return { roomId, room: null }
    }
    if (wasHost && room.players.length > 0) {
      room.players[0].isHost = true
      room.hostId = room.players[0].id
    }
    broadcastCodenamesRoomState(room)
  }
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
  
  cleanupPlayerBeforeRemove(room, sessionId, idx)

  room.players.splice(idx, 1)
  sessionSockets.delete(sessionId)

  cleanupPlayerAfterRemove(room)

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

function cleanupPlayerBeforeRemove(room, targetId, targetIndex) {
  const targetPlayer = room.players[targetIndex]
  const kickedTurnIndex = room.turnOrder ? room.turnOrder.indexOf(targetId) : -1

  // Remove from active game structures
  room.turnOrder = (room.turnOrder || []).filter(id => id !== targetId)
  room.submittedCluePlayerIds = (room.submittedCluePlayerIds || []).filter(id => id !== targetId)
  room.skippedCluePlayerIds = (room.skippedCluePlayerIds || []).filter(id => id !== targetId)
  if (room.mrWhiteQueue) {
    room.mrWhiteQueue = room.mrWhiteQueue.filter(id => id !== targetId)
  }
  
  if (room.votes && room.votes[targetId]) {
    delete room.votes[targetId]
  }
  const affectedVoterIds = []
  for (const voterId in room.votes) {
    if (room.votes[voterId] === targetId) {
      affectedVoterIds.push(voterId)
      delete room.votes[voterId]
    }
  }
  room.lockedVotes = (room.lockedVotes || []).filter(
    id => id !== targetId && !affectedVoterIds.includes(id)
  )

  if (room.gamePhase === 'CLUE') {
    if (room.currentTurnPlayerId === targetId) {
      if (room.turnIndex < room.turnOrder.length) {
        room.currentTurnPlayerId = room.turnOrder[room.turnIndex]
        if (isSilencedByFalafel(room, room.currentTurnPlayerId)) {
          advanceTurn(room)
        }
      } else {
        startVotePhase(room)
      }
    } else {
      if (kickedTurnIndex !== -1 && room.turnIndex !== undefined && kickedTurnIndex < room.turnIndex) {
        room.turnIndex--
      }
    }
  } else if (room.gamePhase === 'MR_WHITE_GUESS' && room.mrWhiteGuesserId === targetId) {
    room.mrWhiteGuessSubmitted = false
    room.mrWhiteLiveGuess = ''
    room.mrWhiteGuesserId = null
    advanceAfterMrWhiteWrongGuess(room.id, room.gameVersion)
  } else if (room.gamePhase === 'REVENGER_DECISION' && room.revengerId === targetId) {
    room.revengerId = null
    room.revengerDecisionEndsAt = null
    room.gamePhase = 'ELIMINATION'
    if (targetPlayer.specialRoleData) {
      targetPlayer.specialRoleData.decisionMade = true
      targetPlayer.specialRoleData.resolved = true
    }
    room.specialRoleOutcomes = room.specialRoleOutcomes || []
    room.specialRoleOutcomes.push({
      role: 'revenger',
      revengerName: targetPlayer.name,
      targetName: 'no one',
      message: `REVENGER\n${targetPlayer.name} faded away without taking anyone down`
    })
    advanceFromElimination(room.id, room.gameVersion)
  } else if (room.gamePhase === 'GODDESS_DECISION') {
    if (room.goddessId === targetId) {
      room.votes = {}
      room.lockedVotes = []
      room.voteResult = null
      room.votingAttempt = (room.votingAttempt || 1) + 1
      room.gamePhase = 'VOTE'
      room.goddessId = null
    } else if (room.voteResult && room.voteResult.tiedPlayers && room.voteResult.tiedPlayers.includes(targetId)) {
      room.voteResult.tiedPlayers = room.voteResult.tiedPlayers.filter(id => id !== targetId)
      if (room.voteResult.tiedPlayers.length === 1) {
        const remainingTargetId = room.voteResult.tiedPlayers[0]
        const remainingTarget = room.players.find(p => p.id === remainingTargetId)
        const goddess = room.players.find(p => p.id === room.goddessId)
        if (remainingTarget && goddess) {
          executeGoddessDecision(room, goddess, remainingTarget)
        }
      } else if (room.voteResult.tiedPlayers.length === 0) {
        room.votes = {}
        room.lockedVotes = []
        room.voteResult = null
        room.votingAttempt = (room.votingAttempt || 1) + 1
        room.gamePhase = 'VOTE'
        room.goddessId = null
      }
    }
  } else if (room.gamePhase === 'ELIMINATION' && room.eliminationResult?.playerId === targetId) {
    room.eliminationResult = null
    advanceFromElimination(room.id, room.gameVersion)
  }
}

function cleanupPlayerAfterRemove(room) {
  if (room.status === 'ACTIVE' && room.gamePhase !== 'RESULT') {
    evaluateWinCondition(room)
  }
  if (room.gamePhase === 'VOTE') {
    checkAndResolveVotes(room)
  }
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

  const falafelMeta = SPECIAL_ROLES.find(r => r.key === 'falafelVendor')
  if (specialRolesConfig.falafelVendor === true || specialRolesConfig.falafelVendor?.enabled === true) {
    if (room.players.length >= falafelMeta.minPlayers) {
      const vendors = assignRole('falafelVendor', 1)
      if (vendors.length > 0) {
        vendors[0].specialRoleData = { usedThisRound: false, falafelTargetId: null }
      }
    }
  }

  const mrMemeMeta = SPECIAL_ROLES.find(r => r.key === 'mrMeme')
  if (specialRolesConfig.mrMeme === true || specialRolesConfig.mrMeme?.enabled === true) {
    if (room.players.length >= mrMemeMeta.minPlayers) {
      const memes = assignRole('mrMeme', 1)
      if (memes.length > 0) {
        memes[0].specialRoleData = { resolved: false }
      }
    }
  }

}

function startCluePhase(room) {
  if (room.gamePhase === 'CLUE') return
  room.gamePhase = 'CLUE'
  room.submittedCluePlayerIds = []
  room.skippedCluePlayerIds = []

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

  room.players.forEach(p => {
    const pSocketId = sessionSockets.get(p.id)
    if (pSocketId) {
      syncPlayerPrivateState(room, p, pSocketId)
    }
  })

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

function isSilencedByFalafel(room, playerId) {
  if (!playerId) return false
  const vendor = room.players.find(p => p.specialRole === 'falafelVendor')
  return vendor && vendor.specialRoleData && vendor.specialRoleData.falafelTargetId === playerId
}

function advanceTurn(room) {
  if (room.currentTurnPlayerId && isSilencedByFalafel(room, room.currentTurnPlayerId)) {
    if (!room.submittedCluePlayerIds?.includes(room.currentTurnPlayerId)) {
      if (!room.skippedCluePlayerIds) room.skippedCluePlayerIds = []
      if (!room.skippedCluePlayerIds.includes(room.currentTurnPlayerId)) {
        room.skippedCluePlayerIds.push(room.currentTurnPlayerId)
      }
      console.log('[CLUE] skipping silenced player', { roomId: room.id, playerId: room.currentTurnPlayerId })
    }
  }

  room.turnIndex++
  if (room.turnIndex < room.turnOrder.length) {
    room.currentTurnPlayerId = room.turnOrder[room.turnIndex]
    
    if (isSilencedByFalafel(room, room.currentTurnPlayerId)) {
      return advanceTurn(room)
    }

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

function syncPlayerPrivateState(room, player, socketOrId) {
  if (!player || !room.wordPair) return
  const targetSocket = typeof socketOrId === 'string' ? io.sockets.sockets.get(socketOrId) : socketOrId
  if (!targetSocket) return

  const roleToReveal = (room.configuration.revealRoles || player.role === 'MR_WHITE') ? player.role : null
  targetSocket.emit('role-assigned', { 
    role: roleToReveal, 
    word: wordForRole(player.role, room.wordPair), 
    specialRole: player.specialRole || null,
    isFalafelTarget: isSilencedByFalafel(room, player.id),
    falafelTargetId: player.specialRole === 'falafelVendor' ? player.specialRoleData?.falafelTargetId : null
  })
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
    let isCodenamesRoom = false
    
    if (!room) {
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
    } else if (isCodenamesRoom) {
      socket.join(`codenames:${roomId}`)
    } else {
      socket.join(roomId)
    }
    
    player.isConnected = true
    player.disconnectedAt = null
    
    if (isDrawRoom) {
      socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'skribbl' })
      console.log('[ROOM] draw session reconnected', { sessionId, roomId })
      resumeDrawTimersIfDrawer(room, sessionId)
      socket.emit('draw:room-state', getSafeStateForPlayer(room, sessionId))
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
      skippedCluePlayerIds: [],
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

  socket.on('join-room', ({ sessionId, roomId, playerName, resumeToken, isBot }, callback) => {
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
      const tokenOk = existing.resumeToken && typeof resumeToken === 'string' && resumeToken === existing.resumeToken
      if (!tokenOk) {
        console.warn('[AUTH] join-room rejected without matching resume token', { sessionId })
        socket.emit('session-expired')
        return
      }

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
        syncPlayerPrivateState(room, existing, socket)
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
        maxPlayers: 20,
        drawTimeSec: 80,
        rounds: 3,
        wordCount: 3,
        hints: 2,
        gameMode: 'NORMAL',
        customWords: '',
        useCustomOnly: false
      },
      usedWords: [],
      playerRecords: {}
    }

    drawRooms.set(roomId, room)
    currentSessionId = sessionId
    socket.join(`draw:${roomId}`)
    socket.join(sessionId) // Join private room for Skribbl direct messaging
    connectPlayer(socket, sessionId)
    
    const player = room.players[0]
    ensureResumeToken(player)
    
    room.playerRecords[sessionId] = {
      playerId: sessionId,
      name: trimmed,
      score: 0,
      resumeToken: player.resumeToken
    }
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'skribbl' })
    
    callback?.({ room: getSafeStateForPlayer(room, sessionId) })
  })

  socket.on('draw:join-room', ({ sessionId, resumeToken, roomId, playerName, isBot }, callback) => {
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    const normalizedId = (roomId || '').trim().toUpperCase()

    const room = drawRooms.get(normalizedId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })

    const existing = room.players.find(p => p.id === sessionId)
    if (existing) {
      if (existing.resumeToken && (typeof resumeToken !== 'string' || resumeToken !== existing.resumeToken)) {
        return callback?.({ error: 'SESSION_EXPIRED' })
      }
      existing.isConnected = true
      existing.name = trimmed
      existing.disconnectedAt = null
      currentSessionId = sessionId
      socket.join(`draw:${normalizedId}`)
      socket.join(sessionId) // Join private room for Skribbl direct messaging
      connectPlayer(socket, sessionId)
      
      if (!existing.resumeToken) ensureResumeToken(existing)
      socket.emit('session-token', { resumeToken: existing.resumeToken, roomId: normalizedId, playerName: existing.name, gameMode: 'skribbl' })
      
      // Resume drawer timers
      resumeDrawTimersIfDrawer(room, sessionId)
      
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
      spectator: false,
      isBot: IS_DEV_BOTS_ENABLED ? !!isBot : false,
      score: 0
    }
    
    const record = room.playerRecords[sessionId]
    if (record) {
      newPlayer.name = record.name
      newPlayer.score = record.score
      newPlayer.resumeToken = record.resumeToken
    }
    
    room.players.push(newPlayer)

    currentSessionId = sessionId
    socket.join(`draw:${normalizedId}`)
    socket.join(sessionId) // Join private room for Skribbl direct messaging
    connectPlayer(socket, sessionId)
    
    ensureResumeToken(newPlayer)
    if (!record) {
      room.playerRecords[sessionId] = {
        playerId: sessionId,
        name: trimmed,
        score: 0,
        resumeToken: newPlayer.resumeToken
      }
    }
    socket.emit('session-token', { resumeToken: newPlayer.resumeToken, roomId: normalizedId, playerName: newPlayer.name, gameMode: 'skribbl' })
    
    callback?.({ room: getSafeStateForPlayer(room, sessionId) })
    broadcastDrawRoomState(room)
  })



  socket.on('draw:leave-room', (callback) => {
    if (!currentSessionId) return callback?.({ error: 'NOT_IN_ROOM' })
    
    let foundRoomId = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        foundRoomId = rid
        break
      }
    }

    if (!foundRoomId) return callback?.({ error: 'NOT_IN_ROOM' })

    const removed = removeDrawPlayer(currentSessionId)
    socket.leave(`draw:${foundRoomId}`)
    socket.leave(currentSessionId) // Cleanup private room
    
    if (removed.room) {
      broadcastDrawRoomState(removed.room)
    }
    
    currentRoomId = null
    currentSessionId = null
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
    // Remove all non-alphanumeric characters, including spaces and hyphens
    return value.toLowerCase().replace(/[^a-z0-9]/gi, '')
  }

  socket.on('draw:reaction', (reactionType) => {
    if (!currentSessionId) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room || room.phase !== 'DRAWING') return

    if (!room.reactions) room.reactions = {}

    // Reject duplicate reactions from the same player for the same drawing turn
    if (room.reactions[currentSessionId]) return

    if (reactionType === 'LIKE' || reactionType === 'DISLIKE') {
      room.reactions[currentSessionId] = reactionType

      const player = room.players.find(p => p.id === currentSessionId)
      if (player) {
        if (!room.chatMessages) room.chatMessages = []
        room.chatMessages.push({
          id: crypto.randomUUID(),
          playerId: currentSessionId,
          playerName: player.name,
          type: 'REACTION',
          reaction: reactionType,
          message: reactionType === 'LIKE' ? `${player.name} liked the drawing` : `${player.name} disliked the drawing`
        })
        if (room.chatMessages.length > 100) room.chatMessages.shift()
      }

      broadcastDrawRoomState(room)
    }
  })

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
      
      const eligiblePlayersCount = room.turnOrder 
        ? Math.max(0, room.turnOrder.length - 1) 
        : room.players.filter(p => !p.spectator && p.id !== room.currentDrawerId).length
        
      const isEarlyFinish = room.guessedPlayerIds.length >= eligiblePlayersCount
      
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
    room.reactions = {}
    
    room.players.forEach(p => {
      p.spectator = false
    })

    io.to(`draw:${room.id}`).emit('draw:clear-canvas')
    
    broadcastDrawRoomState(room)
    callback?.({ success: true })
  })

  socket.on('draw:make-host', ({ targetId }, callback) => {
    if (!currentSessionId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    if (targetId === currentSessionId) return callback?.({ error: 'CANNOT_TARGET_SELF' })
    
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ error: 'NOT_HOST' })
    
    const targetPlayer = room.players.find(p => p.id === targetId)
    if (!targetPlayer) return callback?.({ error: 'TARGET_NOT_FOUND' })

    const requester = room.players.find(p => p.id === currentSessionId)
    targetPlayer.isHost = true
    if (requester) requester.isHost = false
    room.hostId = targetId

    broadcastDrawRoomState(room)
    callback?.({ success: true })
  })

  socket.on('draw:kick-player', ({ targetId }, callback) => {
    if (!currentSessionId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    if (targetId === currentSessionId) return callback?.({ error: 'CANNOT_TARGET_SELF' })
    
    let room = null
    let roomId = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        roomId = rid
        break
      }
    }
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ error: 'NOT_HOST' })
    
    const targetIndex = room.players.findIndex(p => p.id === targetId)
    if (targetIndex === -1) return callback?.({ error: 'TARGET_NOT_FOUND' })

    io.to(targetId).emit('draw:kicked')
    
    const removed = removeDrawPlayer(targetId)

    const targetSocketId = sessionSockets.get(targetId)
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      if (targetSocket) {
        targetSocket.leave(`draw:${roomId}`)
      }
    }

    if (removed.room) {
      const activeRealPlayers = removed.room.players.filter(p => !p.spectator)
      if (removed.room.phase !== 'LOBBY' && removed.room.phase !== 'GAME_RESULT' && activeRealPlayers.length <= 1) {
         removed.room.phase = 'GAME_RESULT'
         if (removed.room.turnTimeout) clearTimeout(removed.room.turnTimeout)
         if (removed.room.hintTimer) clearInterval(removed.room.hintTimer)
      }
      broadcastDrawRoomState(removed.room)
    }
    callback?.({ success: true })
  })

  socket.on('draw:add-dev-bots', (callback) => {
    if (!IS_DEV_BOTS_ENABLED) return callback?.({ error: 'DEV_BOTS_DISABLED' })
    if (!currentSessionId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ error: 'NOT_HOST' })
    if (room.phase !== 'LOBBY') return callback?.({ error: 'GAME_IN_PROGRESS' })

    const botCount = room.players.filter(p => p.isBot).length
    if (botCount >= 4) return callback?.({ error: '4 development bots are already in this room.' })
    
    const availableSlots = room.configuration.maxPlayers - room.players.length
    if (availableSlots < 4) return callback?.({ error: `Only ${availableSlots} slots available. Cannot add 4 bots.` })
    
    addDrawBots(room.id, 4)
    callback?.({ success: true })
  })

  socket.on('draw:remove-dev-bots', (callback) => {
    if (!IS_DEV_BOTS_ENABLED) return callback?.({ error: 'DEV_BOTS_DISABLED' })
    if (!currentSessionId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ error: 'NOT_HOST' })
    if (room.phase !== 'LOBBY') return callback?.({ error: 'GAME_IN_PROGRESS' })

    removeDrawBots(room.id)

    // Remove bots from the room players array
    room.players = room.players.filter(p => !p.isBot)

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

      room.gameVersion = (room.gameVersion || 0) + 1

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
      room.skippedCluePlayerIds = []
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
    room.skippedCluePlayerIds = []
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
        syncPlayerPrivateState(room, p, pSocketId)
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
    room.skippedCluePlayerIds = []
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

    room.gameVersion = (room.gameVersion || 0) + 1

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
      const socketId = sessionSockets.get(p.id)
      if (socketId) {
        syncPlayerPrivateState(room, p, socketId)
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

    if (room.skippedCluePlayerIds && room.skippedCluePlayerIds.includes(currentSessionId)) {
      return callback?.({ success: false, error: 'SILENCED_BY_FALAFEL' })
    }

    if (player.eliminated || player.spectator) {
      return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    }

    if (isSilencedByFalafel(room, currentSessionId)) {
      return callback?.({ success: false, error: 'SILENCED_BY_FALAFEL' })
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

  socket.on('unv:give-falafel', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(currentRoomId)
    if (!room || room.gamePhase !== 'CLUE') return callback?.({ success: false, error: 'NOT_CLUE_PHASE' })

    const vendor = room.players.find(p => p.id === currentSessionId)
    if (!vendor || vendor.specialRole !== 'falafelVendor') return callback?.({ success: false, error: 'NOT_VENDOR' })
    if (vendor.eliminated || vendor.spectator) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    if (vendor.specialRoleData?.usedThisRound) return callback?.({ success: false, error: 'ALREADY_USED' })

    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator || targetId === currentSessionId) {
      return callback?.({ success: false, error: 'INVALID_TARGET' })
    }

    vendor.specialRoleData.usedThisRound = true
    vendor.specialRoleData.falafelTargetId = targetId

    // Send updated private state to Vendor
    const vendorSocketId = sessionSockets.get(currentSessionId)
    if (vendorSocketId) {
      syncPlayerPrivateState(room, vendor, vendorSocketId)
    }

    // Send updated private state to Target
    const targetSocketId = sessionSockets.get(targetId)
    if (targetSocketId) {
      syncPlayerPrivateState(room, target, targetSocketId)
    }

    if (room.currentTurnPlayerId === targetId) {
      advanceTurn(room)
    } else {
      broadcastRoom(room)
    }
    callback?.({ success: true })
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

    if (isSilencedByFalafel(room, currentSessionId)) {
      return callback?.({ success: false, error: 'SILENCED_BY_FALAFEL' })
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
      if (!(ghostSpec || (!p.eliminated && !p.spectator))) return false
      return true
    })
    
    const votingComplete = room.lockedVotes.length >= eligibleVoters.length
    if (votingComplete) {
      checkAndResolveVotes(room)
    } else {
      broadcastRoom(room)
    }
    
    callback?.({ success: true })
  })

  function checkAndResolveVotes(room) {
    if (room.gamePhase !== 'VOTE') return
    
    const eligibleVoters = room.players.filter((p) => {
      if (p.status !== 'PLAYING') return false
      const ghostSpec = p.eliminated === true && p.specialRole === 'ghost'
      if (!(ghostSpec || (!p.eliminated && !p.spectator))) return false
      return true
    })
    
    const votingComplete = room.lockedVotes.length >= eligibleVoters.length
    if (!votingComplete) return
    
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
        
        room.goddessDecisionEndsAt = Date.now() + 15000
        scheduleGoddessTimeout(room.id, goddess.id, 15000)
      } else {
        // No special-role decision is required: immediately start the next vote attempt.
        room.votes = {}
        room.lockedVotes = []
        room.voteResult = null
        room.votingAttempt = (room.votingAttempt || 1) + 1
        room.gamePhase = 'VOTE'
      }
      broadcastRoom(room)
    }
  }

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
    
    executeGoddessDecision(room, goddess, target)
    callback?.({ success: true })
  })

  function executeGoddessDecision(room, goddess, target) {
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
  }

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
      room.votes = {}
      room.lockedVotes = []
      room.voteResult = null
      room.eliminationResult = null
      
      startCluePhase(room)
    }
    broadcastRoom(room)
  }

  function scheduleGoddessTimeout(roomId, goddessId, durationMs) {
    const room = rooms.get(roomId)
    if (!room) return
    const version = room.gameVersion
    setTimeout(() => {
      const currentRoom = rooms.get(roomId)
      if (!currentRoom || currentRoom.gamePhase !== 'GODDESS_DECISION' || currentRoom.gameVersion !== version) return
      if (currentRoom.goddessId !== goddessId) return
      
      const currentGoddess = currentRoom.players.find(p => p.id === goddessId)
      if (!currentGoddess || !currentGoddess.isConnected) return
      
      if (currentGoddess.specialRoleData) {
        currentGoddess.specialRoleData.used = true
      }
      
      currentRoom.votes = {}
      currentRoom.lockedVotes = []
      currentRoom.voteResult = null
      currentRoom.votingAttempt = (currentRoom.votingAttempt || 1) + 1
      currentRoom.gamePhase = 'VOTE'
      currentRoom.goddessId = null
      broadcastRoom(currentRoom)
    }, durationMs)
  }

  function scheduleRevengerTimeout(roomId, eliminatedId, durationMs) {
    const room = rooms.get(roomId)
    if (!room) return
    const version = room.gameVersion
    setTimeout(() => {
      const currentRoom = rooms.get(roomId)
      if (!currentRoom || currentRoom.gamePhase !== 'REVENGER_DECISION' || currentRoom.gameVersion !== version) return
      if (currentRoom.revengerId !== eliminatedId) return
      
      const revenger = currentRoom.players.find(p => p.id === eliminatedId)
      if (!revenger || !revenger.isConnected || revenger.specialRoleData?.decisionMade) return
      
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
    }, durationMs)
  }

  // Auto-advances from ELIMINATION phase. Called via timeout.
  function advanceFromElimination(roomId, expectedVersion) {
    const room = rooms.get(roomId)
    if (!room || room.gamePhase !== 'ELIMINATION') return
    if (expectedVersion !== undefined && room.gameVersion !== expectedVersion) return
    
    const eliminatedId = room.eliminationResult?.playerId
    const eliminatedPlayer = room.players.find((p) => p.id === eliminatedId)
    
    if (
      eliminatedPlayer &&
      eliminatedPlayer.specialRole === 'revenger' && 
      !eliminatedPlayer.specialRoleData?.decisionMade && 
      room.eliminationResult?.isVoteElimination
    ) {
      room.gamePhase = 'REVENGER_DECISION'
      room.revengerId = eliminatedId
      room.revengerDecisionEndsAt = Date.now() + 20000
      room.eliminationResult = null
      scheduleRevengerTimeout(roomId, eliminatedId, 20000)
      
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
      } else {
        advanceFromElimination(roomId, expectedVersion)
        return
      }
    } else {
      if (!evaluateWinCondition(room)) {
        const active = getActivePlayers(room)
        console.log('[ELIMINATION NEXT]', { roomId: room.id, round: room.round + 1, activePlayers: active.length })
        room.round++
        room.votes = {}
        room.lockedVotes = []
        room.voteResult = null
        room.eliminationResult = null
        
        startCluePhase(room)
      } else {
        room.eliminationResult = null
      }
    }
    broadcastRoom(room)
  }

  socket.on('disconnect', () => {
    if (!currentSessionId) return
    disconnectPlayer(currentSessionId, socket.id)
    disconnectDrawPlayer(currentSessionId, socket.id)
    disconnectCodenamesPlayer(currentSessionId, socket.id)
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
    
    cleanupPlayerBeforeRemove(room, targetId, targetIndex)

    // Completely remove target from room
    room.players.splice(targetIndex, 1)

    cleanupPlayerAfterRemove(room)

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

  socket.on('codenames:create-room', ({ sessionId: reqSessionId, playerName }, callback) => {
    if (!reqSessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    if (!/^[\p{L}\p{N} .'-]{2,24}$/u.test(trimmed)) {
      return callback?.({ error: 'INVALID_NAME_FORMAT' })
    }

    const existing = findCodenamesRoomByPlayer(reqSessionId)
    if (existing.room) {
      return callback?.({ error: 'ALREADY_IN_ROOM' })
    }

    let roomId = makeRoomId()
    while (rooms.has(roomId) || drawRooms.has(roomId) || codenamesRooms.has(roomId)) roomId = makeRoomId()

    const sessionId = reqSessionId
    currentSessionId = sessionId
    
    const room = {
      id: roomId,
      hostId: sessionId,
      players: [{
        id: sessionId,
        name: trimmed,
        isHost: true,
        isConnected: true,
        team: null,
        role: null
      }],
      status: 'LOBBY',
      gameMode: 'codenames',
      teams: { red: [], blue: [] },
      spymasters: { red: null, blue: null },
      board: [],
      currentTeam: null,
      phase: 'LOBBY'
    }
    
    room.players[0].resumeToken = ensureResumeToken(room.players[0])
    
    codenamesRooms.set(roomId, room)
    currentRoomId = roomId
    connectPlayer(socket, sessionId)
    socket.join(`codenames:${roomId}`)
    
    socket.emit('session-token', { resumeToken: room.players[0].resumeToken, roomId, playerName: trimmed, gameMode: 'codenames' })
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:join-room', ({ sessionId: reqSessionId, playerName, roomId, resumeToken }, callback) => {
    if (!reqSessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    if (!/^[\p{L}\p{N} .'-]{2,24}$/u.test(trimmed)) {
      return callback?.({ error: 'INVALID_NAME_FORMAT' })
    }

    const existing = findCodenamesRoomByPlayer(reqSessionId)
    if (existing.room && existing.roomId !== roomId) {
      return callback?.({ error: 'ALREADY_IN_ANOTHER_ROOM' })
    }

    const room = codenamesRooms.get(roomId)
    if (!room) {
      return callback?.({ error: 'ROOM_NOT_FOUND' })
    }
    if (room.status !== 'LOBBY') {
      const playerExists = room.players.some(p => p.id === reqSessionId)
      if (!playerExists) {
        return callback?.({ error: 'GAME_IN_PROGRESS' })
      }
    }
    
    let sessionId = reqSessionId
    currentSessionId = sessionId
    let player = room.players.find(p => p.id === sessionId)
    
    if (!player) {
      if (room.players.length >= 20) {
        return callback?.({ error: 'ROOM_FULL' })
      }
      player = {
        id: sessionId,
        name: trimmed,
        isHost: room.players.length === 0,
        isConnected: true,
        team: null,
        role: null
      }
      player.resumeToken = ensureResumeToken(player)
      room.players.push(player)
    } else {
      const tokenOk = player.resumeToken && typeof resumeToken === 'string' && resumeToken === player.resumeToken
      if (!tokenOk) {
        console.warn('[AUTH] codenames:join-room rejected without matching resume token', { sessionId: reqSessionId })
        socket.emit('session-expired')
        return callback?.({ error: 'SESSION_EXPIRED' })
      }
      player.isConnected = true
    }
    
    currentRoomId = roomId
    connectPlayer(socket, sessionId)
    socket.join(`codenames:${roomId}`)
    
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'codenames' })
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:host-make-host', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(currentRoomId)
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

    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:host-kick-player', ({ targetId }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === currentSessionId) return callback?.({ success: false, error: 'CANNOT_KICK_SELF' })
    
    const targetIndex = room.players.findIndex(p => p.id === targetId)
    if (targetIndex === -1) return callback?.({ success: false, error: 'TARGET_NOT_FOUND' })

    room.players.splice(targetIndex, 1)

    if (room.teams) {
      if (room.teams.red) room.teams.red = room.teams.red.filter(id => id !== targetId)
      if (room.teams.blue) room.teams.blue = room.teams.blue.filter(id => id !== targetId)
    }
    if (room.spymasters) {
      if (room.spymasters.red === targetId) room.spymasters.red = null
      if (room.spymasters.blue === targetId) room.spymasters.blue = null
    }

    const targetSocketId = sessionSockets.get(targetId)
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      if (targetSocket) {
        targetSocket.emit('player-kicked')
        targetSocket.leave(`codenames:${currentRoomId}`)
      }
      sessionSockets.delete(targetId)
    }

    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:leave-room', () => {
    if (currentSessionId) {
      removeCodenamesPlayer(currentSessionId)
      socket.leave(`codenames:${currentRoomId}`)
      currentRoomId = null
    }
  })

  socket.on('codenames:select-team', ({ team }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'LOBBY') return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })
    if (team !== 'red' && team !== 'blue' && team !== null) return callback?.({ success: false, error: 'INVALID_TEAM' })

    const player = room.players.find(p => p.id === currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })

    // Remove from old team
    if (player.team && room.teams[player.team]) {
      room.teams[player.team] = room.teams[player.team].filter(id => id !== currentSessionId)
      // Free spymaster slot if they had it
      if (room.spymasters[player.team] === currentSessionId) {
        room.spymasters[player.team] = null
      }
    }

    player.team = team
    if (team) {
      if (!room.teams[team]) room.teams[team] = []
      room.teams[team].push(currentSessionId)
      // When joining a team, default to OPERATIVE if no role, or reset to OPERATIVE
      player.role = 'OPERATIVE'
    } else {
      player.role = null
    }

    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:select-role', ({ role }, callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'LOBBY') return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })
    if (role !== 'SPYMASTER' && role !== 'OPERATIVE') return callback?.({ success: false, error: 'INVALID_ROLE' })

    const player = room.players.find(p => p.id === currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    if (!player.team) return callback?.({ success: false, error: 'NO_TEAM_SELECTED' })

    if (role === 'SPYMASTER') {
      if (room.spymasters[player.team] && room.spymasters[player.team] !== currentSessionId) {
        return callback?.({ success: false, error: 'SPYMASTER_TAKEN' })
      }
      room.spymasters[player.team] = currentSessionId
    } else {
      if (room.spymasters[player.team] === currentSessionId) {
        room.spymasters[player.team] = null
      }
    }

    player.role = role
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:start-game', (callback) => {
    if (!currentSessionId || !currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })

    if (!room.teams.red || room.teams.red.length === 0) return callback?.({ success: false, error: 'RED_TEAM_EMPTY' })
    if (!room.teams.blue || room.teams.blue.length === 0) return callback?.({ success: false, error: 'BLUE_TEAM_EMPTY' })

    if (!room.spymasters.red) return callback?.({ success: false, error: 'RED_SPYMASTER_MISSING' })
    if (!room.spymasters.blue) return callback?.({ success: false, error: 'BLUE_SPYMASTER_MISSING' })

    const unassigned = room.players.find(p => !p.team || !p.role)
    if (unassigned) return callback?.({ success: false, error: 'UNASSIGNED_PLAYERS' })

    room.startingTeam = Math.random() < 0.5 ? 'red' : 'blue'
    room.currentTeam = room.startingTeam
    room.board = generateCodenamesBoard(room.startingTeam)

    room.status = 'PLAYING'
    room.phase = 'BOARD_READY'

    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

})

const PORT = process.env.PORT || 3001
httpServer.listen(PORT, () => {
  console.log(`UNDERCOVER server running on port ${PORT}`)
  console.log(`CORS allowed origin: ${allowedOrigin}`)
})
