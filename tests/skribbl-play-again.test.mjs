import { io } from 'socket.io-client'
import assert from 'assert'

const URL = process.env.TEST_URL || 'http://localhost:3001'

function createClient(name) {
  const socket = io(URL, { transports: ['websocket'], reconnection: false })
  const sessionId = `test-${name}-${Math.random().toString(36).slice(2, 8)}`
  return {
    socket,
    name,
    sessionId,
    roomState: null,
    resumeToken: null
  }
}

function emitAck(socket, event, payload, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ${event}`)), timeoutMs)
    const cb = (res) => {
      clearTimeout(timer)
      resolve(res)
    }
    if (payload === undefined) {
      socket.emit(event, cb)
    } else {
      socket.emit(event, payload, cb)
    }
  })
}

function waitForRoomState(client, predicate, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (client.roomState && predicate(client.roomState)) {
      return resolve(client.roomState)
    }
    const timer = setTimeout(() => {
      client.socket.off('draw:room-state', onState)
      reject(new Error(`Timeout waiting for state predicate`))
    }, timeoutMs)
    const onState = (state) => {
      client.roomState = state
      if (predicate(state)) {
        clearTimeout(timer)
        client.socket.off('draw:room-state', onState)
        resolve(state)
      }
    }
    client.socket.on('draw:room-state', onState)
  })
}

async function playTurn(p1, p2) {
  // Wait for WORD_CHOICE
  const state = await waitForRoomState(p1, s => s.phase === 'WORD_CHOICE')
  const drawer = state.currentDrawerId === p1.sessionId ? p1 : p2
  const guesser = drawer === p1 ? p2 : p1

  const drawerState = await waitForRoomState(drawer, s => s.phase === 'WORD_CHOICE' && Array.isArray(s.wordChoices) && s.wordChoices.length > 0)
  const choices = drawerState.wordChoices
  const chosenWord = choices[0]
  await emitAck(drawer.socket, 'draw:choose-word', { word: chosenWord })

  // Wait for DRAWING
  await waitForRoomState(drawer, s => s.phase === 'DRAWING')

  // Guesser guesses correctly (draw:guess does not send ack)
  guesser.socket.emit('draw:guess', { message: chosenWord })

  // Wait for ROUND_REVEAL or GAME_RESULT
  await waitForRoomState(p1, s => s.phase === 'ROUND_REVEAL' || s.phase === 'GAME_RESULT', 10000)
}

async function run() {
  console.log(`Starting Skribbl Play Again & Individual Lobby Entry Verification against ${URL}...`)

  const p1 = createClient('HostP1')
  const p2 = createClient('GuestP2')

  await new Promise((res) => {
    let count = 0
    const onConnect = () => {
      count++
      if (count === 2) res()
    }
    p1.socket.on('connect', onConnect)
    p2.socket.on('connect', onConnect)
  })
  console.log('✓ Both clients connected')

  // Setup room listeners
  p1.socket.on('draw:room-state', s => { p1.roomState = s })
  p2.socket.on('draw:room-state', s => { p2.roomState = s })

  p1.socket.emit('register', { sessionId: p1.sessionId })
  p2.socket.emit('register', { sessionId: p2.sessionId })

  // 1. Create room
  const createRes = await emitAck(p1.socket, 'draw:create-room', {
    playerName: p1.name,
    sessionId: p1.sessionId
  })
  assert(createRes.room, 'Create room failed')
  const roomId = createRes.room.id
  console.log(`✓ Room created: ${roomId}`)

  // 2. Join room
  const joinRes = await emitAck(p2.socket, 'draw:join-room', {
    roomId,
    playerName: p2.name,
    sessionId: p2.sessionId
  })
  assert(joinRes.room, 'Join room failed')
  console.log('✓ P2 joined room')

  // 3. Configure for 1 round so game finishes after 2 turns
  p1.socket.emit('draw:update-config', { rounds: 1, drawTimeSec: 45 })
  await waitForRoomState(p1, s => s.configuration.rounds === 1)
  console.log('✓ Configured for 1 round')

  // 4. Start game
  const startRes = await emitAck(p1.socket, 'draw:start-game')
  assert(startRes.success, 'Start game failed')
  console.log('✓ Game started')

  // Play Turn 1
  console.log('Playing Turn 1...')
  await playTurn(p1, p2)
  console.log('✓ Turn 1 complete')

  // Wait for Turn 2 or GAME_RESULT
  if (p1.roomState.phase !== 'GAME_RESULT') {
    console.log('Playing Turn 2...')
    await playTurn(p1, p2)
    console.log('✓ Turn 2 complete')
  }

  // Wait for GAME_RESULT
  const resultState = await waitForRoomState(p1, s => s.phase === 'GAME_RESULT', 10000)
  assert(resultState.phase === 'GAME_RESULT', 'Room must be in GAME_RESULT')
  console.log('✓ Room reached GAME_RESULT')

  // Verify both players have scores
  const p1Record = resultState.players.find(p => p.id === p1.sessionId)
  const p2Record = resultState.players.find(p => p.id === p2.sessionId)
  assert(p1Record && p2Record, 'Both players must be in room')
  console.log(`Scores: P1=${p1Record.score}, P2=${p2Record.score}`)

  // 5. Guest (P2) opts in to Play Again first (Non-host opt in)
  console.log('P2 opting in to Play Again...')
  const p2PlayAgainAck = await emitAck(p2.socket, 'draw:play-again')
  assert(p2PlayAgainAck.success, 'P2 play-again ack must succeed')
  assert(p2PlayAgainAck.phase === 'GAME_RESULT', 'P2 ack phase must indicate GAME_RESULT transition')

  // Wait for P1 to receive state with P2 opted in
  const transitionalState = await waitForRoomState(p1, s => {
    const guest = s.players.find(p => p.id === p2.sessionId)
    return guest && guest.playAgain === true
  })

  // Room must STILL be in GAME_RESULT
  assert(transitionalState.phase === 'GAME_RESULT', 'Room must remain in GAME_RESULT while P1 has not opted in')
  
  // Scores must NOT be wiped yet
  const transP1 = transitionalState.players.find(p => p.id === p1.sessionId)
  const transP2 = transitionalState.players.find(p => p.id === p2.sessionId)
  assert(transP1.score === p1Record.score, 'P1 score must not be reset during transition')
  assert(transP2.score === p2Record.score, 'P2 score must not be reset during transition')
  console.log('✓ Non-host opt-in succeeded: P2 marked playAgain: true, room remains in GAME_RESULT, scores preserved')

  // 6. Host configures room during transitional GAME_RESULT
  console.log('Host updating config during GAME_RESULT...')
  p1.socket.emit('draw:update-config', { drawTimeSec: 60 })
  await waitForRoomState(p2, s => s.configuration.drawTimeSec === 60)
  console.log('✓ Host config update succeeded during transitional GAME_RESULT')

  // 7. Duplicate opt-in from P2 must be idempotent
  const dupAck = await emitAck(p2.socket, 'draw:play-again')
  assert(dupAck.success, 'Duplicate opt-in must succeed idempotently')
  console.log('✓ Duplicate play-again handled idempotently')

  // 8. Host (P1) opts in -> All eligible players opted in!
  console.log('Host (P1) opting in to Play Again...')
  const p1PlayAgainAck = await emitAck(p1.socket, 'draw:play-again')
  assert(p1PlayAgainAck.success, 'Host play-again ack must succeed')

  // Wait for both players to receive LOBBY state
  const finalLobby1 = await waitForRoomState(p1, s => s.phase === 'LOBBY')
  const finalLobby2 = await waitForRoomState(p2, s => s.phase === 'LOBBY')

  assert(finalLobby1.phase === 'LOBBY', 'P1 must receive LOBBY phase')
  assert(finalLobby2.phase === 'LOBBY', 'P2 must receive LOBBY phase')
  assert(finalLobby1.round === 1, 'Round must reset to 1')
  assert(finalLobby1.configuration.drawTimeSec === 60, 'Updated configuration must be preserved')
  assert(finalLobby1.players.every(p => p.score === 0), 'All player scores must reset to 0 in LOBBY')
  assert(finalLobby1.players.every(p => !p.playAgain), 'playAgain flags must be reset in LOBBY')
  console.log('✓ Full room reset to LOBBY succeeded once all players opted in')

  // 9. Disconnect during transition test
  // Start game again with 1 round
  console.log('\nTesting disconnect during transitional GAME_RESULT...')
  await emitAck(p1.socket, 'draw:start-game')
  await waitForRoomState(p1, s => s.phase === 'WORD_CHOICE')
  await playTurn(p1, p2)
  if (p1.roomState.phase !== 'GAME_RESULT') {
    await playTurn(p1, p2)
  }
  await waitForRoomState(p1, s => s.phase === 'GAME_RESULT')
  console.log('✓ Game 2 reached GAME_RESULT')

  // P1 opts in
  await emitAck(p1.socket, 'draw:play-again')
  await waitForRoomState(p1, s => {
    const host = s.players.find(p => p.id === p1.sessionId)
    return host && host.playAgain === true
  })
  assert(p1.roomState.phase === 'GAME_RESULT', 'P1 opted in, room still in GAME_RESULT awaiting P2')
  console.log('✓ P1 opted in')

  // Now P2 disconnects
  console.log('P2 disconnecting...')
  p2.socket.disconnect()

  // Room should automatically complete reset to LOBBY because all remaining connected players (P1) have opted in!
  const disconnectResetLobby = await waitForRoomState(p1, s => s.phase === 'LOBBY', 5000)
  assert(disconnectResetLobby.phase === 'LOBBY', 'Room must reset to LOBBY when non-opted-in player disconnects')
  console.log('✓ Disconnect of pending player triggered clean completion to LOBBY')

  // Cleanup
  p1.socket.disconnect()

  console.log('\n======================================================')
  console.log('ALL SKRIBBL PLAY AGAIN & INDIVIDUAL LOBBY ENTRY TESTS PASSED!')
  console.log('======================================================\n')
  process.exit(0)
}

run().catch(err => {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
})
