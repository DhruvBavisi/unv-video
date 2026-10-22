import defaultWords from './drawWords.json' with { type: 'json' };
import { sessionSockets, connectPlayer, ensureResumeToken } from '../../shared/sessionRegistry.js';
import { makeRoomId, shuffle } from '../../shared/utils.js';

let serverIo = null;
export function setSkribblIo(io) {
  serverIo = io;
}

export const drawRooms = new Map();

export const drawRateLimiters = new Map()

export function checkDrawRateLimit(sessionId, eventType, maxEvents, windowMs) {
  if (!sessionId) return false
  const key = `${sessionId}:${eventType}`
  const now = Date.now()
  let timestamps = drawRateLimiters.get(key)
  if (!timestamps) {
    timestamps = []
    drawRateLimiters.set(key, timestamps)
  }
  const cutoff = now - windowMs
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift()
  }
  if (timestamps.length >= maxEvents) {
    return false
  }
  timestamps.push(now)
  return true
}

export function clearDrawRateLimits(sessionId) {
  if (!sessionId) return
  drawStrokeRateLimiters.delete(sessionId)
  for (const key of drawRateLimiters.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      drawRateLimiters.delete(key)
    }
  }
}

// Dedicated stroke rate limiter: tracks points and packets over sliding window
export const drawStrokeRateLimiters = new Map()

export function checkDrawStrokeRateLimit(sessionId, isComplete, pointCount) {
  if (!sessionId) return false
  const now = Date.now()
  const windowMs = 2000
  const maxPackets = 250 // 125 packets/sec is plenty for 60Hz live streaming + bursts
  const maxPoints = 10000 // 5000 pts/sec is far above human stylus/mouse capability

  let limiter = drawStrokeRateLimiters.get(sessionId)
  if (!limiter) {
    limiter = { packets: [], totalPoints: 0 }
    drawStrokeRateLimiters.set(sessionId, limiter)
  }

  // Prune expired entries
  const cutoff = now - windowMs
  while (limiter.packets.length > 0 && limiter.packets[0].time <= cutoff) {
    const expired = limiter.packets.shift()
    limiter.totalPoints -= expired.points
  }
  if (limiter.totalPoints < 0) limiter.totalPoints = 0

  // Completed strokes must never be discarded just because preceding live chunks used budget
  if (isComplete) {
    limiter.packets.push({ time: now, points: pointCount })
    limiter.totalPoints += pointCount
    return true
  }

  // Check packet budget
  if (limiter.packets.length >= maxPackets) {
    console.warn(`[Skribbl RateLimit] Session ${sessionId} exceeded packet limit (${limiter.packets.length}/${maxPackets} in ${windowMs}ms)`)
    return false
  }

  // Check point budget
  if (limiter.totalPoints + pointCount > maxPoints) {
    console.warn(`[Skribbl RateLimit] Session ${sessionId} exceeded point limit (${limiter.totalPoints + pointCount}/${maxPoints} in ${windowMs}ms)`)
    return false
  }

  limiter.packets.push({ time: now, points: pointCount })
  limiter.totalPoints += pointCount
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of drawRateLimiters.entries()) {
    while (timestamps.length > 0 && timestamps[0] <= now - 10000) {
      timestamps.shift()
    }
    if (timestamps.length === 0) {
      drawRateLimiters.delete(key)
    }
  }
  for (const [sId, limiter] of drawStrokeRateLimiters.entries()) {
    while (limiter.packets.length > 0 && limiter.packets[0].time <= now - 10000) {
      const expired = limiter.packets.shift()
      limiter.totalPoints -= expired.points
    }
    if (limiter.packets.length === 0) {
      drawStrokeRateLimiters.delete(sId)
    }
  }
}, 30000).unref?.()

export function findDrawRoomByPlayer(sessionId) {
  for (const [roomId, room] of drawRooms) {
    if (room.players.some((p) => p.id === sessionId)) {
      return { roomId, room }
    }
  }
  return { roomId: null, room: null }
}

  export function normalizeGuess(value) {
    if (typeof value !== 'string') return ''
    // Remove all non-alphanumeric characters, including spaces and hyphens
    return value.toLowerCase().replace(/[^a-z0-9]/gi, '')
  }

export function broadcastDrawRoomState(room) {
  if (!room) return
  room.version = (room.version || 0) + 1
  room.updatedAt = Date.now()
  for (const p of room.players) {
    try {
      serverIo?.to(p.id).emit('draw:room-state', getSafeStateForPlayer(room, p.id))
    } catch (err) {
      console.error('[DRAW] broadcast failed', {
        roomId: room.id,
        playerId: p.id,
        err
      })
    }
  }
}

export function resumeDrawTimersIfDrawer(room, sessionId) {
  if (!room || room.currentDrawerId !== sessionId) return

  if (room.phase === 'WORD_CHOICE') {
    if (room.wordChoiceTimeout === null && room.wordChoiceRemainingMs != null) {
      const remainingMs = room.wordChoiceRemainingMs
      room.wordChoiceRemainingMs = undefined
      scheduleWordChoiceTimeout(room, remainingMs)
    }
  } else if (room.phase === 'DRAWING') {
    if (room.turnTimeout === null && room.drawingRemainingMs != null) {
      const remainingMs = room.drawingRemainingMs
      room.drawingRemainingMs = undefined
      startDrawingTurn(room, room.selectedWord, true, remainingMs)
    }
  }
}

export function getSafeStateForPlayer(room, playerId) {
  const isDrawer = room.currentDrawerId === playerId
  const isReveal = room.phase === 'ROUND_REVEAL' || room.phase === 'GAME_RESULT'
  const hasGuessed = room.guessedPlayerIds?.includes(playerId)
  let remainingMs = null
  if (room.phase === 'DRAWING') {
    if (room.roundEndsAt) {
      remainingMs = Math.max(0, room.roundEndsAt - Date.now())
    } else if (room.drawingRemainingMs != null) {
      remainingMs = Math.max(0, room.drawingRemainingMs)
    }
  } else if (room.phase === 'WORD_CHOICE') {
    if (room.wordChoiceEndsAt) {
      remainingMs = Math.max(0, room.wordChoiceEndsAt - Date.now())
    } else if (room.wordChoiceRemainingMs != null) {
      remainingMs = Math.max(0, room.wordChoiceRemainingMs)
    }
  }

  return {
    ...room,
    version: room.version || 1,
    updatedAt: room.updatedAt || Date.now(),
    remainingMs,
    remainingSec: remainingMs != null ? Math.ceil(remainingMs / 1000) : null,
    players: room.players.map(p => ({ ...p })),
    chatMessages: [...(room.chatMessages || [])],
    wordChoices: (isDrawer && room.phase === 'WORD_CHOICE') ? room.wordChoices : undefined,
    selectedWord: (isDrawer || isReveal || hasGuessed) ? room.selectedWord : undefined,
    usedWords: undefined,
    revealIndices: undefined,
    hintRevealed: undefined,
    strokes: undefined,
    turnTimeout: undefined,
    wordChoiceTimeout: undefined,
    hintTimer: undefined,
    revealTimeout: undefined,
    nextTurnTimeout: undefined,
    playerRecords: undefined
  }
}

export function scheduleWordChoiceTimeout(room, durationMs = 15000) {
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

  const expectedRound = room.round
  const expectedTurnIndex = room.turnIndex
  const expectedDrawerId = room.currentDrawerId
  const expectedTurnSequence = room.turnSequence
  
  room.wordChoiceEndsAt = Date.now() + durationMs
  room.remainingMs = durationMs
  
  room.wordChoiceTimeout = setTimeout(() => {
    const currentRoom = drawRooms.get(room.id)
    if (
      currentRoom && 
      currentRoom.phase === 'WORD_CHOICE' && 
      currentRoom.round === expectedRound && 
      currentRoom.turnIndex === expectedTurnIndex &&
      currentRoom.currentDrawerId === expectedDrawerId &&
      currentRoom.turnSequence === expectedTurnSequence
    ) {
      currentRoom.wordChoiceTimeout = null
      currentRoom.wordChoiceEndsAt = null

      // Auto-select the first word if timeout expires
      if (!currentRoom.wordChoices || currentRoom.wordChoices.length === 0) {
        currentRoom.wordChoices = generateWordChoices(currentRoom)
      }
      const word = (currentRoom.wordChoices && currentRoom.wordChoices[0]) || 'apple'
      startDrawingTurn(currentRoom, word)
    }
  }, durationMs)
}

export function updateRoomHintString(room) {
  if (!room.selectedWord || !room.hintRevealed) return
  let str = ''
  for (let i = 0; i < room.selectedWord.length; i++) {
    str += room.hintRevealed[i] ? room.selectedWord[i] : '_'
  }
  room.hint = str
}

export function startDrawingTurn(room, word, isResume = false, resumeDurationMs = null) {
  if (room.turnTimeout) {
    clearTimeout(room.turnTimeout)
    room.turnTimeout = null
  }
  if (room.hintTimer) {
    clearInterval(room.hintTimer)
    room.hintTimer = null
  }
  if (room.wordChoiceTimeout) {
    clearTimeout(room.wordChoiceTimeout)
    room.wordChoiceTimeout = null
  }

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
  
  const baseDrawDuration = (room.configuration?.drawTimeSec || 80) * 1000
  let durationMs = baseDrawDuration
  if (isResume) {
    if (resumeDurationMs != null) {
      durationMs = Math.max(1000, resumeDurationMs)
    } else if (room.drawingRemainingMs != null) {
      durationMs = Math.max(1000, room.drawingRemainingMs)
      room.drawingRemainingMs = undefined
    } else if (room.roundEndsAt && room.roundEndsAt > Date.now()) {
      durationMs = Math.max(1000, room.roundEndsAt - Date.now())
    }
  }
  
  room.roundEndsAt = Date.now() + durationMs
  room.remainingMs = durationMs

  // Initialize Hint System
  let numHints = room.configuration?.hints ?? 2
  if (word && word.length >= 10) numHints = 3
  const isHidden = typeof room.configuration?.gameMode === 'string' && room.configuration.gameMode.toUpperCase() === 'HIDDEN'
  
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
      const hintIntervalMs = isResume ? (durationMs / (hintsRemaining + 1)) : (((room.configuration?.drawTimeSec || 80) * 1000) / (room.hintsToGive + 1))
      const expectedDrawerId = room.currentDrawerId
      const expectedRound = room.round
      const expectedTurnIndex = room.turnIndex
      const expectedTurnSequence = room.turnSequence
      
      room.hintTimer = setInterval(() => {
        const checkRoom = drawRooms.get(room.id)
        if (
          !checkRoom || 
          checkRoom.phase !== 'DRAWING' || 
          checkRoom.round !== expectedRound ||
          checkRoom.turnIndex !== expectedTurnIndex ||
          checkRoom.currentDrawerId !== expectedDrawerId ||
          checkRoom.turnSequence !== expectedTurnSequence
        ) {
          if (room.hintTimer) {
            clearInterval(room.hintTimer)
            room.hintTimer = null
          }
          return
        }
        if (checkRoom.hintsGiven >= checkRoom.hintsToGive) {
          if (checkRoom.hintTimer) {
            clearInterval(checkRoom.hintTimer)
            checkRoom.hintTimer = null
          }
          return
        }
        
        const idx = checkRoom.revealIndices[checkRoom.hintsGiven]
        checkRoom.hintRevealed[idx] = true
        checkRoom.hintsGiven++
        updateRoomHintString(checkRoom)
        broadcastDrawRoomState(checkRoom)
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
  
  
  // Schedule round end
  const expectedTurnIndex = room.turnIndex
  const expectedRound = room.round
  const expectedDrawerId = room.currentDrawerId
  const expectedTurnSequence = room.turnSequence
  
  room.turnTimeout = setTimeout(() => {
    const checkRoom = drawRooms.get(room.id)
    if (
      checkRoom && 
      checkRoom.phase === 'DRAWING' && 
      checkRoom.round === expectedRound && 
      checkRoom.turnIndex === expectedTurnIndex &&
      checkRoom.currentDrawerId === expectedDrawerId &&
      checkRoom.turnSequence === expectedTurnSequence
    ) {
      endDrawRound(checkRoom)
    }
  }, durationMs)
}

export function endDrawRound(room, { broadcast = true, scheduleNext = true, originalDrawerId = null, originalDrawer = null, drawerId = null, drawerPlayer: passedDrawerPlayer = null, drawerRecord: passedDrawerRecord = null } = {}) {
  if (room.phase !== 'DRAWING' && room.phase !== 'WORD_CHOICE') return
  
  if (room.turnTimeout) {
    clearTimeout(room.turnTimeout)
    room.turnTimeout = null
  }
  if (room.hintTimer) {
    clearInterval(room.hintTimer)
    room.hintTimer = null
  }
  if (room.wordChoiceTimeout) {
    clearTimeout(room.wordChoiceTimeout)
    room.wordChoiceTimeout = null
  }

  room.phase = 'ROUND_REVEAL'
  room.roundEndsAt = null
  room.wordChoiceEndsAt = null
  room.remainingMs = null
  room.drawingRemainingMs = undefined
  room.wordChoiceRemainingMs = undefined
  room.hint = ''
  room.hintRevealed = null
  
  // Calculate and apply points
  const targetDrawerId = originalDrawerId || drawerId || room.currentDrawerId
  const drawerPlayer = (targetDrawerId && room.players.find(p => p.id === targetDrawerId)) || originalDrawer || passedDrawerPlayer || null
  const drawerRecord = (targetDrawerId && room.playerRecords && room.playerRecords[targetDrawerId]) || passedDrawerRecord || null
  let drawerPoints = 0
  
  room.turnScores = room.turnScores || {}
  
  if (drawerPlayer || drawerRecord) {
    const sum = Object.values(room.turnScores).reduce((a, b) => a + b, 0)
    drawerPoints = Math.round(sum * 0.5)
    if (drawerPlayer) {
      drawerPlayer.score = (drawerPlayer.score || 0) + drawerPoints
    }
    if (targetDrawerId) {
      room.turnScores[targetDrawerId] = drawerPoints
      if (drawerRecord) {
        drawerRecord.score = drawerPlayer ? drawerPlayer.score : ((drawerRecord.score || 0) + drawerPoints)
      }
    }
  }
  
  // Apply guesser points to persistent totals exactly once here
  for (const [pid, pts] of Object.entries(room.turnScores)) {
    if (pid !== targetDrawerId) {
      const p = room.players.find(x => x.id === pid)
      if (p) {
        p.score += pts
        if (room.playerRecords && room.playerRecords[pid]) {
          room.playerRecords[pid].score = p.score
        }
      } else if (room.playerRecords && room.playerRecords[pid]) {
        room.playerRecords[pid].score = (room.playerRecords[pid].score || 0) + pts
      }
    }
  }
  
  // Add system message
  room.chatMessages = room.chatMessages || []
  room.chatMessages.push({
    id: crypto.randomUUID(),
    type: 'SYSTEM',
    message: `The word was ${room.selectedWord || '(None Selected)'}.`
  })
  if (room.chatMessages.length > 100) room.chatMessages.shift()
  
  if (broadcast) broadcastDrawRoomState(room)

  room.turnSequence = (room.turnSequence || 0) + 1
  if (!scheduleNext) return

  const expectedTurnSequence = room.turnSequence
  const expectedRound = room.round
  
  // Schedule next turn
  room.turnTimeout = setTimeout(() => {
    const currentRoom = drawRooms.get(room.id)
    if (
      !currentRoom || 
      currentRoom.phase !== 'ROUND_REVEAL' || 
      currentRoom.round !== expectedRound || 
      currentRoom.turnSequence !== expectedTurnSequence
    ) {
      return
    }

    currentRoom.turnTimeout = null
    currentRoom.turnSequence = (currentRoom.turnSequence || 0) + 1

    // Filter turnOrder to only current eligible non-spectator players without duplicates
    const eligibleSet = new Set(currentRoom.players.filter(p => !p.spectator).map(p => p.id))
    currentRoom.turnOrder = Array.from(new Set((currentRoom.turnOrder || []).filter(id => eligibleSet.has(id))))

    const eligiblePlayers = currentRoom.players.filter(p => !p.spectator)
    if (eligiblePlayers.length < 2) {
      currentRoom.phase = 'GAME_RESULT'
      currentRoom.currentDrawerId = null
      broadcastDrawRoomState(currentRoom)
      return
    }

    currentRoom.turnIndex = Math.max(0, (currentRoom.turnIndex ?? -1) + 1)
    
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
      currentRoom.drawingRemainingMs = undefined
      currentRoom.wordChoiceRemainingMs = undefined
      
      serverIo?.to(`draw:${currentRoom.id}`).emit('draw:clear-canvas')
      scheduleWordChoiceTimeout(currentRoom)
      broadcastDrawRoomState(currentRoom)
    } else {
      // End of round
      if (currentRoom.round < currentRoom.totalRounds) {
        currentRoom.round++
        
        // Fisher-Yates shuffle using unique eligible player IDs
        const playerIds = Array.from(new Set(eligiblePlayers.map(p => p.id)))
        if (playerIds.length < 2) {
          currentRoom.phase = 'GAME_RESULT'
          currentRoom.currentDrawerId = null
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
        currentRoom.drawingRemainingMs = undefined
        currentRoom.wordChoiceRemainingMs = undefined
        
        serverIo?.to(`draw:${currentRoom.id}`).emit('draw:clear-canvas')
        scheduleWordChoiceTimeout(currentRoom)
        broadcastDrawRoomState(currentRoom)
      } else {
        // End of game
        currentRoom.phase = 'GAME_RESULT'
        currentRoom.currentDrawerId = null
        broadcastDrawRoomState(currentRoom)
      }
    }
  }, 5000)
}

export function generateWordChoices(room) {
  room.usedWords = room.usedWords || []
  
  let customWords = []
  if (Array.isArray(room.configuration?.customWords)) {
    customWords = room.configuration.customWords.map(w => typeof w === 'string' ? w.trim() : '').filter(Boolean)
  } else if (typeof room.configuration?.customWords === 'string') {
    customWords = room.configuration.customWords.split(',').map(w => w.trim()).filter(Boolean)
  }

  // Build pool based on mode
  let pool = []
  if (room.configuration?.useCustomOnly) {
    pool = [...customWords]
    if (pool.length === 0) {
      // Fallback if custom words list is empty or invalid
      pool = [...defaultWords]
    }
  } else if (room.configuration?.gameMode && room.configuration.gameMode.toLowerCase() === 'combination') {
    pool = [...defaultWords, ...customWords]
  } else {
    pool = [...defaultWords]
  }
  
  // Deduplicate pool (case-insensitive, keep first occurrence)
  const seen = new Set()
  pool = pool.filter(w => {
    if (!w || typeof w !== 'string') return false
    const key = w.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  
  if (pool.length === 0) {
    pool = [...defaultWords]
  }

  // Remove already-used words (case-insensitive)
  let eligible = pool.filter(w => !room.usedWords.includes(w.toLowerCase()))
  
  // If all eligible words in pool have been exhausted, recycle the pool
  if (eligible.length === 0 && pool.length > 0) {
    room.usedWords = []
    eligible = [...pool]
  }

  if (eligible.length === 0) {
    eligible = [...defaultWords]
  }

  // Fisher-Yates shuffle on a copy
  const shuffled = [...eligible]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  
  const count = room.configuration?.wordCount || 3
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function isDrawSocketOwner(sessionId, socket) {
  return Boolean(sessionId && socket && sessionSockets.get(sessionId) === socket.id)
}

export function reassignDrawHostIfNeeded(room) {
  if (!room || !Array.isArray(room.players)) return
  const currentHost = room.players.find((p) => p.id === room.hostId)
  if (currentHost && currentHost.isConnected) {
    room.players.forEach((p) => { p.isHost = p.id === room.hostId })
    return
  }

  const next = room.players.find((p) => p.isConnected)
  if (!next) return

  room.players.forEach((p) => { p.isHost = p.id === next.id })
  room.hostId = next.id
}

export function disconnectDrawPlayer(sessionId, socketId) {
  if (!sessionId) return
  if (socketId && sessionSockets.get(sessionId) !== socketId) {
    return
  }

  for (const [rid, dr] of drawRooms) {
    if (!dr || !Array.isArray(dr.players)) continue
    const player = dr.players.find((p) => p.id === sessionId)
    if (player) {
      player.isConnected = false
      player.disconnectedAt = Date.now()
      if (dr.hostId === sessionId) {
        reassignDrawHostIfNeeded(dr)
      }

      // Pause drawer timers ONLY if the disconnected player is the current drawer
      if (dr.currentDrawerId === sessionId) {
        if (dr.phase === 'WORD_CHOICE') {
          if (dr.wordChoiceTimeout) {
            clearTimeout(dr.wordChoiceTimeout)
            dr.wordChoiceTimeout = null
          }
          if (dr.wordChoiceEndsAt) {
            const rem = Math.max(0, dr.wordChoiceEndsAt - Date.now())
            dr.wordChoiceEndsAt = null
            if (rem <= 0) {
              dr.wordChoiceRemainingMs = undefined
              if (!dr.wordChoices || dr.wordChoices.length === 0) {
                endDrawRound(dr)
              } else {
                startDrawingTurn(dr, dr.wordChoices[0])
              }
            } else {
              dr.wordChoiceRemainingMs = rem
              dr.remainingMs = rem
            }
          }
        } else if (dr.phase === 'DRAWING') {
          if (dr.turnTimeout) {
            clearTimeout(dr.turnTimeout)
            dr.turnTimeout = null
          }
          if (dr.hintTimer) {
            clearInterval(dr.hintTimer)
            dr.hintTimer = null
          }
          if (dr.roundEndsAt) {
            const rem = Math.max(0, dr.roundEndsAt - Date.now())
            dr.roundEndsAt = null
            if (rem <= 0) {
              dr.drawingRemainingMs = undefined
              endDrawRound(dr)
            } else {
              dr.drawingRemainingMs = rem
              dr.remainingMs = rem
            }
          }
        }
      }

      if (!socketId || sessionSockets.get(sessionId) === socketId) {
        sessionSockets.delete(sessionId)
      }

      if (dr.phase === 'GAME_RESULT') {
        checkDrawPlayAgainCompletion(dr)
      }

      broadcastDrawRoomState(dr)

      break
    }
  }
}

export function resetDrawRoomToLobby(room) {
  if (room.turnTimeout) clearTimeout(room.turnTimeout)
  if (room.wordChoiceTimeout) clearTimeout(room.wordChoiceTimeout)
  if (room.hintTimer) clearInterval(room.hintTimer)

  room.turnTimeout = null
  room.wordChoiceTimeout = null
  room.hintTimer = null

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
  room.usedWords = []
  room.turnSequence = 0
  room.roundEndsAt = null
  room.wordChoiceEndsAt = null
  room.remainingMs = null
  room.drawingRemainingMs = undefined
  room.wordChoiceRemainingMs = undefined
  room.hint = ''
  room.hintRevealed = null

  room.players.forEach(p => {
    p.spectator = false
    p.score = 0
    p.playAgain = false
  })

  if (room.playerRecords) {
    for (const rec of Object.values(room.playerRecords)) {
      rec.score = 0
      rec.playAgain = false
    }
  }

  serverIo?.to(`draw:${room.id}`).emit('draw:clear-canvas')
  broadcastDrawRoomState(room)
}

export function checkDrawPlayAgainCompletion(room) {
  if (!room || room.phase !== 'GAME_RESULT') return false

  const eligiblePlayers = room.players.filter(p => p.isConnected && !p.departed && !p.kicked)
  if (eligiblePlayers.length === 0) return false

  const allOptedIn = eligiblePlayers.every(p => p.playAgain)
  if (allOptedIn) {
    resetDrawRoomToLobby(room)
    return true
  }
  return false
}

export function removeDrawPlayer(sessionId, { isKick = false } = {}) {
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

  // Preserve departing player reference and drawer identity before modifying room
  const departingPlayerId = sessionId
  const departingPlayer = foundRoom.players[idx]
  const departingPlayerRecord = foundRoom.playerRecords ? foundRoom.playerRecords[sessionId] : null
  const wasHost = departingPlayer.isHost
  const isDrawer = foundRoom.currentDrawerId === sessionId
  const originalDrawerId = foundRoom.currentDrawerId
  const originalDrawer = isDrawer ? departingPlayer : (foundRoom.players.find(p => p.id === originalDrawerId) || null)

  if (departingPlayerRecord) {
    departingPlayerRecord.departed = true
    if (isKick) {
      departingPlayerRecord.kicked = true
    }
  }

  if (isDrawer) {
    foundRoom.currentDrawerId = null
  }

  const kickedTurnIndex = foundRoom.turnOrder
    ? foundRoom.turnOrder.indexOf(sessionId)
    : -1

  if (foundRoom.turnOrder) {
    foundRoom.turnOrder = foundRoom.turnOrder.filter(id => id !== sessionId)

    if (
      kickedTurnIndex !== -1 &&
      foundRoom.turnIndex !== undefined &&
      kickedTurnIndex <= foundRoom.turnIndex
    ) {
      foundRoom.turnIndex--
    }
  }

  foundRoom.players.splice(idx, 1)

  if (foundRoom.guessedPlayerIds) {
    foundRoom.guessedPlayerIds =
      foundRoom.guessedPlayerIds.filter(id => id !== sessionId)
  }

  clearDrawRateLimits(sessionId)

  const remainingPlayers = foundRoom.players

  // Preserve existing empty-room cleanup.
  if (remainingPlayers.length === 0) {
    console.log('[ROOM] destroying empty draw room', {
      roomId: foundRoomId
    })

    if (foundRoom.turnTimeout) clearTimeout(foundRoom.turnTimeout)
    if (foundRoom.wordChoiceTimeout) clearTimeout(foundRoom.wordChoiceTimeout)
    if (foundRoom.hintTimer) clearInterval(foundRoom.hintTimer)

    foundRoom.turnTimeout = null
    foundRoom.wordChoiceTimeout = null
    foundRoom.hintTimer = null
    foundRoom.turnSequence = (foundRoom.turnSequence || 0) + 1

    for (const p of foundRoom.players) {
      clearDrawRateLimits(p.id)
    }
    clearDrawRateLimits(departingPlayerId)

    drawRooms.delete(foundRoomId)
    serverIo?.to(`draw:${foundRoomId}`).emit('room-closed', {
      message: 'Room closed — all players left.'
    })

    return { roomId: foundRoomId, room: null }
  }

  const eligiblePlayers = foundRoom.players.filter(p => !p.spectator)
  const isActiveGame =
    foundRoom.phase !== 'LOBBY' &&
    foundRoom.phase !== 'GAME_RESULT'

  // End the game if fewer than two eligible players remain.
  if (isActiveGame && eligiblePlayers.length < 2) {
    if (
      foundRoom.phase === 'WORD_CHOICE' ||
      foundRoom.phase === 'DRAWING'
    ) {
      // Settle the current turn once, without broadcasting an intermediate
      // reveal state or scheduling another turn.
      endDrawRound(foundRoom, {
        broadcast: false,
        scheduleNext: false,
        originalDrawerId,
        originalDrawer,
        drawerRecord: isDrawer ? departingPlayerRecord : null
      })
    } else {
      // A ROUND_REVEAL may already have settled this turn's scores.
      foundRoom.turnSequence = (foundRoom.turnSequence || 0) + 1
    }

    if (foundRoom.turnTimeout) clearTimeout(foundRoom.turnTimeout)
    if (foundRoom.wordChoiceTimeout) clearTimeout(foundRoom.wordChoiceTimeout)
    if (foundRoom.hintTimer) clearInterval(foundRoom.hintTimer)

    foundRoom.turnTimeout = null
    foundRoom.wordChoiceTimeout = null
    foundRoom.hintTimer = null

    foundRoom.phase = 'GAME_RESULT'
    foundRoom.currentDrawerId = null
    foundRoom.roundEndsAt = null
    foundRoom.wordChoiceEndsAt = null
    foundRoom.remainingMs = null
    foundRoom.drawingRemainingMs = undefined
    foundRoom.wordChoiceRemainingMs = undefined
  } else if (
    isDrawer &&
    (foundRoom.phase === 'WORD_CHOICE' ||
      foundRoom.phase === 'DRAWING')
  ) {
    // Keep the existing round-ending/next-turn flow when enough players remain.
    endDrawRound(foundRoom, {
      originalDrawerId,
      originalDrawer,
      drawerRecord: departingPlayerRecord
    })
  } else if (
    !isDrawer &&
    foundRoom.phase === 'DRAWING'
  ) {
    // If a guesser departs and all remaining active guessers have already guessed, end the turn early
    const remainingGuessers = foundRoom.players.filter(p => !p.spectator && p.id !== foundRoom.currentDrawerId)
    const allRemainingGuessed = remainingGuessers.length > 0 && remainingGuessers.every(p => foundRoom.guessedPlayerIds && foundRoom.guessedPlayerIds.includes(p.id))
    if (allRemainingGuessed) {
      endDrawRound(foundRoom)
    }
  }

  if (wasHost) {
    const nextHost =
      foundRoom.players.find(p => p.isConnected) ||
      foundRoom.players[0]

    if (nextHost) {
      foundRoom.players.forEach(p => {
        p.isHost = p.id === nextHost.id
      })
      foundRoom.hostId = nextHost.id
      serverIo?.to(nextHost.id).emit('draw:host-promoted')
    }
  }

  if (foundRoom.phase === 'GAME_RESULT') {
    checkDrawPlayAgainCompletion(foundRoom)
  }

  return { roomId: foundRoomId, room: foundRoom }
}
