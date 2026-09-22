import { io } from 'socket.io-client'

const URL = 'http://localhost:3001'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
function check(name, cond, extra = '') {
  results.push({ name, pass: !!cond, extra })
  process.stdout.write(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}\n`)
}

function makeClient(name) {
  const socket = io(URL, { transports: ['websocket'], reconnection: false })
  const sessionId = `test-${name}-${Math.random().toString(36).slice(2, 10)}`
  return { socket, name, sessionId, resumeToken: null, secret: null, roomState: null, roomId: null, receivedChat: [] }
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response) => resolve(response))
  })
}

const host = makeClient('HOST')
const b = makeClient('PLAYERB')
const c = makeClient('PLAYERC')
const d = makeClient('PLAYERD')
const clients = [host, b, c, d]

try {
  await Promise.all(clients.map((cl) => new Promise((res, rej) => {
    cl.socket.on('connect', res)
    cl.socket.on('connect_error', rej)
  })))
  check('all clients connect', true)

  for (const cl of clients) {
    cl.socket.on('role-assigned', ({ role, word }) => {
      cl.secret = { role, word }
    })
    cl.socket.on('room-state', (state) => {
      cl.roomState = state
    })
    cl.socket.on('chat-message', (msg) => {
      cl.receivedChat.push(msg)
    })
  }

  // 1. Host creates room
  const createRes = await emitAck(host.socket, 'create-room', { sessionId: host.sessionId, playerName: 'Host' })
  check('host creates room', !createRes.error, `roomId=${createRes.room?.roomId}`)
  host.roomId = createRes.room.roomId
  host.resumeToken = createRes.resumeToken
  check('host receives resume token', typeof host.resumeToken === 'string' && host.resumeToken.length > 0)

  // 2. B, C, D join
  for (const cl of [b, c, d]) {
    const joinRes = await emitAck(cl.socket, 'join-room', { sessionId: cl.sessionId, roomId: host.roomId, playerName: cl.name })
    check(`${cl.name} joins room`, !joinRes.error, joinRes.error || '')
    cl.roomId = joinRes.room?.roomId
    cl.resumeToken = joinRes.resumeToken
    check(`${cl.name} receives resume token`, typeof cl.resumeToken === 'string' && cl.resumeToken.length > 0)
  }

  // 3. Host sets config to 4 players (1 UC + 1 MW + 2 CIV)
  host.socket.emit('update-config', { totalPlayers: 4, undercover: 1, mrWhite: 1 })
  await sleep(400)
  check('config broadcast to clients', clients.every((cl) => cl.roomState?.configuration?.totalPlayers === 4))
  check('mrWhite configured', host.roomState?.configuration?.mrWhite === 1)

  // 4. B, C, D toggle ready
  for (const cl of [b, c, d]) {
    cl.socket.emit('toggle-ready')
  }
  await sleep(400)

  // 5. Host starts game
  const roomPromise = waitForRoom(host)
  host.socket.emit('start-game')
  const startState = await roomPromise
  check('start-game broadcast has status ACTIVE', startState.status === 'ACTIVE')
  check('public room state has no role/word fields', startState.players.every((p) => !('role' in p) && !('word' in p)))

  // 6. Private role assignment
  await sleep(500)
  check('host received private role', !!host.secret?.role)
  check('B received private role', !!b.secret?.role)
  check('C received private role', !!c.secret?.role)
  check('D received private role', !!d.secret?.role)
  const mw = clients.find((cl) => cl.secret?.role === 'MR_WHITE')
  check('Mr. White exists in 4-player setup', !!mw)
  if (mw) check('Mr. White word is null', mw.secret?.word === null)
  check('Mr. White has no word (any client)', !clients.some((cl) => cl.secret?.role === 'MR_WHITE' && cl.secret?.word !== null))
  const nonMw = clients.filter((cl) => cl.secret?.role !== 'MR_WHITE')
  check('non-Mr.White players have words', nonMw.every((cl) => typeof cl.secret?.word === 'string' && cl.secret.word.length > 0))
  check('roles are unique to one player (UC=1, MW=1)', clients.filter((cl) => cl.secret?.role === 'UNDERCOVER').length === 1 && clients.filter((cl) => cl.secret?.role === 'MR_WHITE').length === 1)

  // 7. Host starts clue phase
  host.socket.emit('start-clue-phase')
  await sleep(500)
  check('host room-state gamePhase == CLUE', host.roomState?.gamePhase === 'CLUE')
  check('currentTurnPlayerId set', !!host.roomState?.currentTurnPlayerId)
  const turnOrderAfterFirst = [...(host.roomState?.turnOrder || [])]

  // 7b. Double start-clue-phase does not re-randomize turn order
  host.socket.emit('start-clue-phase')
  await sleep(300)
  check('double start-clue-phase ignored', host.roomState?.gamePhase === 'CLUE')
  check('turn order preserved on double start', JSON.stringify(turnOrderAfterFirst) === JSON.stringify(host.roomState?.turnOrder))

  const firstTurnId = host.roomState.currentTurnPlayerId
  const firstPlayer = clients.find((cl) => cl.sessionId === firstTurnId)
  check('first turn belongs to a room player', !!firstPlayer)
  check('turn order has all 4 players', host.roomState?.turnOrder?.length === 4)

  // 8. Non-current player submits → NOT_YOUR_TURN
  const nonTurn = clients.find((cl) => cl.sessionId !== firstTurnId)
  const notTurnRes = await emitAck(nonTurn.socket, 'submit-clue', { roomId: host.roomId, clue: 'sneaky clue' })
  check('non-turn player rejected', notTurnRes.success === false && notTurnRes.error === 'NOT_YOUR_TURN', notTurnRes.error)

  // 9. Empty clue rejected
  const emptyClueRes = await emitAck(firstPlayer.socket, 'submit-clue', { roomId: host.roomId, clue: '   ' })
  check('empty clue rejected', emptyClueRes.success === false && emptyClueRes.error === 'EMPTY_CLUE', emptyClueRes.error)

  // 10. Long clue rejected
  const longClueRes = await emitAck(firstPlayer.socket, 'submit-clue', { roomId: host.roomId, clue: 'x'.repeat(121) })
  check('clue over 120 chars rejected', longClueRes.success === false && longClueRes.error === 'CLUE_TOO_LONG', longClueRes.error)

  // 11. Valid clue submitted
  const clueText = `${firstPlayer.name}-clue-about-word`
  const clueRes = await emitAck(firstPlayer.socket, 'submit-clue', { roomId: host.roomId, clue: clueText })
  check('valid clue accepted', clueRes.success === true)

  // 12. Duplicate submission (rapid double-send, no waiting) rejected
  const duplicateSends = await Promise.all([
    emitAck(firstPlayer.socket, 'submit-clue', { roomId: host.roomId, clue: 'second-clue' }),
    emitAck(firstPlayer.socket, 'submit-clue', { roomId: host.roomId, clue: 'second-clue' }),
  ])
  check('duplicate clue rejected', duplicateSends.every((r) => r?.success === false),
    duplicateSends.map((r) => r?.error).join(','))

  // 13. Clue appears in public state for all clients
  await sleep(500)
  for (const cl of clients) {
    const found = cl.roomState?.clues?.find((k) => k.text === clueText)
    check(`${cl.name} sees the clue in history`, !!found)
  }

  // 14. Turn advanced to next player
  check('turn advanced after clue', host.roomState?.currentTurnPlayerId !== firstTurnId)
  check('first player has exactly one clue in history', host.roomState?.clues?.filter((k) => k.playerId === firstTurnId).length === 1)

  // 15. Remaining players submit as their turns arrive
  const order = []
  for (let guard = 0; guard < 40 && order.length < 3; guard++) {
    const cur = host.roomState?.currentTurnPlayerId
    if (cur && !order.includes(cur)) {
      order.push(cur)
      const player = clients.find((cl) => cl.sessionId === cur)
      if (player) {
        const res = await emitAck(player.socket, 'submit-clue', { roomId: host.roomId, clue: `clue-from-${player.name}` })
        check(`player ${player.name} submits when turn reaches them`, res.success === true, res.error)
        await sleep(250)
      }
    } else {
      await sleep(250)
    }
  }

  // 16. All clues submitted → VOTE_PREP
  let votePrepSeen = false
  for (let i = 0; i < 30; i++) {
    if (host.roomState?.gamePhase === 'VOTE_PREP') { votePrepSeen = true; break }
    await sleep(200)
  }
  check('all clues done → VOTE_PREP', votePrepSeen)
  check('public clues have correct structure', host.roomState?.clues?.length === 4 && host.roomState.clues.every((k) => k.id && k.roundNumber === 1 && k.playerName && k.text))

  // 17. Chat messages broadcast (dedicated chat-message event; room-state
  // is reserved for turn/phase/config changes)
  const chatRes = await emitAck(b.socket, 'send-chat-message', { roomId: host.roomId, text: 'Anyone noticed something strange?' })
  check('chat message accepted', chatRes.success === true)
  await sleep(400)
  for (const cl of clients) {
    const found = cl.receivedChat.find((m) => m.text === 'Anyone noticed something strange?')
    check(`${cl.name} received chat via chat-message`, !!found)
  }

  // 17b. Impersonation — claiming a live player's session WITHOUT its resume
  // token must be rejected and must not expose secrets or kick the owner.
  const attacker = io(URL, { transports: ['websocket'], reconnection: false })
  await new Promise((res, rej) => { attacker.on('connect', res); attacker.on('connect_error', rej) })
  let attackerSecret = null
  attacker.on('role-assigned', (secret) => { attackerSecret = secret })
  let attackerExpired = false
  attacker.on('session-expired', () => { attackerExpired = true })
  attacker.emit('register', { sessionId: host.sessionId })
  await sleep(400)
  check('impersonator without token rejected', attackerExpired === true)
  check('impersonator received no secrets', attackerSecret === null)
  check('victim host still connected', host.socket.connected)
  attacker.disconnect()

  // 18. Empty chat rejected
  const emptyChatRes = await emitAck(c.socket, 'send-chat-message', { roomId: host.roomId, text: '   ' })
  check('empty chat rejected', emptyChatRes.success === false && emptyChatRes.error === 'EMPTY_MESSAGE', emptyChatRes.error)

  // 19. Long chat rejected
  const longChatRes = await emitAck(c.socket, 'send-chat-message', { roomId: host.roomId, text: 'y'.repeat(201) })
  check('chat over 200 chars rejected', longChatRes.success === false && longChatRes.error === 'MESSAGE_TOO_LONG', longChatRes.error)

  // 20. Clue submission rejected when in VOTE_PREP
  const votePrepClueRes = await emitAck(b.socket, 'submit-clue', { roomId: host.roomId, clue: 'late clue' })
  check('submit-clue rejected outside CLUE phase', votePrepClueRes.success === false, votePrepClueRes.error)

  // 21. No secrets in public state
  const stateStr = JSON.stringify(host.roomState)
  check('no role/word leaks in public state',
    !stateStr.includes('MR_WHITE') && !stateStr.includes('UNDERCOVER') &&
    !stateStr.includes('Swimming Pool') && !stateStr.includes('Ocean'))
  check('public player objects contain only public fields', host.roomState.players.every((p) => !('role' in p) && !('word' in p)))

  // 22. Reconnection — B disconnects and reconnects, no duplication
  b.socket.disconnect()
  await sleep(300)
  await new Promise((resolve) => {
    const s2 = io(URL, { transports: ['websocket'], reconnection: false })
    s2.on('connect', () => {
      s2.on('session-reconnected', (state) => {
        check('reconnect recovers room state', state.roomId === host.roomId)
        check('reconnect recovers gamePhase', state.gamePhase === host.roomState?.gamePhase, `phase=${state.gamePhase}`)
        check('reconnect recovers clues', state.clues.length >= 1)
        check('reconnect does not duplicate clues', state.clues.length === host.roomState.clues.length, `clueCount=${state.clues.length}`)
        check('reconnect restores chat', state.chat.length >= 1)
        s2.disconnect()
        resolve()
      })
      s2.emit('register', { sessionId: b.sessionId, resumeToken: b.resumeToken })
      setTimeout(() => { s2.disconnect(); resolve() }, 3000)
    })
  })

  const passed = results.filter((r) => r.pass).length
  process.stdout.write(`\n${passed}/${results.length} checks passed\n`)
  process.exit(passed === results.length ? 0 : 1)
} catch (err) {
  process.stdout.write('\nTEST ERROR: ' + err.message + '\n' + (err.stack || ''))
  process.exit(1)
}

function waitForRoom(cl) {
  return new Promise((resolve) => {
    const handler = (state) => {
      if (state.status === 'ACTIVE') {
        cl.socket.off('room-state', handler)
        resolve(state)
      }
    }
    cl.socket.on('room-state', handler)
  })
}