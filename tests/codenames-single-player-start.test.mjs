import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3001'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra })
  process.stdout.write(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}\n`)
}

function makeClient(name) {
  const socket = io(URL, { transports: ['websocket'], reconnection: false })
  const sessionId = `test-${name}-${Math.random().toString(36).slice(2, 10)}`
  return { socket, name, sessionId, resumeToken: null, roomState: null, roomId: null }
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (payload === undefined) {
      socket.emit(event, (response) => resolve(response))
    } else {
      socket.emit(event, payload, (response) => resolve(response))
    }
  })
}

const host = makeClient('HOST')
const p2 = makeClient('PLAYER2')
const p3 = makeClient('PLAYER3')
const p4 = makeClient('PLAYER4')
const p5 = makeClient('PLAYER5')
const clients = [host, p2, p3, p4, p5]

try {
  await Promise.all(clients.map((cl) => new Promise((res, rej) => {
    cl.socket.on('connect', res)
    cl.socket.on('connect_error', rej)
  })))
  check('all test clients connected to server', true)

  for (const cl of clients) {
    cl.socket.on('codenames:room-state', (state) => {
      cl.roomState = state
    })
    cl.socket.on('session-token', ({ resumeToken, roomId }) => {
      cl.resumeToken = resumeToken
      cl.roomId = roomId
    })
  }

  // 1. Host creates Codenames room
  const createRes = await emitAck(host.socket, 'codenames:create-room', { sessionId: host.sessionId, playerName: 'HostPlayer' })
  check('host creates codenames room', createRes?.success, JSON.stringify(createRes))
  await sleep(100)
  const initialRoomId = host.roomId
  check('host received roomId', typeof initialRoomId === 'string' && initialRoomId.length > 0, initialRoomId)
  check('room starts in LOBBY status', host.roomState?.status === 'LOBBY')
  check('room starts in LOBBY phase', host.roomState?.phase === 'LOBBY')
  check('room has 1 player', host.roomState?.players?.length === 1)

  // 2. Host starts the room alone (single-player start)
  const startRes = await emitAck(host.socket, 'codenames:start-game')
  check('host can start game alone with 1 player', startRes?.success, JSON.stringify(startRes))
  await sleep(100)
  check('room status is WAITING_FOR_PLAYERS', host.roomState?.status === 'WAITING_FOR_PLAYERS')
  check('room phase is WAITING_FOR_PLAYERS', host.roomState?.phase === 'WAITING_FOR_PLAYERS')
  check('board is initialized with 25 cards', host.roomState?.board?.length === 25)
  check('readiness is false while waiting', host.roomState?.isReady === false)
  const initialBoardWord0 = host.roomState?.board?.[0]?.word

  // 3. Repeated start attempt is rejected and does not regenerate board
  const secondStartRes = await emitAck(host.socket, 'codenames:start-game')
  check('repeated start attempt rejected', !secondStartRes?.success, secondStartRes?.error)
  check('board is preserved without regenerating', host.roomState?.board?.[0]?.word === initialBoardWord0)

  // 4. Gameplay action (clue) is blocked during waiting phase
  const clueRes = await emitAck(host.socket, 'codenames:give-clue', { clue: 'APPLE', number: 2 })
  check('give-clue blocked during waiting phase', !clueRes?.success, clueRes?.error)

  // 5. Player 2 joins late during WAITING_FOR_PLAYERS
  const joinP2 = await emitAck(p2.socket, 'codenames:join-room', {
    sessionId: p2.sessionId,
    playerName: 'PlayerTwo',
    roomId: initialRoomId
  })
  check('player 2 late joins during WAITING_FOR_PLAYERS', joinP2?.success, JSON.stringify(joinP2))
  await sleep(100)
  check('player 2 added with team null', p2.roomState?.players?.find(p => p.id === p2.sessionId)?.team === null)
  check('player 2 added with role null', p2.roomState?.players?.find(p => p.id === p2.sessionId)?.role === null)
  check('board preserved for player 2', p2.roomState?.board?.[0]?.word === initialBoardWord0)
  check('public board does not expose hidden categories', p2.roomState?.board?.every(c => c.category === undefined))

  // 6. Player 2 selects Red Spymaster
  const p2RoleRes = await emitAck(p2.socket, 'codenames:join-team-role', { team: 'red', role: 'SPYMASTER' })
  check('player 2 selects Red Spymaster', p2RoleRes?.success, JSON.stringify(p2RoleRes))
  await sleep(100)
  check('player 2 is Red Spymaster', p2.roomState?.players?.find(p => p.id === p2.sessionId)?.role === 'SPYMASTER')
  check('spymaster sees card categories', p2.roomState?.board?.some(c => c.category !== undefined))

  // 7. Player 3 joins late and attempts to take already-occupied Red Spymaster slot
  const joinP3 = await emitAck(p3.socket, 'codenames:join-room', {
    sessionId: p3.sessionId,
    playerName: 'PlayerThree',
    roomId: initialRoomId
  })
  check('player 3 late joins during WAITING_FOR_PLAYERS', joinP3?.success)
  await sleep(100)
  const p3RedSpyRes = await emitAck(p3.socket, 'codenames:join-team-role', { team: 'red', role: 'SPYMASTER' })
  check('cannot overwrite occupied Red Spymaster slot', !p3RedSpyRes?.success && p3RedSpyRes?.error === 'SPYMASTER_SLOT_TAKEN', p3RedSpyRes?.error)

  // Player 3 selects Blue Spymaster instead
  const p3BlueSpyRes = await emitAck(p3.socket, 'codenames:join-team-role', { team: 'blue', role: 'SPYMASTER' })
  check('player 3 selects Blue Spymaster', p3BlueSpyRes?.success)
  await sleep(100)

  // 8. Player 4 joins late and selects Red Operative
  const joinP4 = await emitAck(p4.socket, 'codenames:join-room', {
    sessionId: p4.sessionId,
    playerName: 'PlayerFour',
    roomId: initialRoomId
  })
  check('player 4 late joins during WAITING_FOR_PLAYERS', joinP4?.success)
  await sleep(100)
  const p4RoleRes = await emitAck(p4.socket, 'codenames:join-team-role', { team: 'red', role: 'OPERATIVE' })
  check('player 4 selects Red Operative', p4RoleRes?.success)
  await sleep(100)
  check('room still in WAITING_FOR_PLAYERS before Blue Operative', host.roomState?.status === 'WAITING_FOR_PLAYERS')

  // 9. Host selects Blue Operative -> minimum playable configuration satisfied!
  const hostRoleRes = await emitAck(host.socket, 'codenames:join-team-role', { team: 'blue', role: 'OPERATIVE' })
  check('host selects Blue Operative', hostRoleRes?.success)
  await sleep(100)

  // Authoritative transition to PLAYING / BOARD_READY!
  check('room transitions to PLAYING status', host.roomState?.status === 'PLAYING')
  check('room transitions to BOARD_READY phase', host.roomState?.phase === 'BOARD_READY')
  check('room isReady is true', host.roomState?.isReady === true)
  check('board is preserved after transition to PLAYING', host.roomState?.board?.[0]?.word === initialBoardWord0)

  // 10. Late joining is blocked once room enters PLAYING
  const joinP5 = await emitAck(p5.socket, 'codenames:join-room', {
    sessionId: p5.sessionId,
    playerName: 'PlayerFive',
    roomId: initialRoomId
  })
  check('new player rejected once room is PLAYING', !joinP5?.success && joinP5?.error === 'GAME_IN_PROGRESS', joinP5?.error)

  // 11. Role changes blocked once room is PLAYING
  const roleChangeInPlay = await emitAck(host.socket, 'codenames:join-team-role', { team: 'red', role: 'OPERATIVE' })
  check('role changes blocked once room is PLAYING', !roleChangeInPlay?.success && roleChangeInPlay?.error === 'GAME_IN_PROGRESS', roleChangeInPlay?.error)

  // 12. Returning player reconnects with resumeToken
  const p4ResumeToken = p4.resumeToken
  const p4ReconnectSocket = io(URL, { transports: ['websocket'], reconnection: false })
  await new Promise((res, rej) => {
    p4ReconnectSocket.on('connect', res)
    p4ReconnectSocket.on('connect_error', rej)
  })
  const reconnectRes = await emitAck(p4ReconnectSocket, 'codenames:join-room', {
    sessionId: p4.sessionId,
    playerName: 'PlayerFour',
    roomId: initialRoomId,
    resumeToken: p4ResumeToken
  })
  check('returning player reconnects successfully', reconnectRes?.success)
  await sleep(100)
  check('player count unchanged after reconnect', host.roomState?.players?.length === 4)
  p4ReconnectSocket.disconnect()

} catch (err) {
  console.error('Test execution error:', err)
  check('uncaught error', false, err.message)
} finally {
  for (const cl of clients) {
    try { cl.socket.disconnect() } catch {}
  }
}

const failed = results.filter(r => !r.pass)
console.log(`\nResults: ${results.length - failed.length}/${results.length} passed`)
if (failed.length > 0) {
  console.error(`Failed ${failed.length} test(s)`)
  process.exit(1)
} else {
  console.log('All Codenames single-player start and late-join tests passed!')
  process.exit(0)
}
