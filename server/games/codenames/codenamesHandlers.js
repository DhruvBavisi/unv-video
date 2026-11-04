import { makeRoomId } from "../../shared/utils.js";
import { ensureResumeToken, connectPlayer, sessionSockets } from "../../shared/sessionRegistry.js";
import { generateCodenamesBoard } from "./boardGenerator.js";
import {
  codenamesRooms,
  checkCodenamesReadiness,
  checkAndApplyCodenamesTransition,
  getCodenamesPublicState,
  getCodenamesPrivateState,
  broadcastCodenamesRoomState,
  findCodenamesRoomByPlayer,
  syncCodenamesSpymasters,
  removeCodenamesPlayer
} from "./codenamesState.js";
import {
  autoAssignCodenamesBots,
  clearRoomBotTimers,
  executeGiveClue,
  executeCardReveal,
  executeEndTurn,
  executeTableReset,
  triggerCodenamesBotTurn
} from "./codenamesBot.js";

export function registerCodenamesHandlers(io, socket, socketState, context) {
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
      return callback?.({ error: 'ALREADY_IN_ROOM', roomId: existing.roomId })
    }

    let roomId = makeRoomId()
    while (codenamesRooms.has(roomId) || (context?.isRoomIdTaken && context.isRoomIdTaken(roomId))) roomId = makeRoomId()

    const sessionId = reqSessionId
    socketState.currentSessionId = sessionId
    
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
      phase: 'LOBBY',
      turnHistory: []
    }
    
    room.players[0].resumeToken = ensureResumeToken(room.players[0])
    
    codenamesRooms.set(roomId, room)
    socketState.currentRoomId = roomId
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
      return callback?.({ error: 'ALREADY_IN_ANOTHER_ROOM', roomId: existing.roomId })
    }

    const room = codenamesRooms.get(roomId)
    if (!room) {
      return callback?.({ error: 'ROOM_NOT_FOUND' })
    }
    if ((room.status === 'PLAYING' || room.status === 'FINISHED') && !room.players.some(p => p.id === reqSessionId)) {
      return callback?.({ error: 'GAME_IN_PROGRESS' })
    }






    
    let sessionId = reqSessionId
    socketState.currentSessionId = sessionId
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
    
    socketState.currentRoomId = roomId
    connectPlayer(socket, sessionId)
    socket.join(`codenames:${roomId}`)
    
    socket.emit('session-token', { resumeToken: player.resumeToken, roomId, playerName: player.name, gameMode: 'codenames' })
    checkAndApplyCodenamesTransition(room)
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:host-make-host', ({ targetId }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === socketState.currentSessionId) return callback?.({ success: false, error: 'CANNOT_MAKE_SELF_HOST' })


    
    const targetPlayer = room.players.find(p => p.id === targetId)
    if (!targetPlayer) return callback?.({ success: false, error: 'TARGET_NOT_FOUND' })

    const currentHostPlayer = room.players.find(p => p.id === socketState.currentSessionId)
    if (currentHostPlayer) currentHostPlayer.isHost = false
    targetPlayer.isHost = true
    room.hostId = targetId

    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:host-kick-player', ({ targetId }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (targetId === socketState.currentSessionId) return callback?.({ success: false, error: 'CANNOT_KICK_SELF' })
    
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
        targetSocket.leave(`codenames:${socketState.currentRoomId}`)
      }
      sessionSockets.delete(targetId)
    }

    const realPlayers = room.players.filter(p => !p.isBot)
    if (realPlayers.length === 0) {
      codenamesRooms.delete(socketState.currentRoomId)
      io.to(`codenames:${socketState.currentRoomId}`).emit('room-closed', { message: 'Room closed.' })
      return callback?.({ success: true })
    }

    syncCodenamesSpymasters(room)
    checkAndApplyCodenamesTransition(room)

    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:leave-room', () => {
    if (socketState.currentSessionId) {
      removeCodenamesPlayer(socketState.currentSessionId)
      socket.leave(`codenames:${socketState.currentRoomId}`)
      socketState.currentRoomId = null
    }
  })

  socket.on('codenames:join-team-role', ({ team, role }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status === 'PLAYING') return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })
    if (room.status === 'FINISHED') return callback?.({ success: false, error: 'GAME_FINISHED' })

    if (team !== 'red' && team !== 'blue' && team !== null) return callback?.({ success: false, error: 'INVALID_TEAM' })
    if (role !== 'SPYMASTER' && role !== 'OPERATIVE' && role !== null) return callback?.({ success: false, error: 'INVALID_ROLE' })

    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })

    const targetTeam = (team && role) ? team : null
    const targetRole = (team && role) ? role : null

    // Prevent overwriting an existing Spymaster slot
    if (targetRole === 'SPYMASTER') {
      const existingSpy = room.players.find(p => p.id !== socketState.currentSessionId && p.team === targetTeam && p.role === 'SPYMASTER')
      if (existingSpy || (room.spymasters?.[targetTeam] && room.spymasters[targetTeam] !== socketState.currentSessionId)) {
        return callback?.({ success: false, error: 'SPYMASTER_SLOT_TAKEN' })
      }
    }

    if (player.team && room.teams[player.team]) {
      room.teams[player.team] = room.teams[player.team].filter(id => id !== socketState.currentSessionId)
      if (room.spymasters[player.team] === socketState.currentSessionId) {
        room.spymasters[player.team] = null
      }
    }

    player.team = targetTeam
    player.role = targetRole
    if (targetTeam) {
      if (!room.teams[targetTeam].includes(socketState.currentSessionId)) {
        room.teams[targetTeam].push(socketState.currentSessionId)
      }
      if (targetRole === 'SPYMASTER') {
        room.spymasters[targetTeam] = socketState.currentSessionId
      }
    }

    syncCodenamesSpymasters(room)
    checkAndApplyCodenamesTransition(room)
    if (room.players.some(p => p.isBot)) {
      autoAssignCodenamesBots(room, checkAndApplyCodenamesTransition)
    }
    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:reset-teams', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    const isWaitingPhase = room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS'
    if (room.status !== 'LOBBY' && !isWaitingPhase) return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })

    room.players.forEach(p => {
      p.team = null
      p.role = null
    })
    room.teams = { red: [], blue: [] }
    room.spymasters = { red: null, blue: null }

    checkAndApplyCodenamesTransition(room)
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:randomize-teams', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    const isWaitingPhase = room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS'
    if (room.status !== 'LOBBY' && !isWaitingPhase) return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })

    const allPlayers = [...room.players]
    if (allPlayers.length < 2) return callback?.({ success: false, error: 'NOT_ENOUGH_PLAYERS' })

    for (let i = allPlayers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allPlayers[i], allPlayers[j]] = [allPlayers[j], allPlayers[i]]
    }

    room.teams = { red: [], blue: [] }
    room.spymasters = { red: null, blue: null }
    room.players.forEach(p => { p.team = null; p.role = null })

    const half = Math.ceil(allPlayers.length / 2)
    const redGroup = allPlayers.slice(0, half)
    const blueGroup = allPlayers.slice(half)

    const redSpy = redGroup[Math.floor(Math.random() * redGroup.length)]
    const blueSpy = blueGroup[Math.floor(Math.random() * blueGroup.length)]

    redGroup.forEach(p => {
      p.team = 'red'
      p.role = p.id === redSpy.id ? 'SPYMASTER' : 'OPERATIVE'
      room.teams.red.push(p.id)
      if (p.role === 'SPYMASTER') room.spymasters.red = p.id
    })

    blueGroup.forEach(p => {
      p.team = 'blue'
      p.role = p.id === blueSpy.id ? 'SPYMASTER' : 'OPERATIVE'
      room.teams.blue.push(p.id)
      if (p.role === 'SPYMASTER') room.spymasters.blue = p.id
    })

    syncCodenamesSpymasters(room)
    checkAndApplyCodenamesTransition(room)
    if (room.players.some(p => p.isBot)) {
      autoAssignCodenamesBots(room, checkAndApplyCodenamesTransition)
    }
    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:update-settings', (settings, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    const isWaitingPhase = room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS'
    if (room.status !== 'LOBBY' && !isWaitingPhase) return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })

    if (!settings || typeof settings !== 'object') return callback?.({ success: false, error: 'INVALID_SETTINGS' })
    if (settings.timer !== undefined) {
      if (!['OFF', '1:00', '2:00', '3:00'].includes(settings.timer)) return callback?.({ success: false, error: 'INVALID_TIMER' })
      room.timer = settings.timer
    }
    if (settings.mode !== undefined) {
      if (settings.mode !== 'CLASSIC') return callback?.({ success: false, error: 'INVALID_MODE' })
      room.mode = settings.mode
    }
    if (settings.wordPack !== undefined) {
      if (settings.wordPack !== 'ENGLISH') return callback?.({ success: false, error: 'INVALID_WORD_PACK' })
      room.wordPack = settings.wordPack
    }
    
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  // DEV BOTS
  socket.on('codenames:dev-add-bots', ({ count = 1 }, callback) => {
    if (process.env.NODE_ENV === 'production') return callback?.({ success: false, error: 'NOT_ALLOWED_IN_PRODUCTION' })
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    const isWaitingPhase = room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS'
    if (room.status !== 'LOBBY' && !isWaitingPhase) return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })

    const totalPlayers = room.players.length
    if (totalPlayers + count > 19) return callback?.({ success: false, error: 'ROOM_FULL' })

    for (let i = 0; i < count; i++) {
      let botNum = 1
      while(room.players.some(p => p.name === `Bot ${botNum}`)) {
        botNum++
      }
      const botId = `bot-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`
      room.players.push({
        id: botId,
        name: `Bot ${botNum}`,
        isHost: false,
        isConnected: true,
        isBot: true,
        team: null,
        role: null
      })
    }

    if (room.players.some(p => p.isBot)) {
      autoAssignCodenamesBots(room, checkAndApplyCodenamesTransition)
    }
    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:dev-remove-bots', (callback) => {
    if (process.env.NODE_ENV === 'production') return callback?.({ success: false, error: 'NOT_ALLOWED_IN_PRODUCTION' })
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    const isWaitingPhase = room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS'
    if (room.status !== 'LOBBY' && !isWaitingPhase) return callback?.({ success: false, error: 'GAME_IN_PROGRESS' })

    clearRoomBotTimers(room)
    const botIds = room.players.filter(p => p.isBot).map(p => p.id)
    room.players = room.players.filter(p => !p.isBot)

    // Remove from teams and spymasters
    botIds.forEach(botId => {
      if (room.teams.red.includes(botId)) room.teams.red = room.teams.red.filter(id => id !== botId)
      if (room.teams.blue.includes(botId)) room.teams.blue = room.teams.blue.filter(id => id !== botId)
      if (room.spymasters.red === botId) room.spymasters.red = null
      if (room.spymasters.blue === botId) room.spymasters.blue = null
    })

    syncCodenamesSpymasters(room)
    checkAndApplyCodenamesTransition(room)
    if (room.players.some(p => p.isBot)) {
      autoAssignCodenamesBots(room, checkAndApplyCodenamesTransition)
    }
    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:start-game', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    
    // Prevent starting if already initialized or not in LOBBY
    if (room.status !== 'LOBBY' || (room.board && room.board.length > 0)) {
      return callback?.({ success: false, error: 'ALREADY_INITIALIZED' })
    }

    const realPlayers = room.players.filter(p => !p.isBot)
    if (realPlayers.length < 1) {
      return callback?.({ success: false, error: 'NO_REAL_PLAYERS' })
    }

    room.startingTeam = Math.random() < 0.5 ? 'red' : 'blue'
    room.currentTeam = room.startingTeam
    room.board = generateCodenamesBoard(room.startingTeam)
    room.tileVariantPools = { red: [], blue: [], neutral: [], assassin: [] }
    room.currentClue = null
    room.guessesLeft = null
    room.winner = null
    room.endReason = null
    room.turnHistory = []

    if (checkCodenamesReadiness(room)) {
      room.status = 'PLAYING'
      room.phase = 'BOARD_READY'
    } else {
      room.status = 'WAITING_FOR_PLAYERS'
      room.phase = 'WAITING_FOR_PLAYERS'
    }

    if (room.players.some(p => p.isBot)) {
      autoAssignCodenamesBots(room, checkAndApplyCodenamesTransition)
    }

    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:give-clue', (payload, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_IN_ROOM' })
    
    if (player.role !== 'SPYMASTER') return callback?.({ success: false, error: 'NOT_SPYMASTER' })
    if (player.team !== room.currentTeam) return callback?.({ success: false, error: 'NOT_YOUR_TURN' })
    if (room.status !== 'PLAYING' || room.phase === 'WAITING_FOR_PLAYERS') return callback?.({ success: false, error: 'INVALID_PHASE' })
    if (room.phase !== 'BOARD_READY' && room.phase !== 'CLUE_PHASE') return callback?.({ success: false, error: 'INVALID_PHASE' })
    if (!room.board || room.board.length !== 25) return callback?.({ success: false, error: 'BOARD_NOT_INITIALIZED' })
    if (!checkCodenamesReadiness(room)) return callback?.({ success: false, error: 'ROOM_NOT_READY' })

    const clueStr = typeof payload?.clue === 'string' ? payload.clue.trim() : ''
    const isInfinity = payload?.number === '∞' || payload?.number === 'unlimited' || payload?.number === 99 || payload?.number === 'INFINITY'
    const num = isInfinity ? '∞' : Number(payload?.number)
    if (!clueStr) return callback?.({ success: false, error: 'EMPTY_CLUE' })
    if (clueStr.length > 25 || !/^[\p{L}\p{N}'-]+$/u.test(clueStr)) return callback?.({ success: false, error: 'INVALID_CLUE' })
    const upper = clueStr.toUpperCase()
    if (room.board.some(c => !c.revealed && String(c.word).toUpperCase() === upper)) return callback?.({ success: false, error: 'CLUE_MATCHES_BOARD_WORD' })
    if (!isInfinity && (!Number.isInteger(num) || num < 0 || num > 9)) return callback?.({ success: false, error: 'INVALID_NUMBER' })
    
    executeGiveClue(room, upper, num)
    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:select-card', ({ cardIndex }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.status !== 'PLAYING' || room.phase !== 'GUESS_PHASE') return callback?.({ success: false, error: 'NOT_GUESS_PHASE' })

    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player || player.team !== room.currentTeam || player.role !== 'OPERATIVE') {
      return callback?.({ success: false, error: 'NOT_ACTIVE_OPERATIVE' })
    }

    if (!room.targetedCards) room.targetedCards = {}

    if (cardIndex === null || cardIndex === undefined || room.targetedCards[player.id] === cardIndex) {
      delete room.targetedCards[player.id]
    } else if (typeof cardIndex === 'number' && cardIndex >= 0 && cardIndex < room.board.length && !room.board[cardIndex].revealed) {
      room.targetedCards[player.id] = cardIndex
    }

    broadcastCodenamesRoomState(room)
    callback?.({ success: true, targetedCards: room.targetedCards })
  })

  socket.on('codenames:reveal-card', ({ cardIndex, word }, callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_IN_ROOM' })

    if (room.status !== 'PLAYING') return callback?.({ success: false, error: 'GAME_NOT_IN_PROGRESS' })
    if (room.phase !== 'GUESS_PHASE') return callback?.({ success: false, error: 'NOT_GUESS_PHASE' })
    if (player.team !== room.currentTeam) return callback?.({ success: false, error: 'NOT_YOUR_TURN' })
    if (player.role !== 'OPERATIVE') return callback?.({ success: false, error: 'NOT_OPERATIVE' })
    if (!checkCodenamesReadiness(room)) return callback?.({ success: false, error: 'ROOM_NOT_READY' })
    if (!room.board || room.board.length !== 25) return callback?.({ success: false, error: 'BOARD_NOT_INITIALIZED' })

    let idx = -1
    if (typeof cardIndex === 'number' && cardIndex >= 0 && cardIndex < room.board.length) {
      idx = cardIndex
    } else if (typeof word === 'string' && word.trim()) {
      idx = room.board.findIndex(c => c.word.toUpperCase() === word.trim().toUpperCase())
    }

    if (idx === -1) return callback?.({ success: false, error: 'CARD_NOT_FOUND' })
    const card = room.board[idx]
    if (card.revealed) return callback?.({ success: false, error: 'CARD_ALREADY_REVEALED' })

    executeCardReveal(room, idx, player.id)

    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true, card: { index: idx, word: card.word, category: card.category } })
  })

  socket.on('codenames:end-turn', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    const player = room.players.find(p => p.id === socketState.currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_IN_ROOM' })

    if (room.status !== 'PLAYING') return callback?.({ success: false, error: 'GAME_NOT_IN_PROGRESS' })
    if (room.phase !== 'GUESS_PHASE') return callback?.({ success: false, error: 'NOT_GUESS_PHASE' })
    if (player.team !== room.currentTeam) return callback?.({ success: false, error: 'NOT_YOUR_TURN' })
    if (player.role !== 'OPERATIVE') return callback?.({ success: false, error: 'NOT_OPERATIVE' })

    executeEndTurn(room)

    broadcastCodenamesRoomState(room)
    if (room.status === 'PLAYING') {
      triggerCodenamesBotTurn(room, broadcastCodenamesRoomState)
    }
    callback?.({ success: true })
  })

  socket.on('codenames:table-reset', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    const player = room.players?.find(p => p.id === socketState.currentSessionId)
    if (!player) return callback?.({ success: false, error: 'PLAYER_NOT_IN_ROOM' })

    executeTableReset(room)
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

  socket.on('codenames:play-again', (callback) => {
    if (!socketState.currentSessionId || !socketState.currentRoomId) return callback?.({ success: false, error: 'PLAYER_NOT_FOUND' })
    const room = codenamesRooms.get(socketState.currentRoomId)
    if (!room) return callback?.({ success: false, error: 'ROOM_NOT_FOUND' })
    if (room.hostId !== socketState.currentSessionId) return callback?.({ success: false, error: 'NOT_HOST' })
    if (room.status !== 'FINISHED') return callback?.({ success: false, error: 'GAME_NOT_FINISHED' })

    executeTableReset(room)
    broadcastCodenamesRoomState(room)
    callback?.({ success: true })
  })

}
