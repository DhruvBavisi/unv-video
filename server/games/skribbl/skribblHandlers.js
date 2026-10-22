import { sessionSockets, connectPlayer, ensureResumeToken } from '../../shared/sessionRegistry.js';
import { makeRoomId } from '../../shared/utils.js';
import {
  drawRooms,
  checkDrawRateLimit,
  clearDrawRateLimits,
  checkDrawStrokeRateLimit,
  findDrawRoomByPlayer,
  normalizeGuess,
  broadcastDrawRoomState,
  resumeDrawTimersIfDrawer,
  getSafeStateForPlayer,
  scheduleWordChoiceTimeout,
  updateRoomHintString,
  startDrawingTurn,
  endDrawRound,
  generateWordChoices,
  isDrawSocketOwner,
  reassignDrawHostIfNeeded,
  disconnectDrawPlayer,
  resetDrawRoomToLobby,
  checkDrawPlayAgainCompletion,
  removeDrawPlayer
} from './skribblState.js';

export function registerSkribblHandlers(io, socket, socketState, context) {
  const isCurrentDrawSession = (sessionId = socketState.currentSessionId) => isDrawSocketOwner(sessionId, socket);

  socket.on('draw:create-room', ({ sessionId, playerName }, callback) => {
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    
    // Ensure player is not already in a draw room
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === sessionId)) {
        if (dr.hostId === sessionId && dr.status === 'LOBBY') {
          socketState.currentSessionId = sessionId
          socket.join(`draw:${rid}`)
          socket.join(sessionId)
          connectPlayer(socket, sessionId)
          return callback?.({
            room: getSafeStateForPlayer(dr, sessionId),
            resumeToken: dr.playerRecords?.[sessionId]?.resumeToken,
            sessionId
          })
        }
        return callback?.({ error: 'ALREADY_IN_DRAW_ROOM' })
      }
    }

    let roomId = makeRoomId()
    while (drawRooms.has(roomId) || (context?.isRoomIdTaken && context.isRoomIdTaken(roomId))) roomId = makeRoomId()

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
    socketState.currentSessionId = sessionId
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

  socket.on('draw:join-room', ({ sessionId, resumeToken, roomId, playerName }, callback) => {
    if (!sessionId || !playerName || typeof playerName !== 'string') {
      return callback?.({ error: 'INVALID_NAME' })
    }
    const trimmed = playerName.trim()
    const normalizedId = (roomId || '').trim().toUpperCase()

    const room = drawRooms.get(normalizedId)
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })

    const existing = room.players.find(p => p.id === sessionId)
    if (existing) {
      const knownToken = existing.resumeToken || (room.playerRecords && room.playerRecords[sessionId]?.resumeToken)
      const tokenOk = Boolean(knownToken) && typeof resumeToken === 'string' && resumeToken === knownToken
      if (!tokenOk) {
        return callback?.({ error: 'SESSION_EXPIRED' })
      }

      if (!existing.resumeToken && knownToken) {
        existing.resumeToken = knownToken
      }
      if (room.playerRecords && room.playerRecords[sessionId] && !room.playerRecords[sessionId].resumeToken) {
        room.playerRecords[sessionId].resumeToken = existing.resumeToken
      }

      existing.isConnected = true
      existing.name = existing.name || trimmed
      existing.disconnectedAt = null
      if (existing.playAgain == null && room.playerRecords && room.playerRecords[sessionId]?.playAgain) {
        existing.playAgain = room.playerRecords[sessionId].playAgain
      }
      socketState.currentSessionId = sessionId
      reassignDrawHostIfNeeded(room)
      socket.join(`draw:${normalizedId}`)
      socket.join(sessionId) // Join private room for Skribbl direct messaging
      connectPlayer(socket, sessionId)
      
      socket.emit('session-token', { resumeToken: existing.resumeToken, roomId: normalizedId, playerName: existing.name, gameMode: 'skribbl' })
      
      // Resume drawer timers
      resumeDrawTimersIfDrawer(room, sessionId)
      
      broadcastDrawRoomState(room)
      callback?.({ room: getSafeStateForPlayer(room, sessionId) })
      return
    }

    const record = room.playerRecords ? room.playerRecords[sessionId] : null
    if (record) {
      if (record.kicked) {
        return callback?.({ error: 'KICKED_FROM_ROOM' })
      }
      if (record.departed) {
        if (room.status !== 'LOBBY') {
          return callback?.({ error: 'GAME_ALREADY_STARTED' })
        }
        record.departed = false
        record.kicked = false
        record.score = 0
      }
      const recordTokenOk = Boolean(record.resumeToken) && typeof resumeToken === 'string' && resumeToken === record.resumeToken
      if (!recordTokenOk) {
        return callback?.({ error: 'SESSION_EXPIRED' })
      }
    } else {
      if (room.status !== 'LOBBY') {
        return callback?.({ error: 'GAME_ALREADY_STARTED' })
      }
    }

    if (room.players.length >= room.configuration.maxPlayers) {
      return callback?.({ error: 'ROOM_FULL' })
    }

    const targetName = record ? record.name : trimmed
    if (room.players.some(p => p.name.toLowerCase() === targetName.toLowerCase())) {
      return callback?.({ error: 'NAME_TAKEN' })
    }

    const newPlayer = {
      id: sessionId,
      name: targetName,
      isHost: false,
      isConnected: true,
      spectator: false,
      score: record ? record.score : 0,
      resumeToken: record ? record.resumeToken : undefined
    }
    
    room.players.push(newPlayer)

    socketState.currentSessionId = sessionId
    reassignDrawHostIfNeeded(room)
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
    
    broadcastDrawRoomState(room)
    callback?.({ room: getSafeStateForPlayer(room, sessionId) })
  })



  socket.on('draw:leave-room', (payloadOrCallback, maybeCallback) => {
    const callback = typeof payloadOrCallback === 'function' ? payloadOrCallback : (typeof maybeCallback === 'function' ? maybeCallback : null)
    if (!isCurrentDrawSession(socketState.currentSessionId)) {
      return callback?.({ success: true, alreadyLeft: true })
    }
    
    let foundRoomId = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        foundRoomId = rid
        break
      }
    }

    if (!foundRoomId) {
      socketState.currentRoomId = null
      socketState.currentSessionId = null
      return callback?.({ success: true, alreadyLeft: true })
    }

    const leavingSessionId = socketState.currentSessionId
    const removed = removeDrawPlayer(leavingSessionId, { isKick: false })
    socket.leave(`draw:${foundRoomId}`)
    socket.leave(leavingSessionId) // Cleanup private room
    
    // Only clean sessionSockets if this socket is the registered owner and player is not in other modes
    if (sessionSockets.get(leavingSessionId) === socket.id) {
      const inUndercover = Array.from(rooms.values()).some(r => r.players.some(p => p.id === leavingSessionId))
      const inCodenames = Array.from(codenamesRooms.values()).some(r => r.players.some(p => p.id === leavingSessionId))
      if (!inUndercover && !inCodenames) {
        sessionSockets.delete(leavingSessionId)
      }
    }

    if (removed.room) {
      broadcastDrawRoomState(removed.room)
    }
    
    socketState.currentRoomId = null
    socketState.currentSessionId = null
    callback?.({ success: true })
  })

  socket.on('draw:update-config', (config) => {
    if (!isCurrentDrawSession(socketState.currentSessionId) || typeof config !== 'object') return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.hostId === socketState.currentSessionId) {
        room = dr
        break
      }
    }
    if (!room || (room.status !== 'LOBBY' && room.phase !== 'GAME_RESULT')) return
    
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



  socket.on('draw:start-game', (payloadOrCallback, maybeCallback) => {
    const callback = typeof payloadOrCallback === 'function' ? payloadOrCallback : (typeof maybeCallback === 'function' ? maybeCallback : null)
    if (!isCurrentDrawSession(socketState.currentSessionId)) return callback?.({ success: false, error: 'NO_SESSION' })

    let room = null
    for (const [, dr] of drawRooms) {
      if (dr.hostId === socketState.currentSessionId) {
        room = dr
        break
      }
    }

    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'LOBBY') return callback?.({ success: false, error: 'GAME_ALREADY_STARTED' })

    const eligiblePlayers = room.players.filter(p => !p.spectator)
    if (eligiblePlayers.length < 2) {
      return callback?.({ success: false, error: 'NOT_ENOUGH_PLAYERS' })
    }

    try {
      // Build the complete start state before mutating the room. This prevents
      // a startup exception from leaving a half-started room.
      const playerIds = Array.from(new Set(eligiblePlayers.map(p => p.id)))
      for (let i = playerIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]]
      }

      const wordChoices = generateWordChoices(room)
      if (!Array.isArray(wordChoices) || wordChoices.length === 0) {
        return callback?.({ success: false, error: 'NO_WORDS_AVAILABLE' })
      }

      if (room.wordChoiceTimeout) {
        clearTimeout(room.wordChoiceTimeout)
        room.wordChoiceTimeout = null
      }
      if (room.turnTimeout) {
        clearTimeout(room.turnTimeout)
        room.turnTimeout = null
      }
      if (room.hintTimer) {
        clearInterval(room.hintTimer)
        room.hintTimer = null
      }

      room.status = 'PLAYING'
      room.phase = 'WORD_CHOICE'
      room.round = 1
      room.totalRounds = Number(room.configuration.rounds) || 3
      room.turnOrder = playerIds
      room.turnIndex = 0
      room.currentDrawerId = playerIds[0]
      room.wordChoices = wordChoices
      room.selectedWord = null
      room.strokes = []
      room.guessedPlayerIds = []
      room.turnScores = {}
      room.hintsGiven = 0
      room.turnSequence = 1
      room.roundEndsAt = null
      room.wordChoiceEndsAt = null
      room.drawingRemainingMs = undefined
      room.wordChoiceRemainingMs = undefined

      io.to(`draw:${room.id}`).emit('draw:clear-canvas')
      scheduleWordChoiceTimeout(room)
      broadcastDrawRoomState(room)
      callback?.({ success: true })
    } catch (error) {
      if (room.wordChoiceTimeout) {
        clearTimeout(room.wordChoiceTimeout)
        room.wordChoiceTimeout = null
      }
      room.status = 'LOBBY'
      room.phase = 'LOBBY'
      room.round = 1
      room.turnOrder = []
      room.turnIndex = 0
      room.currentDrawerId = null
      room.selectedWord = null
      room.wordChoices = []
      room.strokes = []
      room.guessedPlayerIds = []
      room.turnScores = {}
      room.hintsGiven = 0
      room.turnSequence = 0
      room.roundEndsAt = null
      room.wordChoiceEndsAt = null
      room.drawingRemainingMs = undefined
      room.wordChoiceRemainingMs = undefined

      console.error('[DRAW] Failed to start game', {
        roomId: room.id,
        sessionId: socketState.currentSessionId,
        error
      })
      callback?.({ success: false, error: 'START_GAME_FAILED' })
    }
  })



  socket.on('draw:choose-word', (payload, callback) => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return callback?.({ error: 'No session' })
    const word = payload?.word
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.currentDrawerId !== socketState.currentSessionId) {
      return callback?.({ error: 'NOT_DRAWER' })
    }
    if (room.phase !== 'WORD_CHOICE') {
      return callback?.({ error: 'WRONG_PHASE' })
    }
    if (room.selectedWord) {
      return callback?.({ error: 'ALREADY_CHOSEN' })
    }
    
    if (!room.wordChoices || !room.wordChoices.includes(word)) {
      if (!room.wordChoices || room.wordChoices.length === 0) {
        // Safe fallback if pool exhausted
        endDrawRound(room)
        return callback?.({ success: true, endedEarly: true })
      } else {
        return callback?.({ error: 'INVALID_WORD_CHOICE' })
      }
    }

    if (room.wordChoiceTimeout) {
      clearTimeout(room.wordChoiceTimeout)
      room.wordChoiceTimeout = null
    }
    room.wordChoiceEndsAt = null
    room.phase = 'DRAWING'

    startDrawingTurn(room, word)
    callback?.({ success: true })
  })

  socket.on('draw:stroke', (strokeData) => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) {
      console.warn(`[draw:stroke] Rejected: session ${socketState.currentSessionId} is not active`)
      return
    }
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === socketState.currentSessionId && dr.phase === 'DRAWING') {
        room = dr
        break
      }
    }
    if (!room) {
      console.warn(`[draw:stroke] Rejected: room not found or session ${socketState.currentSessionId} not current drawer in DRAWING phase`)
      return
    }

    if (!strokeData || typeof strokeData !== 'object') {
      console.warn('[draw:stroke] Rejected: malformed payload object')
      return
    }

    const pointCount = Array.isArray(strokeData.points) ? strokeData.points.length : 0
    const isComplete = strokeData.isComplete !== false

    if (!checkDrawStrokeRateLimit(socketState.currentSessionId, isComplete, pointCount)) {
      return
    }

    // Stroke Validation
    if (typeof strokeData.color !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(strokeData.color)) {
      console.warn('[draw:stroke] Rejected: invalid color', strokeData.color)
      return
    }
    if (typeof strokeData.size !== 'number' || strokeData.size < 1 || strokeData.size > 100) {
      console.warn('[draw:stroke] Rejected: invalid size', strokeData.size)
      return
    }
    if (!Array.isArray(strokeData.points) || strokeData.points.length > 500) {
      console.warn('[draw:stroke] Rejected: points array length out of bounds', pointCount)
      return
    }
    if (strokeData.tool && strokeData.tool !== 'brush' && strokeData.tool !== 'eraser' && strokeData.tool !== 'fill') {
      console.warn('[draw:stroke] Rejected: invalid tool', strokeData.tool)
      return
    }
    
    for (const pt of strokeData.points) {
      if (typeof pt.x !== 'number' || typeof pt.y !== 'number' || pt.x < -0.2 || pt.x > 1.2 || pt.y < -0.2 || pt.y > 1.2) {
        console.warn('[draw:stroke] Rejected: point coordinates out of bounds', pt)
        return // Reject malformed stroke entirely
      }
    }

    const strokeId = typeof strokeData.strokeId === 'string' && strokeData.strokeId.length > 0
      ? strokeData.strokeId
      : `${socketState.currentSessionId}-${Date.now()}`

    const validatedStroke = {
      ...strokeData,
      strokeId,
      drawerId: socketState.currentSessionId,
    }

    if (isComplete) {
      if (!room.strokes) room.strokes = []
      const existingIdx = room.strokes.findIndex(s => s.strokeId === strokeId)
      if (existingIdx !== -1) {
        room.strokes[existingIdx] = validatedStroke
      } else {
        room.strokes.push(validatedStroke)
      }
      io.to(`draw:${room.id}`).emit('draw:stroke', validatedStroke)
    } else {
      socket.to(`draw:${room.id}`).emit('draw:stroke', validatedStroke)
    }
  })

  socket.on('draw:undo', () => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === socketState.currentSessionId && dr.phase === 'DRAWING') {
        room = dr
        break
      }
    }
    if (!room || !room.strokes || room.strokes.length === 0) return

    room.strokes.pop()
    io.to(`draw:${room.id}`).emit('draw:undo')
  })

  socket.on('draw:clear-canvas', () => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.currentDrawerId === socketState.currentSessionId && dr.phase === 'DRAWING') {
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
    if (!isCurrentDrawSession(socketState.currentSessionId)) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room || room.phase !== 'DRAWING') return
    if (room.currentDrawerId === socketState.currentSessionId) return

    if (!room.reactions) room.reactions = {}

    // Reject duplicate reactions from the same player for the same drawing turn
    if (room.reactions[socketState.currentSessionId]) return

    if (reactionType === 'LIKE' || reactionType === 'DISLIKE') {
      room.reactions[socketState.currentSessionId] = reactionType

      const player = room.players.find(p => p.id === socketState.currentSessionId)
      if (player) {
        if (!room.chatMessages) room.chatMessages = []
        room.chatMessages.push({
          id: crypto.randomUUID(),
          playerId: socketState.currentSessionId,
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
    if (!isCurrentDrawSession(socketState.currentSessionId)) return
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room || room.phase !== 'DRAWING') return
    if (room.currentDrawerId === socketState.currentSessionId) return // Drawer can't guess

    if (!checkDrawRateLimit(socketState.currentSessionId, 'guess', 12, 10000)) return

    if (typeof message !== 'string') return
    const trimmed = message.trim()
    if (!trimmed || trimmed.length > 120) return

    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player) return

    if (!room.chatMessages) room.chatMessages = []
    if (!room.guessedPlayerIds) room.guessedPlayerIds = []

    const normGuess = normalizeGuess(trimmed)
    const normTarget = normalizeGuess(room.selectedWord)

    if (room.guessedPlayerIds.includes(socketState.currentSessionId)) {
      if (normGuess === normTarget) {
        return // Drop duplicate correct guesses
      }
      // Otherwise, allow as normal chat
      const chatMsg = {
        id: crypto.randomUUID(),
        playerId: socketState.currentSessionId,
        playerName: player.name,
        type: 'CHAT',
        message: trimmed
      }
      room.chatMessages.push(chatMsg)
      if (room.chatMessages.length > 100) room.chatMessages.shift()
      io.to(`draw:${room.id}`).emit('draw:chat-message', chatMsg)
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
      room.guessedPlayerIds.push(socketState.currentSessionId)
      
      const timeRemaining = Math.max(0, (room.roundEndsAt - Date.now()) / 1000)
      const basePoints = Math.round(500 * timeRemaining / room.configuration.drawTimeSec)
      
      const order = room.guessedPlayerIds.length
      let multiplier = 0.50
      if (order === 1) multiplier = 1.00
      else if (order === 2) multiplier = 0.80
      else if (order === 3) multiplier = 0.65
      
      const points = Math.max(50, Math.round(basePoints * multiplier))
      if (!room.turnScores) room.turnScores = {}
      room.turnScores[socketState.currentSessionId] = points
      // player.score += points // DO NOT apply yet, wait for ROUND_REVEAL
      
      const eligiblePlayersCount = room.turnOrder 
        ? Math.max(0, room.turnOrder.length - 1) 
        : room.players.filter(p => !p.spectator && p.id !== room.currentDrawerId).length
        
      const isEarlyFinish = room.guessedPlayerIds.length >= eligiblePlayersCount
      
      if (isEarlyFinish) {
        // Broadcast the message FIRST so it shows in chat, then trigger round end.
        const chatMsg = {
          id: crypto.randomUUID(),
          playerId: socketState.currentSessionId,
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
      playerId: socketState.currentSessionId,
      playerName: player.name,
      type: msgType,
      message: msgType === 'CHAT' ? trimmed : null
    }

    room.chatMessages.push(chatMsg)
    if (room.chatMessages.length > 100) {
      room.chatMessages.shift()
    }

    if (msgType === 'CORRECT') {
      broadcastDrawRoomState(room)
    } else {
      io.to(`draw:${room.id}`).emit('draw:chat-message', chatMsg)
    }
  })

  socket.on('draw:request-strokes', (callback) => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return callback?.({ strokes: [] })
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ strokes: [] })
    callback?.({ strokes: room.strokes || [] })
  })

  socket.on('draw:play-again', (callback) => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return callback?.({ success: false, error: 'NOT_IN_ROOM' })
    let room = null
    for (const [, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })

    // Idempotent: if room has already transitioned to LOBBY, acknowledge success
    if (room.phase === 'LOBBY') {
      return callback?.({ success: true, phase: 'LOBBY' })
    }

    if (room.phase !== 'GAME_RESULT') return callback?.({ success: false, error: 'GAME_NOT_ENDED' })

    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })

    player.playAgain = true
    if (player.spectator) {
      player.spectator = false
    }
    if (room.playerRecords && room.playerRecords[socketState.currentSessionId]) {
      room.playerRecords[socketState.currentSessionId].playAgain = true
    }

    const completed = checkDrawPlayAgainCompletion(room)
    if (!completed) {
      broadcastDrawRoomState(room)
    }
    callback?.({ success: true, phase: room.phase })
  })

  socket.on('draw:make-host', ({ targetId }, callback) => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return callback?.({ error: 'PLAYER_NOT_FOUND' })
    if (targetId === socketState.currentSessionId) return callback?.({ error: 'CANNOT_TARGET_SELF' })
    
    let room = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        break
      }
    }
    if (!room) return callback?.({ error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ error: 'NOT_HOST' })
    
    const targetPlayer = room.players.find(p => p.id === targetId)
    if (!targetPlayer) return callback?.({ error: 'TARGET_NOT_FOUND' })

    const requester = room.players.find(p => p.id === socketState.currentSessionId)
    targetPlayer.isHost = true
    if (requester) requester.isHost = false
    room.hostId = targetId

    broadcastDrawRoomState(room)
    callback?.({ success: true })
  })

  socket.on('draw:kick-player', ({ targetId }, callback) => {
    if (!isCurrentDrawSession(socketState.currentSessionId)) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    if (!targetId || typeof targetId !== 'string') return callback?.({ success: false, error: 'INVALID_TARGET' })
    if (targetId === socketState.currentSessionId) return callback?.({ success: false, error: 'CANNOT_TARGET_SELF' })
    
    let room = null
    let roomId = null
    for (const [rid, dr] of drawRooms) {
      if (dr.players.some(p => p.id === socketState.currentSessionId)) {
        room = dr
        roomId = rid
        break
      }
    }
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    
    const targetPlayer = room.players.find(p => p.id === targetId)
    if (!targetPlayer) return callback?.({ success: false, error: 'TARGET_NOT_FOUND' })
    if (targetPlayer.isHost || targetId === room.hostId) return callback?.({ success: false, error: 'CANNOT_KICK_HOST' })

    io.to(targetId).emit('draw:kicked')
    
    const removed = removeDrawPlayer(targetId, { isKick: true })

    const targetSocketId = sessionSockets.get(targetId)
    if (targetSocketId) {
      const targetSocket = io.sockets.sockets.get(targetSocketId)
      if (targetSocket) {
        targetSocket.leave(`draw:${roomId}`)
        targetSocket.leave(targetId)
      }
      const inUndercover = Array.from(rooms.values()).some(r => r.players.some(p => p.id === targetId))
      const inCodenames = Array.from(codenamesRooms.values()).some(r => r.players.some(p => p.id === targetId))
      if (!inUndercover && !inCodenames) {
        sessionSockets.delete(targetId)
      }
    }

    if (removed.room) {
      broadcastDrawRoomState(removed.room)
    }
    callback?.({ success: true })
  })

  // Simple mock word generator


}
