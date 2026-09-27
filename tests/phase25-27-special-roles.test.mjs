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
    specialRoles: { joyFool: true, duelists: true }
  })
  await sleep(100)
  check('Config updated', host.roomState.configuration.specialRoles.duelists === true)

  for (let i = 1; i < clients.length; i++) {
    clients[i].socket.emit('toggle-ready')
  }
  await sleep(100)

  // 3. Start Game
  host.socket.emit('start-game')
  await sleep(200)
  check('Game active', host.roomState.status === 'ACTIVE')

  const joyFoolClient = clients.find(c => c.secret?.specialRole === 'joyFool')
  const duelistClients = clients.filter(c => c.secret?.specialRole === 'duelists')
  
  check('Joy Fool assigned exactly 1', !!joyFoolClient)
  check('Duelists assigned exactly 2', duelistClients.length === 2)
  check('Assignments do not overlap', !duelistClients.includes(joyFoolClient))

  const publicPlayer1 = host.roomState.players.find(p => p.id === duelistClients[0].sessionId)
  check('Partner ID hidden in public state', !publicPlayer1.specialRoleData?.partnerId)
  check('Duel ID hidden in public state', !publicPlayer1.specialRoleData?.duelId)
  check('Points hidden in active state', publicPlayer1.points === 0 || publicPlayer1.points === undefined)

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
  console.log('After clues phase is:', host.roomState.gamePhase)

  // 4. Eliminate first Duelist
  const victim = duelistClients[0]
  const otherTarget = clients.find(c => c.sessionId !== victim.sessionId)
  for (const cl of clients) {
    if (cl.sessionId === victim.sessionId) {
      cl.socket.emit('select-vote', { targetId: otherTarget.sessionId })
    } else {
      cl.socket.emit('select-vote', { targetId: victim.sessionId })
    }
  }
  await sleep(300)
  for (const cl of clients) {
    cl.socket.emit('lock-vote')
  }
  await sleep(1000)
  
  console.log('Votes:', host.roomState.votes)
  console.log('Locked votes:', host.roomState.lockedVotes)
  
  check('Elimination occurred', ['ELIMINATION', 'MR_WHITE_GUESS', 'RESULT'].includes(host.roomState.gamePhase))
  check('Outcome published', host.roomState.eliminationResult?.specialRoleOutcomes?.length === 1)
  const outcome = host.roomState.eliminationResult?.specialRoleOutcomes?.[0]
  check('Outcome has correct details', outcome?.role === 'duelists' && outcome?.eliminatedName === victim.name)

  // To reach RESULT, we need to eliminate UC and MW if they aren't already eliminated.
  while (host.roomState.gamePhase !== 'RESULT' && host.roomState.round < 5) {
    host.socket.emit('next-phase')
    await sleep(200)
    if (host.roomState.gamePhase === 'MR_WHITE_GUESS') {
       const mw = clients.find(c => c.secret?.role === 'MR_WHITE')
       mw?.socket.emit('submit-mr-white-guess', { text: 'guess' })
       await sleep(300)
    }
    if (host.roomState.gamePhase === 'RESULT') break;
    
    if (host.roomState.gamePhase === 'CLUE') {
      for (const playerId of host.roomState.turnOrder) {
        const cl = clients.find(c => c.sessionId === playerId)
        cl?.socket.emit('submit-clue', { clue: 'test2' })
        await sleep(50)
      }
      await sleep(200)
    }
    
    if (host.roomState.gamePhase === 'VOTE') {
      const activeUC = host.roomState.players.find(p => p.role === 'UNDERCOVER' && !p.eliminated)
      const activeMW = host.roomState.players.find(p => p.role === 'MR_WHITE' && !p.eliminated)
      const toEliminate = activeUC || activeMW || host.roomState.players.find(p => !p.eliminated)
      
      for (const cl of clients) {
        if (!cl.roomState.players.find(p => p.id === cl.sessionId)?.eliminated) {
           const other = host.roomState.players.find(p => !p.eliminated && p.id !== cl.sessionId)
           if (cl.sessionId === toEliminate.id) {
             cl.socket.emit('select-vote', { targetId: other.id })
           } else {
             cl.socket.emit('select-vote', { targetId: toEliminate.id })
           }
        }
      }
      await sleep(300)
      for (const cl of clients) {
        if (!cl.roomState.players.find(p => p.id === cl.sessionId)?.eliminated) {
           cl.socket.emit('lock-vote')
        }
      }
      await sleep(300)
    }
  }
  
  const resultP1 = host.roomState.players.find(p => p.id === duelistClients[0].sessionId)
  const resultP2 = host.roomState.players.find(p => p.id === duelistClients[1].sessionId)
  check('Eliminated duelist points = -2', resultP1.points === -2)
  check('Surviving duelist points = 2', resultP2.points === 2)

  // 6. Play Again reset
  for (const cl of clients) cl.socket.emit('play-again')
  await sleep(500)
  
  check('Lobby phase', host.roomState.status === 'LOBBY')
  const resetP1 = host.roomState.players.find(p => p.id === duelistClients[0].sessionId)
  check('Points reset', resetP1.points === 0)
  check('Special role reset', !resetP1.specialRole)
  check('Outcomes reset', !host.roomState.eliminationResult)

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
