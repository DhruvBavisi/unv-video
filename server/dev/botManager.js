import { io as Client } from 'socket.io-client'
import crypto from 'crypto'

let serverPort = 3001
const botsByRoom = new Map()

export function initBotManager(port) {
  serverPort = port
  console.log(`[DEV BOT] Bot manager initialized on port ${port}`)
}

function createBot(roomId, botName) {
  const socket = Client(`http://localhost:${serverPort}`)
  const sessionId = crypto.randomUUID()
  
  let myRole = null
  let myWord = null
  let hasLockedVote = false
  let hasToggledReady = false
  
  socket.on('connect', () => {
    socket.emit('join-room', {
      sessionId,
      roomId,
      playerName: botName,
      isBot: true,
    })
  })

  socket.on('role-assigned', ({ role, word }) => {
    myRole = role
    myWord = word
  })

  socket.on('room-state', (room) => {
    // If we're not in the room anymore, disconnect
    if (!room.players.some(p => p.id === sessionId)) {
      socket.disconnect()
      return
    }

    const me = room.players.find(p => p.id === sessionId)
    
    // Check Mr. White Guess state
    if (me && me.eliminated && room.gamePhase === 'MR_WHITE_GUESS' && room.mrWhiteGuesserId === sessionId) {
      setTimeout(() => {
        socket.emit('submit-mr-white-guess', { guess: 'bot-guess' })
      }, 2000)
      return
    }

    if (!me || me.eliminated || me.spectator) return

    // Lobby
    if (room.status === 'LOBBY' && me.status !== 'READY' && !hasToggledReady) {
      hasToggledReady = true
      setTimeout(() => socket.emit('toggle-ready'), 500)
    }

    if (room.status === 'LOBBY' && me.status === 'READY') {
      hasToggledReady = false // Reset in case we return to lobby later
    }

    // Clue Phase
    if (room.status === 'ACTIVE' && room.gamePhase === 'CLUE') {
      hasLockedVote = false // reset for vote phase
      if (room.currentTurnPlayerId === sessionId && !room.submittedCluePlayerIds.includes(sessionId)) {
        setTimeout(() => {
          const clue = myRole === 'MR_WHITE' ? 'I know nothing' : `I see a ${myWord || 'thing'}`
          socket.emit('submit-clue', { clue })
        }, 1000 + Math.random() * 1500)
      }
    }

    // Vote Phase
    if (room.status === 'ACTIVE' && room.gamePhase === 'VOTE') {
      const attempt = room.votingAttempt || 1
      if (!room.lockedVotes.includes(sessionId) && hasLockedVote !== attempt) {
        hasLockedVote = attempt // Prevent firing timeouts multiple times
        
        const validTargets = room.players.filter(p => !p.eliminated && !p.spectator && p.id !== sessionId)
        if (validTargets.length > 0) {
          const tiedTargets = (room.voteResult?.tie && Array.isArray(room.voteResult?.tiedPlayers))
            ? validTargets.filter(p => room.voteResult.tiedPlayers.includes(p.id))
            : []
          const candidates = tiedTargets.length > 0 ? tiedTargets : validTargets
          const target = candidates[Math.floor(Math.random() * candidates.length)]

          setTimeout(() => {
            socket.emit('select-vote', { targetId: target.id })
            
            // Optionally change vote (20% chance if multiple candidates)
            if (Math.random() < 0.2 && candidates.length > 1) {
              setTimeout(() => {
                const target2 = candidates[Math.floor(Math.random() * candidates.length)]
                socket.emit('select-vote', { targetId: target2.id })
                setTimeout(() => socket.emit('lock-vote'), 1000)
              }, 1000)
            } else {
              setTimeout(() => socket.emit('lock-vote'), 1000)
            }
          }, 1500 + Math.random() * 2000)
        }
      }
    }
  })
  
  return socket
}

export function addBots(roomId, count) {
  if (!botsByRoom.has(roomId)) {
    botsByRoom.set(roomId, [])
  }
  const currentBots = botsByRoom.get(roomId)
  const names = ['Bot Alice', 'Bot Bob', 'Bot Charlie', 'Bot Diana']
  
  for (let i = 0; i < count; i++) {
    const name = names[currentBots.length % names.length]
    const botSocket = createBot(roomId, name)
    currentBots.push(botSocket)
    console.log(`[DEV BOT] ${name} joining room ${roomId}`)
  }
}

export function removeBots(roomId) {
  const currentBots = botsByRoom.get(roomId)
  if (currentBots) {
    currentBots.forEach(bot => bot.disconnect())
    botsByRoom.delete(roomId)
    console.log(`[DEV BOT] Bots removed from room ${roomId}`)
  }
}
