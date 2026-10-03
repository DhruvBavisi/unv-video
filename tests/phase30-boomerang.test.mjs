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
  return { socket, name, sessionId, resumeToken: null, secret: null, roomState: null, roomId: null }
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    socket.emit(event, payload, (response) => resolve(response))
  })
}

const clients = [
  makeClient('HOST'),
  makeClient('P2'),
  makeClient('P3'),
  makeClient('P4'),
  makeClient('P5')
]
const host = clients[0]

try {
  await Promise.all(clients.map((cl) => new Promise((res, rej) => {
    cl.socket.on('connect', res)
    cl.socket.on('connect_error', rej)
  })))
  check('all clients connect', true)

  for (const cl of clients) {
    cl.socket.on('role-assigned', (payload) => {
      cl.secret = payload
    })
    cl.socket.on('room-state', (state) => {
      cl.roomState = state
    })
  }

  // 1. Create Room & Join
  const createRes = await emitAck(host.socket, 'create-room', { sessionId: host.sessionId, playerName: host.name })
  host.roomId = createRes.room.roomId
  for (let i = 1; i < clients.length; i++) {
    const cl = clients[i]
    await emitAck(cl.socket, 'join-room', { roomId: host.roomId, sessionId: cl.sessionId, playerName: cl.name })
  }
  let retries = 10;
  while (host.roomState?.players?.length !== 5 && retries > 0) {
    await sleep(100);
    retries--;
  }
  check('5 players joined', host.roomState?.players?.length === 5)

  // 2. Configure Special Roles
  host.socket.emit('update-config', {
    totalPlayers: 5,
    undercover: 1,
    mrWhite: 1,
    specialRoles: { boomerang: true }
  })
  await sleep(100)
  check('Config updated', host.roomState.configuration.specialRoles.boomerang === true)

  for (let i = 1; i < clients.length; i++) {
    clients[i].socket.emit('toggle-ready')
  }
  await sleep(100)

  // 3. Start Game
  host.socket.emit('start-game')
  await sleep(200)
  check('Game active', host.roomState.status === 'ACTIVE')

  const boomerangClient = clients.find(c => c.secret?.specialRole === 'boomerang')
  const otherClients = clients.filter(c => c.secret?.specialRole !== 'boomerang')
  
  check('Boomerang assigned exactly 1', !!boomerangClient)

  const publicBoomerang = host.roomState.players.find(p => p.id === boomerangClient.sessionId)
  check('Boomerang used hidden in public state', publicBoomerang.specialRoleData?.used === undefined)

  // Start Clue Phase to unlock voting
  host.socket.emit('start-clue-phase')
  await sleep(100)
  
  // Submit clues to reach vote phase
  for (const playerId of host.roomState.turnOrder) {
    const cl = clients.find(c => c.sessionId === playerId)
    if (cl) {
      cl.socket.emit('submit-clue', { clue: 'test' })
      await sleep(50)
    }
  }
  await sleep(200)

  // 4. Vote for Boomerang
  const A = boomerangClient
  const B = otherClients[0]
  const C = otherClients[1]
  const D = otherClients[2]
  const E = otherClients[3]

  // A -> B
  // B -> A
  // C -> A
  // D -> A
  // E -> D

  A.socket.emit('select-vote', { targetId: B.sessionId })
  B.socket.emit('select-vote', { targetId: A.sessionId })
  C.socket.emit('select-vote', { targetId: A.sessionId })
  D.socket.emit('select-vote', { targetId: A.sessionId })
  E.socket.emit('select-vote', { targetId: D.sessionId })
  
  await sleep(300)
  for (const cl of clients) {
    cl.socket.emit('lock-vote')
  }
  await sleep(1000)
  
  const bPlayer = host.roomState.players.find(p => p.id === B.sessionId)
  const cPlayer = host.roomState.players.find(p => p.id === C.sessionId)
  const dPlayer = host.roomState.players.find(p => p.id === D.sessionId)

  check('Boomerang NOT eliminated', !host.roomState.players.find(p => p.id === A.sessionId).eliminated)
  
  // A's original vote for B becomes B's vote. But Boomerang redirects votes against A back to voters: B, C, D
  // Votes before redirection:
  // A -> B (1)
  // E -> D (1)
  // B, C, D -> A (3)
  
  // Redirection: B -> B, C -> C, D -> D.
  // Votes after redirection:
  // A -> B (1)
  // E -> D (1)
  // B -> B (1)
  // C -> C (1)
  // D -> D (1)
  
  // Tally after redirection:
  // B: 2 (from A and B)
  // D: 2 (from E and D)
  // C: 1
  
  // So B and D tie!
  check('Votes redirected, resulting in tie between B and D', host.roomState.voteResult?.tie === true)
  check('Tied players are B and D', host.roomState.voteResult?.tiedPlayers?.includes(B.sessionId) && host.roomState.voteResult?.tiedPlayers?.includes(D.sessionId))
  
  // Since it was a tie, we remain in VOTE phase (well, actually gamePhase is still VOTE or ELIMINATION? lock-vote sets it to VOTE on tie)
  check('Still in VOTE phase', host.roomState.gamePhase === 'VOTE')

  // 5. Play Again reset
  // Force a game end if necessary or just emit play-again
  // wait, play-again only works if RESULT. Let's just create a new room or something.
  host.socket.emit('host-return-to-lobby')
  await sleep(500)
  
  check('Lobby phase', host.roomState.status === 'LOBBY')
  const resetP1 = host.roomState.players.find(p => p.id === A.sessionId)
  check('Special role reset', !resetP1.specialRole)

  const fails = results.filter(r => !r.pass)
  if (fails.length > 0) {
    console.error('FAILED TESTS:')
    fails.forEach(f => console.error(f))
    process.exit(1)
  } else {
    console.log('ALL PASS')
    process.exit(0)
  }

} catch (err) {
  console.error(err)
  process.exit(1)
} finally {
  clients.forEach(c => c.socket.disconnect())
}
