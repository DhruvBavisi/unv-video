const fs = require('fs')

let content = fs.readFileSync('server/server.js', 'utf8')

// S1. getCodenamesPublicState
content = content.replace(
  /category: card\.revealed \? card\.category : undefined\s*\}\)\) : undefined/,
  `category: card.revealed ? card.category : undefined
    })) : undefined,
    timer: room.timer || 'OFF',
    mode: room.mode || 'CLASSIC',
    wordPack: room.wordPack || 'ENGLISH',
    currentClue: room.currentClue || null,
    guessesLeft: room.guessesLeft ?? null,
    winner: room.winner || null,
    endReason: room.endReason || null`
)

// S2. codenames:update-settings
content = content.replace(
  /if \(settings\.timer !== undefined\) room\.timer = settings\.timer\s*if \(settings\.mode !== undefined\) room\.mode = settings\.mode[^\n]*\s*if \(settings\.wordPack !== undefined\) room\.wordPack = settings\.wordPack[^\n]*/,
  `if (!settings || typeof settings !== 'object') return callback?.({ success: false, error: 'INVALID_SETTINGS' })
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
    }`
)

// S3. codenames:start-game
content = content.replace(
  /if \(!room\.players\.some\(p => p\.team === 'blue' && p\.role === 'SPYMASTER'\)\) return callback\?\.(\{ success: false, error: 'BLUE_SPYMASTER_MISSING' \})/,
  `if (!room.players.some(p => p.team === 'blue' && p.role === 'SPYMASTER')) return callback?.({ success: false, error: 'BLUE_SPYMASTER_MISSING' })
    if (!room.players.some(p => p.team === 'red' && p.role === 'OPERATIVE')) return callback?.({ success: false, error: 'RED_OPERATIVES_MISSING' })
    if (!room.players.some(p => p.team === 'blue' && p.role === 'OPERATIVE')) return callback?.({ success: false, error: 'BLUE_OPERATIVES_MISSING' })`
)
content = content.replace(
  /room\.board = generateCodenamesBoard\(room\.startingTeam\)/,
  `room.board = generateCodenamesBoard(room.startingTeam)\n    room.currentClue = null\n    room.guessesLeft = null\n    room.winner = null\n    room.endReason = null`
)

// S4. codenames:give-clue
content = content.replace(
  /if \(room\.phase !== 'BOARD_READY' && room\.phase !== 'CLUE_PHASE'\) return callback\?\.(\{ success: false, error: 'INVALID_PHASE' \})\s*const clueStr = typeof payload\?\.clue === 'string' \? payload\.clue\.trim\(\) : ''\s*const num = parseInt\(payload\?\.number, 10\)\s*if \(!clueStr\) return callback\?\.(\{ success: false, error: 'EMPTY_CLUE' \})\s*if \(isNaN\(num\) \|\| num < 1\) return callback\?\.(\{ success: false, error: 'INVALID_NUMBER' \})\s*room\.currentClue = \{ word: clueStr, number: num \}/,
  `if (room.status !== 'PLAYING') return callback?.({ success: false, error: 'INVALID_PHASE' })
    if (room.phase !== 'BOARD_READY' && room.phase !== 'CLUE_PHASE') return callback?.({ success: false, error: 'INVALID_PHASE' })

    const clueStr = typeof payload?.clue === 'string' ? payload.clue.trim() : ''
    const num = Number(payload?.number)
    if (!clueStr) return callback?.({ success: false, error: 'EMPTY_CLUE' })
    if (clueStr.length > 25 || !/^[\\p{L}\\p{N}'-]+$/u.test(clueStr)) return callback?.({ success: false, error: 'INVALID_CLUE' })
    const upper = clueStr.toUpperCase()
    if (room.board.some(c => !c.revealed && String(c.word).toUpperCase() === upper)) return callback?.({ success: false, error: 'CLUE_MATCHES_BOARD_WORD' })
    if (!Number.isInteger(num) || num < 1 || num > 9) return callback?.({ success: false, error: 'INVALID_NUMBER' })
    
    room.currentClue = { word: upper, number: num, team: room.currentTeam }`
)

// S5. Add sync functions above disconnectCodenamesPlayer
content = content.replace(
  /function disconnectCodenamesPlayer\(sessionId, socketId\) \{/,
  `function syncCodenamesSpymasters(room) {
  room.spymasters = {
    red: room.players.find(p => p.team === 'red' && p.role === 'SPYMASTER')?.id || null,
    blue: room.players.find(p => p.team === 'blue' && p.role === 'SPYMASTER')?.id || null
  }
}

function checkCodenamesAbandonment(room) {
  if (room.status !== 'PLAYING') return
  for (const team of ['red', 'blue']) {
    const hasSpy = room.players.some(p => p.team === team && p.role === 'SPYMASTER')
    const hasOp = room.players.some(p => p.team === team && p.role === 'OPERATIVE')
    if (!hasSpy || !hasOp) {
      room.status = 'FINISHED'
      room.phase = 'GAME_OVER'
      room.winner = team === 'red' ? 'blue' : 'red'
      room.endReason = 'TEAM_ABANDONED'
      return
    }
  }
}

function disconnectCodenamesPlayer(sessionId, socketId) {`
)

// S5b & c. Update join-team-role
content = content.replace(
  /if \(role !== 'SPYMASTER' && role !== 'OPERATIVE' && role !== null\) return callback\?\.(\{ success: false, error: 'INVALID_ROLE' \})/,
  `if (role !== 'SPYMASTER' && role !== 'OPERATIVE' && role !== null) return callback?.({ success: false, error: 'INVALID_ROLE' })\n    if (team === null && role !== null) return callback?.({ success: false, error: 'INVALID_ROLE' })`
)

// Remove the two spymasters assignment blocks in join-team-role
content = content.replace(
  /let previousSpyId = null[\s\S]*?player\.team = team\s*player\.role = role\s*if \(team\) \{[\s\S]*?if \(!room\.teams\[team\]\.includes\(currentSessionId\)\) \{[\s\S]*?room\.teams\[team\]\.push\(currentSessionId\)[\s\S]*?\}[\s\S]*?if \(role === 'SPYMASTER'\) \{[\s\S]*?room\.spymasters\[team\] = currentSessionId[\s\S]*?\}[\s\S]*?\}/,
  `player.team = team
    player.role = role
    if (team && !room.teams[team].includes(currentSessionId)) {
      room.teams[team].push(currentSessionId)
    }`
)

// Note: I also need to make sure the targeted emit in join-team-role still works.
// Currently it uses previousSpyId which I just deleted. The instructions say "DELETE the two room.spymasters[...] assignment/clear blocks (the sync function replaces them)", so I have to adjust the private state emit logic. I'll just re-sync, and wait, if someone is demoted, they need a state emit.
content = content.replace(
  /socket\.emit\('codenames:room-state', getCodenamesPrivateState\(room, currentSessionId\)\)[\s\S]*?if \(previousSpyId\) \{[\s\S]*?const prevSocketId = sessionSockets\.get\(previousSpyId\)[\s\S]*?if \(prevSocketId\) \{[\s\S]*?const prevSocket = io\.sockets\.sockets\.get\(prevSocketId\)[\s\S]*?if \(prevSocket\) \{[\s\S]*?prevSocket\.emit\('codenames:room-state', getCodenamesPrivateState\(room, previousSpyId\)\)[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/,
  `syncCodenamesSpymasters(room)
    
    // Explicitly update all current and previous spymasters to ensure private states update
    for (const p of room.players) {
      if (p.role === 'SPYMASTER' || p.id === currentSessionId || room.teams.red.includes(p.id) || room.teams.blue.includes(p.id)) {
        const pSocketId = sessionSockets.get(p.id)
        if (pSocketId) {
          const pSocket = io.sockets.sockets.get(pSocketId)
          if (pSocket) pSocket.emit('codenames:room-state', getCodenamesPrivateState(room, p.id))
        }
      }
    }`
)

// Update codenames:host-kick-player
content = content.replace(
  /(socket\.on\('codenames:host-kick-player'[^]+?)broadcastCodenamesRoomState\(room\)/,
  `$1syncCodenamesSpymasters(room)\n    checkCodenamesAbandonment(room)\n    broadcastCodenamesRoomState(room)`
)

// Update removeCodenamesPlayer
content = content.replace(
  /(function removeCodenamesPlayer\(sessionId\) \{[^]+?)broadcastCodenamesRoomState\(room\)/,
  `$1syncCodenamesSpymasters(room)\n  checkCodenamesAbandonment(room)\n  broadcastCodenamesRoomState(room)`
)

// S6. disconnectCodenamesPlayer host transfer
content = content.replace(
  /player\.disconnectedAt = Date\.now\(\)/g,
  `player.disconnectedAt = Date.now()\n    if (player && room.status === 'LOBBY' && room.hostId === sessionId) {\n      const next = room.players.find(p => p.id !== sessionId && p.isConnected && !p.isBot)\n      if (next) { room.players.forEach(p => { p.isHost = false }); next.isHost = true; room.hostId = next.id }\n    }`
)

fs.writeFileSync('server/server.js', content)
console.log('updated server.js')
