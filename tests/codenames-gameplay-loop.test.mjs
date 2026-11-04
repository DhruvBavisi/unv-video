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

const redSpy = makeClient('RED_SPY')
const redOps = makeClient('RED_OPS')
const blueSpy = makeClient('BLUE_SPY')
const blueOps = makeClient('BLUE_OPS')
const clients = [redSpy, redOps, blueSpy, blueOps]

try {
  await Promise.all(clients.map((cl) => new Promise((res, rej) => {
    cl.socket.on('connect', res)
    cl.socket.on('connect_error', rej)
  })))
  check('all 4 test clients connected', true)

  for (const cl of clients) {
    cl.socket.on('codenames:room-state', (state) => {
      cl.roomState = state
    })
    cl.socket.on('session-token', ({ resumeToken, roomId }) => {
      cl.resumeToken = resumeToken
      cl.roomId = roomId
    })
  }

  // 1. Red Spymaster creates room
  const createRes = await emitAck(redSpy.socket, 'codenames:create-room', { sessionId: redSpy.sessionId, playerName: 'RedMaster' })
  check('host creates room', createRes?.success)
  await sleep(100)
  const roomId = redSpy.roomId
  await emitAck(redSpy.socket, 'codenames:join-team-role', { team: 'red', role: 'SPYMASTER' })

  // 2. Others join and assign roles
  await emitAck(redOps.socket, 'codenames:join-room', { sessionId: redOps.sessionId, playerName: 'RedAgent', roomId })
  await emitAck(redOps.socket, 'codenames:join-team-role', { team: 'red', role: 'OPERATIVE' })

  await emitAck(blueSpy.socket, 'codenames:join-room', { sessionId: blueSpy.sessionId, playerName: 'BlueMaster', roomId })
  await emitAck(blueSpy.socket, 'codenames:join-team-role', { team: 'blue', role: 'SPYMASTER' })

  await emitAck(blueOps.socket, 'codenames:join-room', { sessionId: blueOps.sessionId, playerName: 'BlueAgent', roomId })
  await emitAck(blueOps.socket, 'codenames:join-team-role', { team: 'blue', role: 'OPERATIVE' })

  await sleep(100)
  check('all 4 roles assigned', redSpy.roomState?.isReady === true)

  // 3. Start game
  const startRes = await emitAck(redSpy.socket, 'codenames:start-game')
  check('start game succeeds', startRes?.success)
  await sleep(100)

  check('room transitions to PLAYING', redSpy.roomState?.status === 'PLAYING')
  check('room phase is BOARD_READY', redSpy.roomState?.phase === 'BOARD_READY')
  const startingTeam = redSpy.roomState?.startingTeam
  check('starting team is red or blue', startingTeam === 'red' || startingTeam === 'blue', startingTeam)

  const activeSpy = startingTeam === 'red' ? redSpy : blueSpy
  const activeOps = startingTeam === 'red' ? redOps : blueOps
  const idleSpy = startingTeam === 'red' ? blueSpy : redSpy
  const idleOps = startingTeam === 'red' ? blueOps : redOps

  // 4. Clue phase validations
  const nonTurnClue = await emitAck(idleSpy.socket, 'codenames:give-clue', { clue: 'APPLES', number: 2 })
  check('idle spymaster rejected', !nonTurnClue?.success && nonTurnClue?.error === 'NOT_YOUR_TURN', nonTurnClue?.error)

  const opsClue = await emitAck(activeOps.socket, 'codenames:give-clue', { clue: 'APPLES', number: 2 })
  check('operative rejected from giving clue', !opsClue?.success && opsClue?.error === 'NOT_SPYMASTER', opsClue?.error)

  // Board word clue rejected
  const firstWord = activeSpy.roomState?.board?.[0]?.word
  const wordMatchClue = await emitAck(activeSpy.socket, 'codenames:give-clue', { clue: firstWord, number: 1 })
  check('clue matching unrevealed board word rejected', !wordMatchClue?.success && wordMatchClue?.error === 'CLUE_MATCHES_BOARD_WORD', wordMatchClue?.error)

  // Valid clue accepted
  const validClue = await emitAck(activeSpy.socket, 'codenames:give-clue', { clue: 'DISCOVERY', number: 2 })
  check('valid clue accepted', validClue?.success)
  await sleep(100)

  check('phase is now GUESS_PHASE', activeOps.roomState?.phase === 'GUESS_PHASE')
  check('guessesLeft initialized to num + 1 (3)', activeOps.roomState?.guessesLeft === 3)
  check('currentClue broadcast to operatives', activeOps.roomState?.currentClue?.word === 'DISCOVERY')
  check('turnHistory recorded the clue', activeOps.roomState?.turnHistory?.length === 1 && activeOps.roomState?.turnHistory?.[0]?.clue?.word === 'DISCOVERY')

  // 5. Guess / Reveal card validations
  const spyReveal = await emitAck(activeSpy.socket, 'codenames:reveal-card', { cardIndex: 0 })
  check('spymaster rejected from revealing card', !spyReveal?.success && spyReveal?.error === 'NOT_OPERATIVE', spyReveal?.error)

  const idleOpsReveal = await emitAck(idleOps.socket, 'codenames:reveal-card', { cardIndex: 0 })
  check('idle team operative rejected from revealing card', !idleOpsReveal?.success && idleOpsReveal?.error === 'NOT_YOUR_TURN', idleOpsReveal?.error)

  // Active operative targets an own-team card (look up category from activeSpy private state)
  const spyBoard = activeSpy.roomState.board
  const ownCardIndex = spyBoard.findIndex(c => c.category === startingTeam && !c.revealed)
  check('own card found on board', ownCardIndex !== -1, `index=${ownCardIndex}`)

  const selectRes = await emitAck(activeOps.socket, 'codenames:select-card', { cardIndex: ownCardIndex })
  check('operative selects card to target it', selectRes?.success)
  await sleep(100)
  check('targetedCards recorded active operative on own card', activeOps.roomState?.targetedCards?.[activeOps.sessionId] === ownCardIndex)

  const ownRevealRes = await emitAck(activeOps.socket, 'codenames:reveal-card', { cardIndex: ownCardIndex })
  check('active operative reveals own-team card', ownRevealRes?.success)
  await sleep(100)

  check('card marked revealed on public board', activeOps.roomState?.board?.[ownCardIndex]?.revealed === true)
  check('card category now exposed publicly', activeOps.roomState?.board?.[ownCardIndex]?.category === startingTeam)
  check('guessesLeft decremented to 2', activeOps.roomState?.guessesLeft === 2)
  check('phase remains GUESS_PHASE', activeOps.roomState?.phase === 'GUESS_PHASE')
  check('turnHistory recorded the revealed guess', activeOps.roomState?.turnHistory?.[0]?.guesses?.length === 1 && activeOps.roomState?.turnHistory?.[0]?.guesses?.[0]?.category === startingTeam)

  // Cannot reveal already revealed card
  const reReveal = await emitAck(activeOps.socket, 'codenames:reveal-card', { cardIndex: ownCardIndex })
  check('cannot reveal already revealed card', !reReveal?.success && reReveal?.error === 'CARD_ALREADY_REVEALED', reReveal?.error)

  // 6. End turn action
  const endTurnRes = await emitAck(activeOps.socket, 'codenames:end-turn')
  check('operative ends turn', endTurnRes?.success)
  await sleep(100)

  const opponentTeam = startingTeam === 'red' ? 'blue' : 'red'
  check('current team switched to opponent', activeOps.roomState?.currentTeam === opponentTeam)
  check('phase returned to CLUE_PHASE', activeOps.roomState?.phase === 'CLUE_PHASE')
  check('currentClue cleared', activeOps.roomState?.currentClue === null)

  // 7. Neutral card turn-ending test
  // Opponent spymaster gives clue
  await emitAck(idleSpy.socket, 'codenames:give-clue', { clue: 'MISSION', number: 1 })
  await sleep(100)

  const neutralCardIndex = spyBoard.findIndex(c => c.category === 'neutral' && !c.revealed)
  check('neutral card found on board', neutralCardIndex !== -1, `index=${neutralCardIndex}`)

  const neutralRevealRes = await emitAck(idleOps.socket, 'codenames:reveal-card', { cardIndex: neutralCardIndex })
  check('opponent operative reveals neutral card', neutralRevealRes?.success)
  await sleep(100)

  check('neutral card ends turn immediately', idleOps.roomState?.currentTeam === startingTeam)
  check('phase returned to CLUE_PHASE after neutral', idleOps.roomState?.phase === 'CLUE_PHASE')

  // 8. Assassin card instant-loss test
  await emitAck(activeSpy.socket, 'codenames:give-clue', { clue: 'DANGER', number: 1 })
  await sleep(100)

  const assassinIndex = spyBoard.findIndex(c => c.category === 'assassin' && !c.revealed)
  check('assassin card found on board', assassinIndex !== -1, `index=${assassinIndex}`)

  const assassinRevealRes = await emitAck(activeOps.socket, 'codenames:reveal-card', { cardIndex: assassinIndex })
  check('revealing assassin succeeds', assassinRevealRes?.success)
  await sleep(100)

  check('game ends on assassin', activeOps.roomState?.status === 'FINISHED')
  check('phase is FINISHED', activeOps.roomState?.phase === 'FINISHED')
  check('opponent declared winner on assassin', activeOps.roomState?.winner === opponentTeam)
  check('endReason is ASSASSIN', activeOps.roomState?.endReason === 'ASSASSIN')
  check('all card categories now visible in finished public state', activeOps.roomState?.board?.every(c => c.category !== undefined))

  // 9. Play Again test: full reset to spectators in WAITING_FOR_PLAYERS
  const playAgainRes = await emitAck(redSpy.socket, 'codenames:play-again')
  check('host triggers play again', playAgainRes?.success)
  await sleep(100)

  check('room reset to WAITING_FOR_PLAYERS after play again', redSpy.roomState?.status === 'WAITING_FOR_PLAYERS')
  check('phase reset to WAITING_FOR_PLAYERS after play again', redSpy.roomState?.phase === 'WAITING_FOR_PLAYERS')
  check('all players converted to spectators on play again', redSpy.roomState?.players?.every(p => p.team === null && p.role === null))
  check('board regenerated for play again', redSpy.roomState?.board?.length === 25)
  check('turnHistory reset on play again', redSpy.roomState?.turnHistory?.length === 0)

  // 10. Role selection on main board after play again
  await emitAck(redSpy.socket, 'codenames:join-team-role', { team: 'red', role: 'SPYMASTER' })
  await emitAck(redOps.socket, 'codenames:join-team-role', { team: 'red', role: 'OPERATIVE' })
  await emitAck(blueSpy.socket, 'codenames:join-team-role', { team: 'blue', role: 'SPYMASTER' })
  await emitAck(blueOps.socket, 'codenames:join-team-role', { team: 'blue', role: 'OPERATIVE' })
  await sleep(100)

  check('room transitions to PLAYING once roles are chosen again', redSpy.roomState?.status === 'PLAYING')
  check('phase is BOARD_READY after all roles chosen', redSpy.roomState?.phase === 'BOARD_READY')
  check('unrevealed categories hidden from operatives in new round', blueOps.roomState?.board?.every(c => !c.revealed ? c.category === undefined : true))

  // 11. Infinity clue test in the new game
  const newActiveSpy = redSpy.roomState?.currentTeam === 'red' ? redSpy : blueSpy
  const infinityClueRes = await emitAck(newActiveSpy.socket, 'codenames:give-clue', { clue: 'INFINITYTEST', number: '∞' })
  check('infinity clue accepted by server', infinityClueRes?.success)
  await sleep(100)

  check('phase is now GUESS_PHASE after infinity clue', redSpy.roomState?.phase === 'GUESS_PHASE')
  check('currentClue number is infinity symbol', redSpy.roomState?.currentClue?.number === '∞')
  check('guessesLeft initialized to 25 for infinity clue', redSpy.roomState?.guessesLeft === 25)

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
  console.log('All Codenames gameplay loop tests passed!')
  process.exit(0)
}

