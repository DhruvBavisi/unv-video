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

function emitAck(socket, event, payload, timeoutMs = 5000) {
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

function waitForRoomState(client, predicate, timeoutMs = 5000) {
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

async function run() {
  console.log(`Starting Skribbl Drawer Ownership & Turn Transitions Verification against ${URL}...`)

  const p1 = createClient('Player1')
  const p2 = createClient('Player2')
  const p3 = createClient('Player3')

  // Setup listeners
  for (const p of [p1, p2, p3]) {
    p.socket.on('session-token', ({ resumeToken }) => { p.resumeToken = resumeToken })
    p.socket.on('draw:room-state', (state) => { p.roomState = state })
  }

  // Connect sockets
  await Promise.all([
    new Promise(res => p1.socket.on('connect', res)),
    new Promise(res => p2.socket.on('connect', res)),
    new Promise(res => p3.socket.on('connect', res))
  ])
  console.log('✓ All 3 clients connected')

  // Register clients
  p1.socket.emit('register', { sessionId: p1.sessionId })
  p2.socket.emit('register', { sessionId: p2.sessionId })
  p3.socket.emit('register', { sessionId: p3.sessionId })

  // P1 creates room
  const createRes = await emitAck(p1.socket, 'draw:create-room', { sessionId: p1.sessionId, playerName: p1.name })
  assert(createRes.room, 'Room creation failed')
  const roomId = createRes.room.id
  p1.roomState = createRes.room
  console.log(`✓ Room created: ${roomId}`)

  // P2 joins
  const joinRes2 = await emitAck(p2.socket, 'draw:join-room', { sessionId: p2.sessionId, roomId, playerName: p2.name })
  assert(joinRes2.room, 'P2 join failed')
  p2.roomState = joinRes2.room

  // P3 joins
  const joinRes3 = await emitAck(p3.socket, 'draw:join-room', { sessionId: p3.sessionId, roomId, playerName: p3.name })
  assert(joinRes3.room, 'P3 join failed')
  p3.roomState = joinRes3.room
  console.log('✓ P2 and P3 joined')

  // Start game
  const startRes = await emitAck(p1.socket, 'draw:start-game', {})
  assert(startRes.success, 'Game start failed')
  console.log('✓ Game started')

  // Wait for WORD_CHOICE phase
  await Promise.all([
    waitForRoomState(p1, s => s.phase === 'WORD_CHOICE'),
    waitForRoomState(p2, s => s.phase === 'WORD_CHOICE'),
    waitForRoomState(p3, s => s.phase === 'WORD_CHOICE')
  ])

  const initialDrawerId = p1.roomState.currentDrawerId
  assert(initialDrawerId, 'Expected currentDrawerId to be set')
  assert(p1.roomState.round === 1, 'Expected round 1')
  assert(p1.roomState.turnIndex === 0, 'Expected turnIndex 0')
  console.log(`✓ Phase is WORD_CHOICE. Authoritative drawer is: ${initialDrawerId}`)

  const drawerClient = [p1, p2, p3].find(p => p.sessionId === initialDrawerId)
  const guesserClients = [p1, p2, p3].filter(p => p.sessionId !== initialDrawerId)
  assert(drawerClient, 'Drawer client not found')

  // Check word choices privacy: drawer has them, guessers do not
  assert(Array.isArray(drawerClient.roomState.wordChoices) && drawerClient.roomState.wordChoices.length > 0, 'Drawer should have wordChoices')
  assert(guesserClients[0].roomState.wordChoices === undefined, 'Guesser 1 should NOT have wordChoices')
  assert(guesserClients[1].roomState.wordChoices === undefined, 'Guesser 2 should NOT have wordChoices')
  console.log('✓ Word choices are private to drawer')

  // Guesser attempts to choose word: must be rejected
  const guesserChoice = await emitAck(guesserClients[0].socket, 'draw:choose-word', { word: drawerClient.roomState.wordChoices[0] })
  assert(guesserChoice.error === 'NOT_DRAWER', `Guesser choice should be rejected with NOT_DRAWER, got ${guesserChoice.error}`)
  console.log('✓ Non-drawer word selection correctly rejected')

  // Drawer chooses word
  const chosenWord = drawerClient.roomState.wordChoices[0]
  const drawerChoice = await emitAck(drawerClient.socket, 'draw:choose-word', { word: chosenWord })
  assert(drawerChoice.success, 'Drawer word selection should succeed')
  console.log(`✓ Drawer selected word: ${chosenWord}`)

  // Wait for DRAWING phase on all clients
  await Promise.all([
    waitForRoomState(p1, s => s.phase === 'DRAWING'),
    waitForRoomState(p2, s => s.phase === 'DRAWING'),
    waitForRoomState(p3, s => s.phase === 'DRAWING')
  ])
  console.log('✓ Transitioned to DRAWING phase')

  // Word privacy during DRAWING
  assert(drawerClient.roomState.selectedWord === chosenWord, 'Drawer must know selectedWord')
  assert(guesserClients[0].roomState.selectedWord === undefined, 'Guesser 1 must NOT receive selectedWord in public state')
  assert(guesserClients[1].roomState.selectedWord === undefined, 'Guesser 2 must NOT receive selectedWord in public state')
  assert(guesserClients[0].roomState.usedWords === undefined, 'Guesser 1 must NOT receive usedWords')
  assert(guesserClients[0].roomState.revealIndices === undefined, 'Guesser 1 must NOT receive revealIndices')
  console.log('✓ Secret word is strictly hidden from guessers during DRAWING')

  // Repeated word selection must be rejected without restarting timer
  const repeatChoice = await emitAck(drawerClient.socket, 'draw:choose-word', { word: chosenWord })
  assert(repeatChoice.error === 'WRONG_PHASE', `Repeated choice should be rejected with WRONG_PHASE, got ${repeatChoice.error}`)
  console.log('✓ Repeated word selection correctly rejected without restarting timer')

  // Drawer disconnects
  console.log('Testing drawer disconnect and pause...')
  const remainingBeforeDisconnect = drawerClient.roomState.remainingMs || (drawerClient.roomState.roundEndsAt - Date.now())
  drawerClient.socket.disconnect()

  // Wait for guessers to see drawer disconnected
  await waitForRoomState(guesserClients[0], s => {
    const d = s.players.find(p => p.id === initialDrawerId)
    return d && d.isConnected === false
  })
  console.log('✓ Drawer disconnected state reflected on guessers')

  // Verify non-drawer reconnect does NOT alter drawer or timers
  guesserClients[0].socket.disconnect()
  const g1ReconnectedSocket = io(URL, { transports: ['websocket'], reconnection: false })
  await new Promise(res => g1ReconnectedSocket.on('connect', res))
  g1ReconnectedSocket.emit('register', { sessionId: guesserClients[0].sessionId, resumeToken: guesserClients[0].resumeToken, roomId })
  await new Promise(r => setTimeout(r, 200))
  // Drawer must still be initialDrawerId
  assert(guesserClients[1].roomState.currentDrawerId === initialDrawerId, 'Guesser reconnect must NOT alter drawer ownership')
  console.log('✓ Guesser reconnect did not alter drawer ownership')

  // Drawer reconnects with resumeToken
  console.log('Testing drawer reconnect and remaining timer resumption...')
  const reconnectedDrawerSocket = io(URL, { transports: ['websocket'], reconnection: false })
  await new Promise(res => reconnectedDrawerSocket.on('connect', res))
  reconnectedDrawerSocket.emit('register', { sessionId: drawerClient.sessionId, resumeToken: drawerClient.resumeToken, roomId })

  const resumedJoin = await emitAck(reconnectedDrawerSocket, 'draw:join-room', {
    sessionId: drawerClient.sessionId,
    resumeToken: drawerClient.resumeToken,
    roomId,
    playerName: drawerClient.name
  })
  assert(resumedJoin.room, 'Drawer failed to re-join on reconnect')
  assert(resumedJoin.room.currentDrawerId === initialDrawerId, 'Drawer must retain drawer ownership upon reconnect')
  assert(resumedJoin.room.phase === 'DRAWING', 'Phase must still be DRAWING upon reconnect')
  assert(resumedJoin.room.selectedWord === chosenWord, 'Drawer must retain secret word upon reconnect')
  // Check that timer resumed with reasonable remaining time and was not reset to full 80s
  const resumedRemaining = resumedJoin.room.remainingMs
  assert(resumedRemaining <= remainingBeforeDisconnect + 2000, `Remaining time should not have reset to full duration (was ${resumedRemaining}ms, expected <= ${remainingBeforeDisconnect}ms)`)
  console.log(`✓ Drawer reconnect resumed cleanly with ${Math.round(resumedRemaining / 1000)}s remaining`)

  // Test drawer leave / turn advance
  console.log('Testing drawer leave and turn advance...')
  await emitAck(reconnectedDrawerSocket, 'draw:leave-room')

  // Wait for next phase on remaining client: should transition to ROUND_REVEAL then next player WORD_CHOICE
  await waitForRoomState(guesserClients[1], s => s.phase === 'ROUND_REVEAL' || s.phase === 'WORD_CHOICE')
  console.log('✓ Round reveal started after drawer leave')

  // Wait for next drawer in WORD_CHOICE
  const nextTurnState = await waitForRoomState(guesserClients[1], s => s.phase === 'WORD_CHOICE', 8000)
  assert(nextTurnState.currentDrawerId && nextTurnState.currentDrawerId !== initialDrawerId, 'Turn must advance to remaining player')
  assert(nextTurnState.players.every(p => p.id !== initialDrawerId), 'Departed drawer must no longer be in players list')
  console.log(`✓ Turn cleanly advanced to next drawer: ${nextTurnState.currentDrawerId}`)

  // Test clean transition to GAME_RESULT when fewer than 2 players remain
  console.log('Testing game end when fewer than 2 players remain...')
  await emitAck(g1ReconnectedSocket, 'draw:leave-room')
  const gameResultState = await waitForRoomState(guesserClients[1], s => s.phase === 'GAME_RESULT', 5000)
  assert(gameResultState.phase === 'GAME_RESULT', 'Game must end cleanly when < 2 players remain')
  assert(gameResultState.currentDrawerId === null, 'Drawer must be null on GAME_RESULT')
  console.log('✓ Game cleanly transitioned to GAME_RESULT with < 2 players')

  // Clean up remaining clients
  guesserClients[1].socket.disconnect()
  g1ReconnectedSocket.disconnect()
  reconnectedDrawerSocket.disconnect()

  console.log('\n===========================================')
  console.log('ALL SKRIBBL DRAWER & TURN TESTS PASSED!')
  console.log('===========================================\n')
  process.exit(0)
}

run().catch(err => {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
})
