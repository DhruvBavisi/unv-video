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
  console.log(`Starting Skribbl Room Lifecycle Hardening Verification against ${URL}...`)

  const p1 = createClient('Host')
  const p2 = createClient('Player2')
  const p3 = createClient('Player3')

  for (const p of [p1, p2, p3]) {
    p.socket.on('session-token', ({ resumeToken }) => { p.resumeToken = resumeToken })
    p.socket.on('draw:room-state', (state) => { p.roomState = state })
  }

  await Promise.all([
    new Promise(res => p1.socket.on('connect', res)),
    new Promise(res => p2.socket.on('connect', res)),
    new Promise(res => p3.socket.on('connect', res))
  ])
  console.log('✓ All 3 clients connected')

  p1.socket.emit('register', { sessionId: p1.sessionId })
  p2.socket.emit('register', { sessionId: p2.sessionId })
  p3.socket.emit('register', { sessionId: p3.sessionId })

  // 1. Create Room & Test Duplicate Create Request Idempotency
  const createRes1 = await emitAck(p1.socket, 'draw:create-room', { sessionId: p1.sessionId, playerName: p1.name })
  assert(createRes1.room, 'Room creation failed')
  const roomId = createRes1.room.id
  p1.roomState = createRes1.room

  // Duplicate create request by same host
  const duplicateCreate = await emitAck(p1.socket, 'draw:create-room', { sessionId: p1.sessionId, playerName: p1.name })
  assert(duplicateCreate.room && duplicateCreate.room.id === roomId, 'Duplicate create-room should return existing room state idempotently')
  console.log('✓ Duplicate create-room request handled idempotently')

  // 2. Join players
  const joinRes2 = await emitAck(p2.socket, 'draw:join-room', { sessionId: p2.sessionId, roomId, playerName: p2.name })
  assert(joinRes2.room, 'P2 join failed')
  p2.roomState = joinRes2.room

  const joinRes3 = await emitAck(p3.socket, 'draw:join-room', { sessionId: p3.sessionId, roomId, playerName: p3.name })
  assert(joinRes3.room, 'P3 join failed')
  p3.roomState = joinRes3.room
  console.log('✓ P2 and P3 joined')

  // 3. Test Kick Player & Rejection of Kicked Player Rejoin
  let kickedEventReceived = false
  p3.socket.on('draw:kicked', () => { kickedEventReceived = true })

  const kickRes = await emitAck(p1.socket, 'draw:kick-player', { targetId: p3.sessionId })
  assert(kickRes.success, 'Kick player should succeed')
  await new Promise(r => setTimeout(r, 200))
  assert(kickedEventReceived, 'Target player should receive draw:kicked event')
  console.log('✓ Host kicked P3 and P3 received draw:kicked')

  // P3 attempts to rejoin the room with their token
  const rejoinKicked = await emitAck(p3.socket, 'draw:join-room', {
    sessionId: p3.sessionId,
    resumeToken: p3.resumeToken,
    roomId,
    playerName: p3.name
  })
  assert(rejoinKicked.error === 'KICKED_FROM_ROOM', `Kicked player rejoin should be rejected with KICKED_FROM_ROOM, got ${rejoinKicked.error}`)
  console.log('✓ Kicked player cannot rejoin room')

  // Add a new player 4 so we have enough players to test gameplay
  const p4 = createClient('Player4')
  p4.socket.on('session-token', ({ resumeToken }) => { p4.resumeToken = resumeToken })
  p4.socket.on('draw:room-state', (state) => { p4.roomState = state })
  await new Promise(res => p4.socket.on('connect', res))
  p4.socket.emit('register', { sessionId: p4.sessionId })
  const joinRes4 = await emitAck(p4.socket, 'draw:join-room', { sessionId: p4.sessionId, roomId, playerName: p4.name })
  assert(joinRes4.room, 'P4 join failed')
  p4.roomState = joinRes4.room
  console.log('✓ P4 joined')

  // 4. Test Empty / Invalid Custom Words Configuration
  p1.socket.emit('draw:update-config', {
    useCustomOnly: true,
    customWords: '   , ,   '
  })
  await new Promise(r => setTimeout(r, 150))

  // Start game with custom words only enabled (empty words should fallback to defaultWords)
  const startRes = await emitAck(p1.socket, 'draw:start-game', {})
  assert(startRes.success, `Start game should succeed with empty custom words fallback, got ${startRes.error}`)
  console.log('✓ Game started with empty custom words cleanly falling back to playable pool')

  await Promise.all([
    waitForRoomState(p1, s => s.phase === 'WORD_CHOICE'),
    waitForRoomState(p2, s => s.phase === 'WORD_CHOICE'),
    waitForRoomState(p4, s => s.phase === 'WORD_CHOICE')
  ])
  const drawerClient = [p1, p2, p4].find(p => p.sessionId === p1.roomState.currentDrawerId)
  assert(drawerClient && Array.isArray(drawerClient.roomState.wordChoices) && drawerClient.roomState.wordChoices.length > 0, 'Drawer must have wordChoices')
  console.log('✓ Word choices generated without sticking')

  // 5. Test Leaving Mid-Game & Rejection of Departed Player Rejoin
  const activeDrawerId = p1.roomState.currentDrawerId
  const guesser = [p1, p2, p4].find(p => p.sessionId !== activeDrawerId)
  assert(guesser, 'Guesser should exist')

  const leaveRes1 = await emitAck(guesser.socket, 'draw:leave-room')
  assert(leaveRes1.success, 'Leave room should succeed')

  // Repeated leave request
  const repeatLeave = await emitAck(guesser.socket, 'draw:leave-room')
  assert(repeatLeave.success, 'Repeated leave-room should succeed idempotently')
  console.log('✓ Repeated leave-room handled idempotently')

  // Departed player attempts to rejoin active game
  const rejoinDeparted = await emitAck(guesser.socket, 'draw:join-room', {
    sessionId: guesser.sessionId,
    resumeToken: guesser.resumeToken,
    roomId,
    playerName: guesser.name
  })
  assert(rejoinDeparted.error === 'GAME_ALREADY_STARTED', `Departed player rejoining active game should get GAME_ALREADY_STARTED, got ${rejoinDeparted.error}`)
  console.log('✓ Departed player cannot resurrect into active game (GAME_ALREADY_STARTED)')

  // 6. Test Play-Again Reset
  // Advance to GAME_RESULT by having the remaining guesser leave so < 2 players remain
  const otherRemaining = [p1, p2, p4].filter(p => p.sessionId !== guesser.sessionId)
  await emitAck(otherRemaining[1].socket, 'draw:leave-room')

  const gameResultState = await waitForRoomState(otherRemaining[0], s => s.phase === 'GAME_RESULT', 5000)
  assert(gameResultState.phase === 'GAME_RESULT', 'Room should transition to GAME_RESULT')
  console.log('✓ Room transitioned to GAME_RESULT')

  // Host triggers play-again
  const hostClient = otherRemaining[0].roomState.hostId === otherRemaining[0].sessionId ? otherRemaining[0] : null
  if (hostClient) {
    const playAgainRes = await emitAck(hostClient.socket, 'draw:play-again')
    assert(playAgainRes.success, 'Play again should succeed')
    const lobbyState = await waitForRoomState(hostClient, s => s.phase === 'LOBBY', 5000)
    assert(lobbyState.phase === 'LOBBY', 'Phase must be reset to LOBBY')
    assert(lobbyState.round === 1, 'Round must be reset to 1')
    assert(lobbyState.turnOrder.length === 0, 'turnOrder must be empty')
    assert(lobbyState.players.every(p => p.score === 0), 'All player scores must be reset to 0')
    console.log('✓ draw:play-again reset all game state, scores, and returned to LOBBY cleanly')
  }

  // Cleanup sockets
  p1.socket.disconnect()
  p2.socket.disconnect()
  p3.socket.disconnect()
  p4.socket.disconnect()

  console.log('\n===========================================')
  console.log('ALL SKRIBBL LIFECYCLE HARDENING TESTS PASSED!')
  console.log('===========================================\n')
  process.exit(0)
}

run().catch(err => {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
})
