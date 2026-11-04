import codenamesWords from './words.js'
import { shuffle, generateCodenamesBoard } from './boardGenerator.js'

export function clearRoomBotTimers(room) {
  if (Array.isArray(room.botTimers)) {
    room.botTimers.forEach(t => clearTimeout(t))
  }
  room.botTimers = []
}

export function executeTableReset(room) {
  clearRoomBotTimers(room)
  const newStartingTeam = room.startingTeam === 'red' ? 'blue' : 'red'
  room.startingTeam = newStartingTeam
  room.currentTeam = newStartingTeam
  room.board = generateCodenamesBoard(newStartingTeam)
  room.tileVariantPools = { red: [], blue: [], neutral: [], assassin: [] }
  room.currentClue = null
  room.guessesLeft = null
  room.winner = null
  room.endReason = null
  room.turnHistory = []
  room.targetedCards = {}

  // Reset table completely: all players move to spectators to choose roles again on the main board
  if (Array.isArray(room.players)) {
    room.players.forEach(p => {
      p.team = null
      p.role = null
    })
  }
  room.teams = { red: [], blue: [] }
  room.spymasters = { red: null, blue: null }

  room.status = 'WAITING_FOR_PLAYERS'
  room.phase = 'WAITING_FOR_PLAYERS'
}

export function autoAssignCodenamesBots(room, checkTransitionFn) {
  if (!room || !Array.isArray(room.players)) return false

  const bots = room.players.filter(p => p.isBot)
  if (bots.length === 0) return false

  if (!room.teams) room.teams = { red: [], blue: [] }
  if (!room.spymasters) room.spymasters = { red: null, blue: null }

  const requiredSlots = [
    { team: 'red', role: 'SPYMASTER' },
    { team: 'blue', role: 'SPYMASTER' },
    { team: 'red', role: 'OPERATIVE' },
    { team: 'blue', role: 'OPERATIVE' }
  ]

  let assignedAny = false

  for (const slot of requiredSlots) {
    const isSlotFilled = room.players.some(p => p.team === slot.team && p.role === slot.role)
    if (!isSlotFilled) {
      const availableBot = bots.find(b => !b.team || !b.role)
      if (availableBot) {
        availableBot.team = slot.team
        availableBot.role = slot.role
        if (!room.teams[slot.team].includes(availableBot.id)) {
          room.teams[slot.team].push(availableBot.id)
        }
        if (slot.role === 'SPYMASTER') {
          room.spymasters[slot.team] = availableBot.id
        }
        assignedAny = true
      }
    }
  }

  // Any remaining unassigned bots become operatives on team with fewer players
  const remainingBots = bots.filter(b => !b.team || !b.role)
  for (const bot of remainingBots) {
    const redCount = room.players.filter(p => p.team === 'red').length
    const blueCount = room.players.filter(p => p.team === 'blue').length
    const team = redCount <= blueCount ? 'red' : 'blue'
    bot.team = team
    bot.role = 'OPERATIVE'
    if (!room.teams[team].includes(bot.id)) {
      room.teams[team].push(bot.id)
    }
    assignedAny = true
  }

  if (assignedAny && typeof checkTransitionFn === 'function') {
    checkTransitionFn(room)
  }

  return assignedAny
}

export function executeGiveClue(room, clueWord, clueNum) {
  const upper = String(clueWord).trim().toUpperCase()
  const isInfinity = clueNum === '∞' || clueNum === 'unlimited' || clueNum === 99
  const num = isInfinity ? '∞' : Number(clueNum)

  room.currentClue = { word: upper, number: num, team: room.currentTeam }
  room.phase = 'GUESS_PHASE'
  room.guessesLeft = (isInfinity || num === 0) ? 25 : (num + 1)

  const spymaster = room.players?.find(p => p.team === room.currentTeam && p.role === 'SPYMASTER')

  if (!Array.isArray(room.turnHistory)) room.turnHistory = []
  room.turnHistory.push({
    id: `turn-${Date.now()}-${room.turnHistory.length + 1}`,
    team: room.currentTeam,
    clue: { word: upper, number: num },
    spymaster: spymaster ? { id: spymaster.id, name: spymaster.name, avatar: spymaster.avatar, team: spymaster.team } : null,
    guesses: []
  })
}

export function assignNextTileVariant(room, card) {
  if (!card || !card.category) return
  if (card.tileVariant) return

  if (!room.tileVariantPools) {
    room.tileVariantPools = { red: [], blue: [], neutral: [], assassin: [] }
  }

  const cat = card.category
  if (!Array.isArray(room.tileVariantPools[cat]) || room.tileVariantPools[cat].length === 0) {
    room.tileVariantPools[cat] = shuffle(['a', 'b', 'c', 'd', 'e'])
  }

  card.tileVariant = room.tileVariantPools[cat].pop()
}

export function executeCardReveal(room, cardIndex, playerId = null) {
  if (typeof cardIndex !== 'number' || cardIndex < 0 || cardIndex >= room.board.length) return false
  const card = room.board[cardIndex]
  if (card.revealed) return false

  card.revealed = true
  if (playerId) card.revealedBy = playerId
  assignNextTileVariant(room, card)

  if (room.targetedCards) {
    for (const [pid, tIdx] of Object.entries(room.targetedCards)) {
      if (tIdx === cardIndex) delete room.targetedCards[pid]
    }
  }

  const opponentTeam = room.currentTeam === 'red' ? 'blue' : 'red'
  if (room.currentClue?.number !== '∞') {
    room.guessesLeft = Math.max(0, (room.guessesLeft || 1) - 1)
  }

  if (!Array.isArray(room.turnHistory)) room.turnHistory = []
  let currentTurn = room.turnHistory[room.turnHistory.length - 1]
  if (!currentTurn || currentTurn.team !== room.currentTeam) {
    const spymaster = room.players?.find(p => p.team === room.currentTeam && p.role === 'SPYMASTER')
    currentTurn = {
      id: `turn-${Date.now()}-${room.turnHistory.length + 1}`,
      team: room.currentTeam,
      clue: room.currentClue || { word: '?', number: 1 },
      spymaster: spymaster ? { id: spymaster.id, name: spymaster.name, avatar: spymaster.avatar, team: spymaster.team } : null,
      guesses: []
    }
    room.turnHistory.push(currentTurn)
  }
  const guesser = playerId ? room.players?.find(p => p.id === playerId) : null
  currentTurn.guesses.push({
    word: card.word,
    category: card.category,
    isOwnTeam: card.category === room.currentTeam,
    guesser: guesser ? { id: guesser.id, name: guesser.name, avatar: guesser.avatar, team: guesser.team } : null,
    guessedBy: guesser?.name || null,
    guesserId: playerId || null
  })

  if (card.category === 'assassin') {
    room.status = 'FINISHED'
    room.phase = 'FINISHED'
    room.winner = opponentTeam
    room.endReason = 'ASSASSIN'
    room.currentClue = null
    room.guessesLeft = 0
    room.targetedCards = {}
  } else if (card.category === room.currentTeam) {
    const remainingOwn = room.board.filter(c => c.category === room.currentTeam && !c.revealed).length
    if (remainingOwn === 0) {
      room.status = 'FINISHED'
      room.phase = 'FINISHED'
      room.winner = room.currentTeam
      room.endReason = 'ALL_AGENTS_FOUND'
      room.currentClue = null
      room.guessesLeft = 0
      room.targetedCards = {}
    } else if (room.currentClue?.number !== '∞' && room.guessesLeft <= 0) {
      room.currentTeam = opponentTeam
      room.phase = 'CLUE_PHASE'
      room.currentClue = null
      room.guessesLeft = null
      room.targetedCards = {}
    }
  } else if (card.category === opponentTeam) {
    const remainingOpponent = room.board.filter(c => c.category === opponentTeam && !c.revealed).length
    if (remainingOpponent === 0) {
      room.status = 'FINISHED'
      room.phase = 'FINISHED'
      room.winner = opponentTeam
      room.endReason = 'ALL_AGENTS_FOUND'
      room.currentClue = null
      room.guessesLeft = 0
      room.targetedCards = {}
    } else {
      room.currentTeam = opponentTeam
      room.phase = 'CLUE_PHASE'
      room.currentClue = null
      room.guessesLeft = null
      room.targetedCards = {}
    }
  } else {
    // Neutral
    room.currentTeam = opponentTeam
    room.phase = 'CLUE_PHASE'
    room.currentClue = null
    room.guessesLeft = null
    room.targetedCards = {}
  }

  if (room.status === 'FINISHED' && Array.isArray(room.board)) {
    room.board.forEach(c => {
      if (!c.tileVariant) assignNextTileVariant(room, c)
    })
  }

  return true
}

export function executeEndTurn(room) {
  const opponentTeam = room.currentTeam === 'red' ? 'blue' : 'red'
  room.currentTeam = opponentTeam
  room.phase = 'CLUE_PHASE'
  room.currentClue = null
  room.guessesLeft = null
  room.targetedCards = {}
}

export function triggerCodenamesBotTurn(room, broadcastFn) {
  if (!room || room.status !== 'PLAYING') return
  if (!Array.isArray(room.players) || !room.players.some(p => p.isBot)) return

  clearRoomBotTimers(room)
  if (!Array.isArray(room.botTimers)) room.botTimers = []

  const isFast = process.env.TEST_FAST_BOTS === 'true'

  // 1. SPYMASTER TURN
  if (room.phase === 'BOARD_READY' || room.phase === 'CLUE_PHASE') {
    const activeSpymaster = room.players.find(p => p.team === room.currentTeam && p.role === 'SPYMASTER')
    if (!activeSpymaster?.isBot) return

    const delay = isFast ? 40 : 1800
    const timer = setTimeout(() => {
      if (room.status !== 'PLAYING' || (room.phase !== 'BOARD_READY' && room.phase !== 'CLUE_PHASE')) return

      const boardWords = new Set((room.board || []).map(c => String(c.word).toUpperCase()))
      const candidates = codenamesWords.filter(w => !w.includes(' ') && !w.includes('-') && !boardWords.has(w.toUpperCase()))
      const clueWord = candidates[Math.floor(Math.random() * candidates.length)] || 'MYSTERY'

      const remainingOwn = (room.board || []).filter(c => c.category === room.currentTeam && !c.revealed).length
      let clueNum = 1
      if (remainingOwn >= 3) {
        const r = Math.random()
        clueNum = r < 0.45 ? 2 : r < 0.8 ? 1 : 3
      } else if (remainingOwn === 2) {
        clueNum = Math.random() < 0.6 ? 2 : 1
      } else {
        clueNum = 1
      }

      executeGiveClue(room, clueWord, clueNum)
      broadcastFn(room)
      triggerCodenamesBotTurn(room, broadcastFn)
    }, delay)

    room.botTimers.push(timer)
    return
  }

  // 2. OPERATIVE TURN
  if (room.phase === 'GUESS_PHASE') {
    const operatives = room.players.filter(p => p.team === room.currentTeam && p.role === 'OPERATIVE')
    const botOperative = operatives.find(p => p.isBot)
    if (!botOperative) return

    const hasHumanOperative = operatives.some(p => !p.isBot)
    const selectDelay = isFast ? 30 : (hasHumanOperative ? 8000 : 1600)

    const selectTimer = setTimeout(() => {
      if (room.status !== 'PLAYING' || room.phase !== 'GUESS_PHASE') return

      const unrevealed = (room.board || []).map((c, i) => ({ ...c, index: i })).filter(c => !c.revealed)
      if (unrevealed.length === 0) return

      const ownCards = unrevealed.filter(c => c.category === room.currentTeam)
      const neutralCards = unrevealed.filter(c => c.category === 'neutral')
      const opponentCards = unrevealed.filter(c => c.category === (room.currentTeam === 'blue' ? 'red' : 'blue'))
      const assassinCards = unrevealed.filter(c => c.category === 'assassin')

      let targetPool = ownCards
      const roll = Math.random()
      if (roll < 0.65 && ownCards.length > 0) {
        targetPool = ownCards
      } else if (roll < 0.85 && neutralCards.length > 0) {
        targetPool = neutralCards
      } else if (roll < 0.95 && opponentCards.length > 0) {
        targetPool = opponentCards
      } else if (assassinCards.length > 0) {
        targetPool = assassinCards
      } else {
        targetPool = unrevealed
      }

      const chosenCard = targetPool[Math.floor(Math.random() * targetPool.length)]
      if (!chosenCard) return

      // Visual targeting: bot avatar & name show on top-left of the word card
      if (!room.targetedCards) room.targetedCards = {}
      room.targetedCards[botOperative.id] = chosenCard.index
      broadcastFn(room)

      // Confirm pick after thinking delay
      const confirmDelay = isFast ? 30 : 1400
      const confirmTimer = setTimeout(() => {
        if (room.status !== 'PLAYING' || room.phase !== 'GUESS_PHASE') return

        delete room.targetedCards[botOperative.id]
        executeCardReveal(room, chosenCard.index, botOperative.id)

        // If turn remains active and bot still has guesses, decide whether to continue or pass
        if (room.status === 'PLAYING' && room.phase === 'GUESS_PHASE' && (room.guessesLeft > 0 || room.currentClue?.number === '∞')) {
          const passRoll = Math.random()
          if (passRoll < 0.3) {
            // End turn
            const endDelay = isFast ? 20 : 1000
            const endTimer = setTimeout(() => {
              if (room.status === 'PLAYING' && room.phase === 'GUESS_PHASE') {
                executeEndTurn(room)
                broadcastFn(room)
                triggerCodenamesBotTurn(room, broadcastFn)
              }
            }, endDelay)
            room.botTimers.push(endTimer)
          } else {
            // Continue guessing
            broadcastFn(room)
            triggerCodenamesBotTurn(room, broadcastFn)
          }
        } else {
          broadcastFn(room)
          triggerCodenamesBotTurn(room, broadcastFn)
        }
      }, confirmDelay)

      room.botTimers.push(confirmTimer)
    }, selectDelay)

    room.botTimers.push(selectTimer)
  }
}

