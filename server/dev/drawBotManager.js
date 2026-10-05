import { io as Client } from 'socket.io-client'
import crypto from 'crypto'

let serverPort = 3001
const botsByRoom = new Map()

export function initDrawBotManager(port) {
  serverPort = port
  console.log(`[DRAW DEV BOT] Bot manager initialized on port ${port}`)
}

function createBot(roomId, botName) {
  const socket = Client(`http://localhost:${serverPort}`)
  const sessionId = crypto.randomUUID()
  
  let currentPhase = 'LOBBY'
  let drawTimer = null
  let guessTimer = null
  let selectedWord = null
  let chatTimer = null

  socket.on('connect', () => {
    socket.emit('draw:join-room', {
      sessionId,
      roomId,
      playerName: botName,
      isBot: true,
    })
  })

  socket.on('draw:dev-secret-word', (word) => {
    selectedWord = word
  })

  socket.on('draw:room-state', (room) => {
    // Check if we are still in the room
    if (!room.players.some(p => p.id === sessionId)) {
      cleanup()
      socket.disconnect()
      return
    }

    const prevPhase = currentPhase
    currentPhase = room.phase

    // Handle being the drawer
    if (room.phase === 'WORD_SELECTION' && room.currentDrawerId === sessionId) {
      if (!selectedWord && room.wordChoices && room.wordChoices.length > 0) {
        selectedWord = room.wordChoices[0]
        setTimeout(() => {
          socket.emit('draw:choose-word', { wordIndex: 0 })
        }, 1000 + Math.random() * 1000)
      }
    } else {
      // If someone else is choosing or round restarts, clear our knowledge
      selectedWord = null
      clearTimeout(drawTimer)
    }

    // Handle DRAWING phase
    if (room.phase === 'DRAWING') {
      if (room.currentDrawerId === sessionId) {
        // I am drawing!
        if (prevPhase !== 'DRAWING' || !drawTimer) {
          startDrawing()
        }
      } else {
        // Someone else is drawing, try to guess
        if (prevPhase !== 'DRAWING' || !guessTimer) {
          startGuessing(room)
        }
        
        // Maybe react
        if (Math.random() < 0.2 && !chatTimer) {
          chatTimer = setTimeout(() => {
            const reaction = Math.random() < 0.5 ? 'LIKE' : 'DISLIKE'
            socket.emit('draw:reaction', reaction)
          }, 3000 + Math.random() * 5000)
        }
      }
    } else {
      cleanup()
    }
  })

  function cleanup() {
    clearTimeout(drawTimer)
    clearTimeout(guessTimer)
    clearTimeout(chatTimer)
    drawTimer = null
    guessTimer = null
    chatTimer = null
  }

  function startDrawing() {
    clearTimeout(drawTimer)
    let strokesDrawn = 0
    const maxStrokes = 5 + Math.floor(Math.random() * 10)
    
    const drawNextStroke = () => {
      if (currentPhase !== 'DRAWING') return
      
      const x1 = 0.2 + Math.random() * 0.6
      const y1 = 0.2 + Math.random() * 0.6
      const x2 = x1 + (Math.random() - 0.5) * 0.2
      const y2 = y1 + (Math.random() - 0.5) * 0.2

      socket.emit('draw:stroke', {
        tool: 'pencil',
        color: '#000000',
        size: 5,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }]
      })
      
      strokesDrawn++
      if (strokesDrawn < maxStrokes) {
        drawTimer = setTimeout(drawNextStroke, 1500 + Math.random() * 2000)
      }
    }
    
    drawTimer = setTimeout(drawNextStroke, 2000)
  }

  function startGuessing(room) {
    clearTimeout(guessTimer)
    let guessesMade = 0
    
    const makeGuess = () => {
      if (currentPhase !== 'DRAWING') return
      
      if (!selectedWord) {
        guessTimer = setTimeout(makeGuess, 2000)
        return
      }

      // If we already guessed correctly, stop
      if (room.guessedPlayerIds?.includes(sessionId)) return

      guessesMade++
      
      // 30% chance to just guess the right word after a few tries
      const shouldGuessCorrectly = guessesMade > 2 && Math.random() < 0.3
      
      if (shouldGuessCorrectly) {
        socket.emit('draw:guess', { message: selectedWord })
      } else {
        const fakeGuesses = ['apple', 'car', 'house', 'dog', 'cat', 'tree']
        const randomFake = fakeGuesses[Math.floor(Math.random() * fakeGuesses.length)]
        socket.emit('draw:guess', { message: randomFake })
      }
      
      guessTimer = setTimeout(makeGuess, 3000 + Math.random() * 4000)
    }
    
    guessTimer = setTimeout(makeGuess, 3000 + Math.random() * 3000)
  }
  
  return socket
}

export function addDrawBots(roomId, count) {
  if (!botsByRoom.has(roomId)) {
    botsByRoom.set(roomId, [])
  }
  const currentBots = botsByRoom.get(roomId)
  const names = ['Picasso Bot', 'Da Vinci Bot', 'Ross Bot', 'Kahlo Bot']
  
  for (let i = 0; i < count; i++) {
    const name = names[currentBots.length % names.length]
    const botSocket = createBot(roomId, name)
    currentBots.push(botSocket)
    console.log(`[DRAW DEV BOT] ${name} joining room ${roomId}`)
  }
}

export function removeDrawBots(roomId) {
  const currentBots = botsByRoom.get(roomId)
  if (currentBots) {
    currentBots.forEach(bot => bot.disconnect())
    botsByRoom.delete(roomId)
    console.log(`[DRAW DEV BOT] Bots removed from room ${roomId}`)
  }
}
