import { MAX_CLUE_LENGTH, MAX_CHAT_LENGTH } from '../../../shared/game-limits.js';
import { sessionSockets, connectPlayer, ensureResumeToken } from '../../shared/sessionRegistry.js';
import { makeRoomId, shuffle } from '../../shared/utils.js';
import { SPECIAL_ROLES } from '../../../src/games/undercover/data/specialRoles.js';
import {
  rooms,
  WORD_PAIRS,
  getNextClueId,
  getNextChatId,
  nextClueId,
  nextChatId,
  validateConfig,
  getDefaultConfig,
  getPublicRoomState,
  findRoomByPlayer,
  broadcastRoom,
  disconnectPlayer,
  removePlayer,
  cleanupPlayerBeforeRemove,
  cleanupPlayerAfterRemove,
  checkAndDestroyEmptyRoom,
  getActivePlayers,
  evaluateWinCondition,
  assignSpecialRoles,
  startCluePhase,
  startVotePhase,
  isSilencedByFalafel,
  advanceTurn,
  assignWords,
  wordForRole,
  syncPlayerPrivateState,
  reassignHostIfNeeded,
  checkAndResolveVotes,
  executeGoddessDecision,
  advanceAfterMrWhiteWrongGuess,
  scheduleGoddessTimeout,
  scheduleRevengerTimeout,
  advanceFromElimination
} from './undercoverState.js';

export function registerUndercoverHandlers(io, socket, socketState, context) {
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
    socketState.currentSessionId = sessionId
    socketState.currentRoomId = roomId
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
      socketState.currentSessionId = sessionId
      socketState.currentRoomId = normalizedId
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
      isBot: (context?.devBots?.isEnabled ?? (process.env.DEV_BOTS_ENABLED === "true")) ? !!isBot : false,
      resumeToken: crypto.randomUUID(),
    })

    socketState.currentSessionId = sessionId
    socketState.currentRoomId = normalizedId
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
    if (!socketState.currentSessionId) {
      return callback?.({ error: 'NOT_IN_ROOM' })
    }

    const { roomId, room } = findRoomByPlayer(socketState.currentSessionId)
    if (!room) {
      socketState.currentRoomId = null
      return callback?.({ error: 'NOT_IN_ROOM' })
    }

    const removed = removePlayer(socketState.currentSessionId)
    socketState.currentRoomId = null

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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'ACTIVE' || room.gamePhase !== 'RESULT') return callback?.({ success: false, error: 'GAME_NOT_ENDED' })

    const player = room.players.find(p => p.id === socketState.currentSessionId)
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return
    const player = room.players.find((p) => p.id === socketState.currentSessionId)
    if (!player || player.isHost) return
    player.status = player.status === 'READY' ? 'JOINED' : 'READY'
    broadcastRoom(room)
  })

  socket.on('update-config', (config) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return
    if (room.hostId !== socketState.currentSessionId) return
    
    const hostPlayer = room.players.find(p => p.id === socketState.currentSessionId)
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return
    if (room.hostId !== socketState.currentSessionId) return
    
    const hostPlayer = room.players.find(p => p.id === socketState.currentSessionId)
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'NOT_IN_ROOM' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'NOT_IN_ROOM' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return
    if (room.hostId !== socketState.currentSessionId) return
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return
    if (room.hostId !== socketState.currentSessionId) return
    if (room.status !== 'ACTIVE') return

    startCluePhase(room)
  })

  socket.on('host-skip-clue-round', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status !== 'ACTIVE' || room.gamePhase !== 'CLUE') return callback?.({ success: false, error: 'INVALID_PHASE' })

    startVotePhase(room)
    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('host-revote', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    const room = rooms.get(socketState.currentRoomId)
    if (!room) {
      return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    }

    const player = room.players.find((p) => p.id === socketState.currentSessionId)
    if (!player) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    if (room.gamePhase !== 'CLUE') {
      return callback?.({ success: false, error: 'CLUE_PHASE_NOT_ACTIVE' })
    }

    if (room.currentTurnPlayerId !== socketState.currentSessionId) {
      return callback?.({ success: false, error: 'NOT_YOUR_TURN' })
    }

    if (room.submittedCluePlayerIds.includes(socketState.currentSessionId)) {
      return callback?.({ success: false, error: 'CLUE_ALREADY_SUBMITTED' })
    }

    if (room.skippedCluePlayerIds && room.skippedCluePlayerIds.includes(socketState.currentSessionId)) {
      return callback?.({ success: false, error: 'SILENCED_BY_FALAFEL' })
    }

    if (player.eliminated || player.spectator) {
      return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    }

    if (isSilencedByFalafel(room, socketState.currentSessionId)) {
      return callback?.({ success: false, error: 'SILENCED_BY_FALAFEL' })
    }

    const clue = String(rawClue || '').trim()

    if (!clue) {
      return callback?.({ success: false, error: 'EMPTY_CLUE' })
    }

    if (clue.length > MAX_CLUE_LENGTH) {
      return callback?.({ success: false, error: 'CLUE_TOO_LONG' })
    }

    
    const clueRecord = {
      id: getNextClueId(),
      roundNumber: room.round,
      playerId: socketState.currentSessionId,
      playerName: player.name,
      text: clue,
      submittedAt: Date.now(),
      turnIndex: room.turnIndex,
    }

    room.clues.push(clueRecord)
    room.submittedCluePlayerIds.push(socketState.currentSessionId)

    console.log('[CLUE] submitted', {
      roomId: room.id,
      playerId: socketState.currentSessionId,
      playerName: player.name,
      clue: clue,
      turnIndex: room.turnIndex,
    })

    callback?.({ success: true })

    advanceTurn(room)
  })

  socket.on('unv:give-falafel', ({ targetId }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'CLUE') return callback?.({ success: false, error: 'NOT_CLUE_PHASE' })

    const vendor = room.players.find(p => p.id === socketState.currentSessionId)
    if (!vendor || vendor.specialRole !== 'falafelVendor') return callback?.({ success: false, error: 'NOT_VENDOR' })
    if (vendor.eliminated || vendor.spectator) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    if (vendor.specialRoleData?.usedThisRound) return callback?.({ success: false, error: 'ALREADY_USED' })

    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator || targetId === socketState.currentSessionId) {
      return callback?.({ success: false, error: 'INVALID_TARGET' })
    }

    vendor.specialRoleData.usedThisRound = true
    vendor.specialRoleData.falafelTargetId = targetId

    // Send updated private state to Vendor
    const vendorSocketId = sessionSockets.get(socketState.currentSessionId)
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) {
      return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    }

    const room = rooms.get(socketState.currentRoomId)
    if (!room) {
      return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    }

    const player = room.players.find((p) => p.id === socketState.currentSessionId)
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

    if (isSilencedByFalafel(room, socketState.currentSessionId)) {
      return callback?.({ success: false, error: 'SILENCED_BY_FALAFEL' })
    }

    const text = String(rawText || '').trim()

    if (!text) {
      return callback?.({ success: false, error: 'EMPTY_MESSAGE' })
    }

    if (text.length > MAX_CHAT_LENGTH) {
      return callback?.({ success: false, error: 'MESSAGE_TOO_LONG' })
    }

    
    const message = {
      id: getNextChatId(),
      playerId: socketState.currentSessionId,
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

    io.to(socketState.currentRoomId).emit('chat-message', {
      id: message.id,
      playerId: message.playerId,
      playerName: message.playerName,
      text: message.text,
      sentAt: message.sentAt,
    })
  })

  socket.on('select-vote', ({ targetId }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })
    
    const player = room.players.find((p) => p.id === socketState.currentSessionId)
    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!player || (!isGhostSpectator && (player.eliminated || player.spectator))) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    
    if (room.lockedVotes.includes(socketState.currentSessionId)) return callback?.({ success: false, error: 'VOTE_ALREADY_LOCKED' })
    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator) return callback?.({ success: false, error: 'INVALID_TARGET' })

    if (socketState.currentSessionId === targetId) return callback?.({ success: false, error: 'SELF_VOTING_NOT_ALLOWED' })

    if (room.votes[socketState.currentSessionId] === targetId) {
      delete room.votes[socketState.currentSessionId]
    } else {
      room.votes[socketState.currentSessionId] = targetId
    }
    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('lock-vote', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })
    
    const player = room.players.find((p) => p.id === socketState.currentSessionId)
    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!player || (!isGhostSpectator && (player.eliminated || player.spectator))) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    
    if (room.lockedVotes.includes(socketState.currentSessionId)) return callback?.({ success: false, error: 'VOTE_ALREADY_LOCKED' })
    if (!room.votes[socketState.currentSessionId]) return callback?.({ success: false, error: 'NO_VOTE_SELECTED' })

    room.lockedVotes.push(socketState.currentSessionId)
    
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

  socket.on('unlock-vote', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'VOTE') return callback?.({ success: false, error: 'NOT_VOTE_PHASE' })

    const player = room.players.find((p) => p.id === socketState.currentSessionId)
    const isGhostSpectator = player?.eliminated === true && player?.specialRole === 'ghost'
    if (!player || (!isGhostSpectator && (player.eliminated || player.spectator))) return callback?.({ success: false, error: 'NOT_ACTIVE_PLAYER' })
    if (!room.lockedVotes.includes(socketState.currentSessionId)) return callback?.({ success: false, error: 'VOTE_NOT_LOCKED' })

    room.lockedVotes = room.lockedVotes.filter((id) => id !== socketState.currentSessionId)
    broadcastRoom(room)
    callback?.({ success: true })
  })

  // Mr White sends live typing updates while guessing
  socket.on('mr-white-live-guess', ({ text }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'MR_WHITE_GUESS') return callback?.({ success: false, error: 'NOT_MR_WHITE_GUESS_PHASE' })
    if (socketState.currentSessionId !== room.mrWhiteGuesserId) return callback?.({ success: false, error: 'NOT_MR_WHITE' })
    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player || player.role !== 'MR_WHITE') return callback?.({ success: false, error: 'INVALID_ROLE' })
    if (room.mrWhiteGuessSubmitted) return callback?.({ success: false, error: 'ALREADY_SUBMITTED' })
    const sanitized = String(text || '').slice(0, 40)
    room.mrWhiteLiveGuess = sanitized
    io.to(socketState.currentRoomId).emit('mr-white-live-guess-update', { text: sanitized })
    callback?.({ success: true })
  })

  // Revenger selects target to eliminate
  socket.on('submit-revenger-decision', ({ targetId }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'REVENGER_DECISION') return callback?.({ success: false })
    
    if (socketState.currentSessionId !== room.revengerId) return callback?.({ success: false, error: 'NOT_REVENGER' })
    const revenger = room.players.find(p => p.id === socketState.currentSessionId)
    if (!revenger || revenger.specialRole !== 'revenger') return callback?.({ success: false })
    if (revenger.specialRoleData?.decisionMade) return callback?.({ success: false, error: 'ALREADY_DECIDED' })
    
    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator || targetId === socketState.currentSessionId) {
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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'GODDESS_DECISION') return callback?.({ success: false })
    
    if (socketState.currentSessionId !== room.goddessId) return callback?.({ success: false, error: 'NOT_GODDESS' })
    const goddess = room.players.find(p => p.id === socketState.currentSessionId)
    if (!goddess || goddess.specialRole !== 'goddessOfJustice') return callback?.({ success: false })
    if (goddess.specialRoleData?.used) return callback?.({ success: false, error: 'ALREADY_DECIDED' })
    
    const target = room.players.find(p => p.id === targetId)
    if (!target || target.eliminated || target.spectator || !(room.voteResult?.tiedPlayers || []).includes(targetId)) {
      return callback?.({ success: false, error: 'INVALID_TARGET' })
    }
    
    executeGoddessDecision(room, goddess, target)
    callback?.({ success: true })
  })

  socket.on('submit-mr-white-guess', ({ guess }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room || room.gamePhase !== 'MR_WHITE_GUESS') return callback?.({ success: false, error: 'NOT_MR_WHITE_GUESS_PHASE' })
    if (room.mrWhiteGuessSubmitted) return callback?.({ success: false, error: 'ALREADY_SUBMITTED' })
    
    if (socketState.currentSessionId !== room.mrWhiteGuesserId) return callback?.({ success: false, error: 'NOT_MR_WHITE' })
    
    const player = room.players.find(p => p.id === socketState.currentSessionId)
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
      
      const systemMessage = {
        id: getNextChatId(),
        playerId: 'system',
        playerName: 'System',
        text: "MR. WHITE'S GUESS WAS INCORRECT. The investigation continues.",
        sentAt: Date.now()
      }
      room.chat.push(systemMessage)
      io.to(socketState.currentRoomId).emit('chat-message', systemMessage)

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

  socket.on('add-dev-bots', (callback) => {
    if (!(context?.devBots?.isEnabled ?? (process.env.DEV_BOTS_ENABLED === "true"))) return callback?.({ error: 'DEV_BOTS_DISABLED' })
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ error: 'NOT_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ error: 'GAME_IN_PROGRESS' })

    const botCount = room.players.filter(p => p.isBot).length
    if (botCount >= 4) return callback?.({ error: '4 development bots are already in this room.' })
    
    const availableSlots = 20 - room.players.length
    if (availableSlots < 4) return callback?.({ error: `Only ${availableSlots} slots available. Cannot add 4 bots.` })
    
    context?.devBots?.addBots?.(socketState.currentRoomId, 4)
    callback?.({ success: true })
  })

  socket.on('remove-dev-bots', (callback) => {
    if (!(context?.devBots?.isEnabled ?? (process.env.DEV_BOTS_ENABLED === "true"))) return callback?.({ error: 'DEV_BOTS_DISABLED' })
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ error: 'NOT_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ error: 'GAME_IN_PROGRESS' })

    context?.devBots?.removeBots?.(socketState.currentRoomId)

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
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === socketState.currentSessionId) return callback?.({ success: false, error: 'CANNOT_MAKE_SELF_HOST' })
    if (room.status !== 'LOBBY') return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })
    
    const targetPlayer = room.players.find(p => p.id === targetId)
    if (!targetPlayer) return callback?.({ success: false, error: 'TARGET_NOT_FOUND' })

    const currentHostPlayer = room.players.find(p => p.id === socketState.currentSessionId)
    if (currentHostPlayer) currentHostPlayer.isHost = false
    targetPlayer.isHost = true
    room.hostId = targetId

    broadcastRoom(room)
    callback?.({ success: true })
  })

  socket.on('host-kick-player', ({ targetId }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = rooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === socketState.currentSessionId) return callback?.({ success: false, error: 'CANNOT_KICK_SELF' })
    
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
        targetSocket.leave(socketState.currentRoomId)
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
}
