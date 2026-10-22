import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SPECIAL_ROLES } from '../../../src/games/undercover/data/specialRoles.js';
import { onRoundStart, onVoteTallied, onElimination, onGameEnd } from './specialRolesHooks.js';
import { sessionSockets, ensureResumeToken } from '../../shared/sessionRegistry.js';
import { makeRoomId, shuffle } from '../../shared/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverIo = null;
export function setUndercoverIo(io) {
  serverIo = io;
}

export const rooms = new Map();

export let WORD_PAIRS = {
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

export let clueIdCounter = 0
export let chatIdCounter = 0
export function getNextClueId() { return `clue-${++clueIdCounter}` }
export function getNextChatId() { return `msg-${++chatIdCounter}` }
export function nextClueId() { return ++clueIdCounter }
export function nextChatId() { return ++chatIdCounter }

// makeRoomId imported from utils.js

export function validateConfig(config, room) {
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

export function getDefaultConfig(totalPlayers) {
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

export function getPublicRoomState(room) {
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

export function findRoomByPlayer(sessionId) {
  for (const [roomId, room] of rooms) {
    if (room.players.some((p) => p.id === sessionId)) {
      return { roomId, room }
    }
  }
  return { roomId: null, room: null }
}

export function broadcastRoom(room) {
  serverIo?.to(room.id).emit('room-state', getPublicRoomState(room))
}

function connectPlayer(socket, sessionId) {
  const oldSocketId = sessionSockets.get(sessionId)
  sessionSockets.set(sessionId, socket.id)
  
  if (oldSocketId && oldSocketId !== socket.id) {
    const oldSocket = serverIo?.sockets?.sockets.get(oldSocketId)
    if (oldSocket) {
      oldSocket.disconnect(true)
    }
  }
}

export function disconnectPlayer(sessionId, socketId) {
  if (socketId && sessionSockets.get(sessionId) !== socketId) {
    return { roomId: null, room: null }
  }

  const { roomId, room } = findRoomByPlayer(sessionId)
  if (!room) return { roomId: null, room: null }

  sessionSockets.delete(sessionId)

  const player = room.players.find((p) => p.id === sessionId)
  if (player) {
    player.isConnected = false
    player.disconnectedAt = Date.now()
    if (player && room.status === 'LOBBY' && room.hostId === sessionId) {
      const next = room.players.find(p => p.id !== sessionId && p.isConnected && !p.isBot)
      if (next) { room.players.forEach(p => { p.isHost = false }); next.isHost = true; room.hostId = next.id }
    }

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

export function removePlayer(sessionId) {
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

export function cleanupPlayerBeforeRemove(room, targetId, targetIndex) {
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

export function cleanupPlayerAfterRemove(room) {
  if (room.status === 'ACTIVE' && room.gamePhase !== 'RESULT') {
    evaluateWinCondition(room)
  }
  if (room.gamePhase === 'VOTE') {
    checkAndResolveVotes(room)
  }
}

// Destroy a room if it has zero real (non-bot) players.
// Returns true if the room was destroyed.
export function checkAndDestroyEmptyRoom(roomId, room) {
  if (!room) return false
  const realPlayers = room.players.filter(p => !p.isBot)
  if (realPlayers.length === 0) {
    console.log('[ROOM] destroying empty room (no real players)', { roomId })
    rooms.delete(roomId)
    serverIo?.to(roomId).emit('room-closed', { message: 'Room closed — all players left.' })
    return true
  }
  return false
}

export function getActivePlayers(room) {
  return room.players.filter((p) => !p.eliminated && !p.spectator && p.status === 'PLAYING')
}

export function evaluateWinCondition(room) {
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

// shuffle imported from utils.js

export function assignSpecialRoles(room) {
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

export function startCluePhase(room) {
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

export function startVotePhase(room) {
  room.currentTurnPlayerId = null
  room.gamePhase = 'VOTE'
  room.votes = {}
  room.lockedVotes = []
  room.voteResult = null
  room.votingAttempt = 1
  console.log('[VOTE] phase started', { roomId: room.id })
}

export function isSilencedByFalafel(room, playerId) {
  if (!playerId) return false
  const vendor = room.players.find(p => p.specialRole === 'falafelVendor')
  return vendor && vendor.specialRoleData && vendor.specialRoleData.falafelTargetId === playerId
}

export function advanceTurn(room) {
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

export function assignWords(room) {
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
export function wordForRole(role, wordPair) {
  if (!wordPair) return null
  return role === 'MR_WHITE' ? null : (role === 'UNDERCOVER' ? wordPair.undercoverWord : wordPair.civilianWord)
}

export function syncPlayerPrivateState(room, player, socketOrId) {
  if (!player || !room.wordPair) return
  const targetSocket = typeof socketOrId === 'string' ? serverIo?.sockets?.sockets.get(socketOrId) : socketOrId
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
export function reassignHostIfNeeded(room) {
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


  export function checkAndResolveVotes(room) {
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


  export function executeGoddessDecision(room, goddess, target) {
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

  export function advanceAfterMrWhiteWrongGuess(roomId, expectedVersion) {
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

  export function scheduleGoddessTimeout(roomId, goddessId, durationMs) {
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

  export function scheduleRevengerTimeout(roomId, eliminatedId, durationMs) {
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
  export function advanceFromElimination(roomId, expectedVersion) {
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

