import { sessionSockets } from "../../shared/sessionRegistry.js";

let serverIo = null;
export function setCodenamesIo(io) { serverIo = io; }
export const codenamesRooms = new Map();

export function checkCodenamesReadiness(room) {
  if (!room || !Array.isArray(room.players)) return false
  const realPlayers = room.players.filter(p => !p.isBot)
  if (realPlayers.length < 4) return false

  const redSpymasters = room.players.filter(p => p.team === 'red' && p.role === 'SPYMASTER')
  const blueSpymasters = room.players.filter(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redOperatives = room.players.filter(p => p.team === 'red' && p.role === 'OPERATIVE')
  const blueOperatives = room.players.filter(p => p.team === 'blue' && p.role === 'OPERATIVE')

  if (redSpymasters.length !== 1 || blueSpymasters.length !== 1) return false
  if (redOperatives.length < 1 || blueOperatives.length < 1) return false







  return true
}

export function checkAndApplyCodenamesTransition(room) {
  if (!room || !room.board || room.board.length !== 25) return false
  if (room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS') {
    if (checkCodenamesReadiness(room)) {
      room.status = 'PLAYING'
      room.phase = 'BOARD_READY'
      return true
    }
  }
  return false
}

export function getCodenamesPublicState(room) {
  return {
    id: room.id,
    status: room.status,
    phase: room.phase,
    hostId: room.hostId,
    teams: room.teams,
    isReady: checkCodenamesReadiness(room),
    spymasterSlots: {
      redTaken: room.players.some(p => p.team === 'red' && p.role === 'SPYMASTER'),
      blueTaken: room.players.some(p => p.team === 'blue' && p.role === 'SPYMASTER')
    },
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isConnected: p.isConnected,
      team: p.team,
      role: p.role,
      isBot: !!p.isBot
    })),
    currentTeam: room.currentTeam,
    startingTeam: room.startingTeam,
    board: room.board ? room.board.map(card => ({
      id: card.id,
      word: card.word,
      revealed: card.revealed,
      category: card.revealed ? card.category : undefined
    })) : undefined,
    timer: room.timer || 'OFF',
    mode: room.mode || 'CLASSIC',
    wordPack: room.wordPack || 'ENGLISH',
    currentClue: room.currentClue || null,
    guessesLeft: room.guessesLeft ?? null,
    winner: room.winner || null,
    endReason: room.endReason || null
  }
}

export function getCodenamesPrivateState(room, playerId) {
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

export function broadcastCodenamesRoomState(room) {
  const roomName = `codenames:${room.id}`
  const socketsInRoom = serverIo.sockets.adapter.rooms.get(roomName)
  if (!socketsInRoom) return
  
  for (const socketId of socketsInRoom) {
    const socket = serverIo.sockets.sockets.get(socketId)
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

export function findCodenamesRoomByPlayer(sessionId) {
  for (const [roomId, room] of codenamesRooms) {
    if (room.players.some((p) => p.id === sessionId)) {
      return { roomId, room }
    }
  }
  return { roomId: null, room: null }
}


export function syncCodenamesSpymasters(room) {
  room.spymasters = {
    red: room.players.find(p => p.team === 'red' && p.role === 'SPYMASTER')?.id || null,
    blue: room.players.find(p => p.team === 'blue' && p.role === 'SPYMASTER')?.id || null
  }
}

export function checkCodenamesAbandonment(room) {
  // Roles can be refilled from the board via JOIN TEAM; never auto-finish the game.











}

export function disconnectCodenamesPlayer(sessionId, socketId) {
  if (socketId && sessionSockets.get(sessionId) !== socketId) return
  const { roomId, room } = findCodenamesRoomByPlayer(sessionId)
  if (!room) return
  const player = room.players.find((p) => p.id === sessionId)
  if (player) {
    player.isConnected = false
    player.disconnectedAt = Date.now()
    if (player && room.status === 'LOBBY' && room.hostId === sessionId) {
      const next = room.players.find(p => p.id !== sessionId && p.isConnected && !p.isBot)
      if (next) { room.players.forEach(p => { p.isHost = false }); next.isHost = true; room.hostId = next.id }
    }
  }
  const realPlayers = room.players.filter(p => !p.isBot)
  const allRealDisconnected = realPlayers.length > 0 && realPlayers.every(p => !p.isConnected)
  
  // Clear the stale socket mapping for the disconnected session, but leave resume token
  if (sessionSockets.get(sessionId) === socketId) {
    sessionSockets.delete(sessionId)
  }

  // SPECIAL CASE: 1 real player + bots -> destroy immediately upon disconnect
  // REMOVED to align with Undercover: real players need a grace period for page reloads
  
  if (realPlayers.length === 0 || allRealDisconnected) {
    if (realPlayers.length === 0) {
      codenamesRooms.delete(roomId)
      serverIo.to(`codenames:${roomId}`).emit('room-closed', { message: 'Room closed.' })
      return
    }
    // Grace period: do not delete immediately if there are >1 real players that just disconnected
  }

  broadcastCodenamesRoomState(room)
}

export function removeCodenamesPlayer(sessionId) {
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
      serverIo.to(`codenames:${roomId}`).emit('room-closed', { message: 'Room closed.' })
      return { roomId, room: null }
    }
    if (wasHost && room.players.length > 0) {
      const nextHost = room.players.find(p => p.isConnected && !p.isBot) || room.players[0]
      nextHost.isHost = true
      room.hostId = nextHost.id
    }
    syncCodenamesSpymasters(room)
    checkAndApplyCodenamesTransition(room)
    checkCodenamesAbandonment(room)
    broadcastCodenamesRoomState(room)
  }
  return { roomId, room }
}

