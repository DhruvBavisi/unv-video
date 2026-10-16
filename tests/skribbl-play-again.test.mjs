import { io } from 'socket.io-client'
import assert from 'assert'
import { getSkribblActiveComponent, shouldRenderIndividualLobby, PlayAgainRequestController } from '../src/drawgame/skribblRouting.js'

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

  // 1. Two eligible clients are in GAME_RESULT: both view results screen initially
  assert.strictEqual(getSkribblActiveComponent('lobby', resultState, p1.sessionId), 'DRAWING_PHASE', 'P1 must initially be on results screen')
  assert.strictEqual(shouldRenderIndividualLobby(resultState, p1.sessionId), false, 'P1 must not render individual lobby yet')
  assert.strictEqual(getSkribblActiveComponent('lobby', resultState, p2.sessionId), 'DRAWING_PHASE', 'P2 must initially be on results screen')
  assert.strictEqual(shouldRenderIndividualLobby(resultState, p2.sessionId), false, 'P2 must not render individual lobby yet')
  console.log('✓ 1. Initial GAME_RESULT state verified: both eligible clients on results screen')

  // 5. Guest (P2 / Client A) opts in to Play Again first (Non-host opt in)
  console.log('P2 opting in to Play Again...')
  const p2PlayAgainAck = await emitAck(p2.socket, 'draw:play-again')
  assert(p2PlayAgainAck.success, 'P2 play-again ack must succeed')
  assert(p2PlayAgainAck.phase === 'GAME_RESULT', 'P2 ack phase must indicate GAME_RESULT transition')

  // Wait for P1 to receive state with P2 opted in
  const transitionalState = await waitForRoomState(p1, s => {
    const guest = s.players.find(p => p.id === p2.sessionId)
    return guest && guest.playAgain === true
  })

  // 2. Client A (P2) opts into Play Again and can enter the lobby immediately
  assert.strictEqual(getSkribblActiveComponent('lobby', transitionalState, p2.sessionId), 'LOBBY', 'Client A (P2, opted in) must enter the lobby immediately')
  assert.strictEqual(shouldRenderIndividualLobby(transitionalState, p2.sessionId), true, 'Client A (P2) must route to individual lobby')

  // 3. Client B (P1) remains on the results screen until opting in
  assert.strictEqual(getSkribblActiveComponent('lobby', transitionalState, p1.sessionId), 'DRAWING_PHASE', 'Client B (P1, not opted in) must remain on results screen')
  assert.strictEqual(shouldRenderIndividualLobby(transitionalState, p1.sessionId), false, 'Client B (P1) must stay on results screen')

  // 4. The server remains in GAME_RESULT while an eligible player has not opted in; scores and results remain intact
  assert.strictEqual(transitionalState.phase, 'GAME_RESULT', 'Server must remain in GAME_RESULT while P1 has not opted in')
  const transP1 = transitionalState.players.find(p => p.id === p1.sessionId)
  const transP2 = transitionalState.players.find(p => p.id === p2.sessionId)
  assert.strictEqual(transP1.score, p1Record.score, 'P1 score must not be reset during transition')
  assert.strictEqual(transP2.score, p2Record.score, 'P2 score must not be reset during transition')
  console.log('✓ 2-4. Transition views verified: Client A in LOBBY, Client B on result screen, server in GAME_RESULT, scores intact')

  // 6. Host configures room during transitional GAME_RESULT
  console.log('Host updating config during GAME_RESULT...')
  p1.socket.emit('draw:update-config', { drawTimeSec: 60 })
  await waitForRoomState(p2, s => s.configuration.drawTimeSec === 60)
  console.log('✓ Host config update succeeded during transitional GAME_RESULT')

  // 7. Duplicate opt-in from P2 must be idempotent
  const dupAck = await emitAck(p2.socket, 'draw:play-again')
  assert(dupAck.success, 'Duplicate opt-in must succeed idempotently')
  console.log('✓ Duplicate play-again handled idempotently')

  // 8. Host (P1 / Client B) opts in -> All eligible players opted in!
  console.log('Host (P1) opting in to Play Again...')
  const p1PlayAgainAck = await emitAck(p1.socket, 'draw:play-again')
  assert(p1PlayAgainAck.success, 'Host play-again ack must succeed')

  // 5. When all eligible players opt in, the room resets to LOBBY exactly once
  const finalLobby1 = await waitForRoomState(p1, s => s.phase === 'LOBBY')
  const finalLobby2 = await waitForRoomState(p2, s => s.phase === 'LOBBY')

  assert.strictEqual(finalLobby1.phase, 'LOBBY', 'P1 room must reset to LOBBY')
  assert.strictEqual(finalLobby2.phase, 'LOBBY', 'P2 room must reset to LOBBY')
  assert.strictEqual(getSkribblActiveComponent('lobby', finalLobby1, p1.sessionId), 'LOBBY', 'P1 in LOBBY view')
  assert.strictEqual(getSkribblActiveComponent('lobby', finalLobby2, p2.sessionId), 'LOBBY', 'P2 in LOBBY view')
  assert.strictEqual(finalLobby1.round, 1, 'Round must reset to 1')
  assert.strictEqual(finalLobby1.configuration.drawTimeSec, 60, 'Updated configuration must be preserved')
  assert(finalLobby1.players.every(p => p.score === 0), 'All player scores must reset to 0 in LOBBY')
  assert(finalLobby1.players.every(p => !p.playAgain), 'playAgain flags must be reset in LOBBY')
  console.log('✓ 5. Full room reset to LOBBY succeeded once all players opted in, scores zeroed, views in LOBBY')

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

  // 10. Test real PlayAgainRequestController implementation with deterministic timers
  console.log('\nTesting PlayAgainRequestController with deterministic timers and actual recovery logic...')

  let activeTimers = new Map()
  let timerIdSeq = 0
  const deterministicSetTimeout = (fn, delay) => {
    const id = ++timerIdSeq
    activeTimers.set(id, { fn, delay })
    return id
  }
  const deterministicClearTimeout = (id) => {
    activeTimers.delete(id)
  }
  const advanceTimer = (id) => {
    const timer = activeTimers.get(id)
    if (timer) {
      activeTimers.delete(id)
      timer.fn()
      return true
    }
    return false
  }

  let submittingState = false
  let errorState = null
  let emitCalls = []

  const controller = new PlayAgainRequestController({
    onSubmittingChange: (val) => { submittingState = val },
    onErrorChange: (err) => { errorState = err },
    emit: (event, cb) => {
      emitCalls.push({ event, cb })
    },
    getFriendlyError: (code) => code === 'CUSTOM_ERR' ? 'Custom error message.' : null,
    timeoutMs: 7000,
    setTimeoutFn: deterministicSetTimeout,
    clearTimeoutFn: deterministicClearTimeout
  })

  // 10.1 Duplicate submission prevention
  // Case A: Submit when offline
  const offlineRes = controller.submit({ isConnected: false, isAlreadyOptedIn: false })
  assert.strictEqual(offlineRes.ok, false)
  assert.strictEqual(offlineRes.reason, 'NOT_CONNECTED')
  assert.strictEqual(submittingState, false)
  assert.strictEqual(errorState, 'Not connected to server.')

  // Case B: Normal submit when connected
  const sub1 = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
  assert.strictEqual(sub1.ok, true)
  assert.strictEqual(submittingState, true)
  assert.strictEqual(errorState, null)
  assert.strictEqual(emitCalls.length, 1)
  assert.strictEqual(emitCalls[0].event, 'draw:play-again')
  assert.strictEqual(activeTimers.size, 1, 'Timeout timer should be scheduled')

  // Case C: Duplicate submit while isSubmitting is true
  const dupSubmit = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
  assert.strictEqual(dupSubmit.ok, false)
  assert.strictEqual(dupSubmit.reason, 'PREVENTED_DUPLICATE')
  assert.strictEqual(emitCalls.length, 1, 'Duplicate submit must not emit socket event')

  // Case D: Submit when already opted in
  controller.setSubmitting(false)
  const optedInSubmit = controller.submit({ isConnected: true, isAlreadyOptedIn: true })
  assert.strictEqual(optedInSubmit.ok, false)
  assert.strictEqual(optedInSubmit.reason, 'PREVENTED_DUPLICATE')
  assert.strictEqual(emitCalls.length, 1, 'Already opted-in submit must not emit socket event')

  // 10.2 Acknowledgement timeout and request ID invalidation
  controller.clearTimeout()
  activeTimers.clear()
  emitCalls = []
  const subTimeout = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
  assert.strictEqual(subTimeout.ok, true)
  assert.strictEqual(submittingState, true)
  assert.strictEqual(activeTimers.size, 1)
  const timeoutTimerId = timerIdSeq
  const timedOutReqId = subTimeout.reqId

  // Advance deterministic timer to fire timeout
  const timerFired = advanceTimer(timeoutTimerId)
  assert.strictEqual(timerFired, true)
  assert.strictEqual(submittingState, false, 'Timeout must clear submitting state')
  assert.strictEqual(errorState, 'Request timed out. Please try again.', 'Timeout must set timeout error message')
  assert.notStrictEqual(controller.activeReqId, timedOutReqId, 'Timed-out request ID must be invalidated')

  // 10.3 Late acknowledgement after timeout must be ignored
  // Late server response arrives after timeout occurred but before retry
  const lateAckResult = controller.handleResponse(timedOutReqId, { success: true })
  assert.strictEqual(lateAckResult, false, 'Late acknowledgement for timed-out request must return false / be ignored')
  assert.strictEqual(submittingState, false, 'Late ack must not alter submitting state')
  assert.strictEqual(errorState, 'Request timed out. Please try again.', 'Late ack must not overwrite timeout error')

  // 10.4 Disconnect while pending
  emitCalls = []
  const subDisconnect = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
  assert.strictEqual(subDisconnect.ok, true)
  assert.strictEqual(submittingState, true)
  assert.strictEqual(errorState, null)
  assert.strictEqual(activeTimers.size, 1)
  const disconnectReqId = subDisconnect.reqId

  // Disconnect occurs while request is in flight
  controller.handleDisconnect()
  assert.strictEqual(submittingState, false, 'Disconnect must clear submitting state')
  assert.strictEqual(errorState, 'Connection lost. Please try again.', 'Disconnect must set connection lost error')
  assert.strictEqual(activeTimers.size, 0, 'Disconnect must cancel pending timeout timer')
  assert.notStrictEqual(controller.activeReqId, disconnectReqId, 'Disconnect must invalidate pending request ID')

  // Late ack for disconnected request is also ignored
  const disconnectedAckResult = controller.handleResponse(disconnectReqId, { success: true })
  assert.strictEqual(disconnectedAckResult, false, 'Late acknowledgement after disconnect must be ignored')

  // 10.5 Retry after recovery
  emitCalls = []
  const subRetry = controller.submit({ isConnected: true, isAlreadyOptedIn: false })
  assert.strictEqual(subRetry.ok, true, 'Retry must succeed after recovery')
  assert.strictEqual(submittingState, true, 'Retry must set submitting to true')
  assert.strictEqual(errorState, null, 'Retry must clear prior error')
  assert.strictEqual(activeTimers.size, 1, 'Retry must schedule fresh timeout timer')
  const retryReqId = subRetry.reqId

  // 10.6 Stale acknowledgement after a newer request starts
  // Older timedOutReqId callback arrives while retry request is pending
  const staleAckResult = controller.handleResponse(timedOutReqId, { success: false, error: 'OLD' })
  assert.strictEqual(staleAckResult, false, 'Stale acknowledgement must be ignored when newer request is active')
  assert.strictEqual(submittingState, true, 'Stale ack must not clear newer submitting state')
  assert.strictEqual(errorState, null, 'Stale ack must not overwrite newer request error state')

  // When newer request's own callback arrives, it is processed correctly
  const validAckResult = controller.handleResponse(retryReqId, { success: true })
  assert.strictEqual(validAckResult, true, 'Current request acknowledgement must be accepted')
  assert.strictEqual(submittingState, false, 'Valid acknowledgement must clear submitting state')
  assert.strictEqual(activeTimers.size, 0, 'Valid acknowledgement must clear timeout timer')

  // Clean up
  controller.cleanup()
  assert.strictEqual(activeTimers.size, 0)
  console.log('✓ Production PlayAgainRequestController verified: duplicate prevention, timeout invalidation, late/stale ack protection, and recovery')

  console.log('\n======================================================')
  console.log('ALL SKRIBBL PLAY AGAIN & INDIVIDUAL LOBBY ENTRY TESTS PASSED!')
  console.log('======================================================\n')
  process.exit(0)
}

run().catch(err => {
  console.error('\nTEST FAILED:', err)
  process.exit(1)
})
