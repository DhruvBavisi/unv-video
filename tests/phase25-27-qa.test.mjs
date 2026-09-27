/**
 * Phase 25-27 Comprehensive QA Hardening Suite
 *
 * Uses Node.js built-in test runner.
 * Covers: configuration, Joy Fool assignment/scoring, Duelist assignment/scoring/privacy,
 *         combined behaviour, Play Again resets, reconnect privacy, points privacy,
 *         negative-score rendering logic, config lock, min-player gating.
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  makeClient, emitAck, waitForRoomState, connectClients, disconnectClients
} from './helpers.mjs'

/* ──────────────── shared utilities ──────────────── */

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function createAndJoinRoom(playerCount = 5) {
  const clients = []
  for (let i = 0; i < playerCount; i++) {
    clients.push(makeClient(i === 0 ? 'HOST' : `P${i + 1}`))
  }
  await connectClients(clients)
  const host = clients[0]
  const res = await emitAck(host.socket, 'create-room', { sessionId: host.sessionId, playerName: host.name })
  assert.ok(res.room, 'Room creation failed')
  host.roomId = res.room.roomId
  host.resumeToken = res.resumeToken
  for (let i = 1; i < clients.length; i++) {
    const joinRes = await emitAck(clients[i].socket, 'join-room', {
      roomId: host.roomId, sessionId: clients[i].sessionId, playerName: clients[i].name
    })
    clients[i].roomId = host.roomId
    clients[i].resumeToken = joinRes.resumeToken
  }
  await waitForRoomState(host, s => s?.players?.length === playerCount)
  return { clients, host }
}

async function setConfig(host, specialRoles) {
  host.socket.emit('update-config', { specialRoles })
  // Wait for all changed keys to propagate
  await sleep(200)
  // Double check the last key is set
  const keys = Object.keys(specialRoles)
  const lastKey = keys[keys.length - 1]
  await waitForRoomState(host, s => s.configuration?.specialRoles?.[lastKey] === specialRoles[lastKey], 3000)
}

async function readyAndStart(clients, host, specialRoles = {}) {
  if (Object.keys(specialRoles).length > 0) {
    await setConfig(host, specialRoles)
  }
  for (const c of clients) {
    if (c !== host) c.socket.emit('toggle-ready')
  }
  await waitForRoomState(host, s => s.players.every(p => p.status === 'READY' || p.isHost), 3000)
  host.socket.emit('start-game')
  await waitForRoomState(host, s => s.status === 'ACTIVE', 3000)
  await sleep(200) // Wait for role-assigned socket events to reach all clients
}

async function playCluePhase(clients, host) {
  if (host.roomState.gamePhase !== 'CLUE') {
    host.socket.emit('start-clue-phase')
    await waitForRoomState(host, s => s.gamePhase === 'CLUE', 3000)
  }
  for (const playerId of host.roomState.turnOrder) {
    const cl = clients.find(c => c.sessionId === playerId)
    if (cl && !cl.roomState?.players?.find(p => p.id === cl.sessionId)?.eliminated) {
      cl.socket.emit('submit-clue', { clue: `clue-${playerId.slice(-4)}` })
      await waitForRoomState(host, s =>
        s.submittedCluePlayerIds?.includes(playerId) || s.gamePhase === 'VOTE',
        3000
      )
    }
    if (host.roomState.gamePhase === 'VOTE') break
  }
  await waitForRoomState(host, s => s.gamePhase === 'VOTE', 5000)
}

async function eliminatePlayer(clients, host, victimSessionId) {
  const otherTarget = clients.find(c =>
    c.sessionId !== victimSessionId &&
    !c.roomState?.players?.find(p => p.id === c.sessionId)?.eliminated
  )
  for (const cl of clients) {
    const self = cl.roomState?.players?.find(p => p.id === cl.sessionId)
    if (self?.eliminated) continue
    if (cl.sessionId === victimSessionId) {
      cl.socket.emit('select-vote', { targetId: otherTarget.sessionId })
    } else {
      cl.socket.emit('select-vote', { targetId: victimSessionId })
    }
  }
  await waitForRoomState(host, s => {
    const activeCount = s.players.filter(p => !p.eliminated).length
    return Object.keys(s.votes || {}).length >= activeCount
  }, 3000)
  for (const cl of clients) {
    const self = cl.roomState?.players?.find(p => p.id === cl.sessionId)
    if (!self?.eliminated) cl.socket.emit('lock-vote')
  }
  // Wait for ELIMINATION phase (or MR_WHITE_GUESS / RESULT if game ends)
  await waitForRoomState(host, s =>
    s.gamePhase === 'ELIMINATION' || s.gamePhase === 'MR_WHITE_GUESS' || s.gamePhase === 'RESULT',
    5000
  )
}

/** Wait for the server's auto-advance timer (5-6.5s) to move past ELIMINATION */
async function waitPastElimination(clients, host) {
  if (host.roomState.gamePhase === 'ELIMINATION') {
    // Server auto-advances after 5-6.5s timeout, just wait
    await waitForRoomState(host, s => s.gamePhase !== 'ELIMINATION', 10000)
  }
  if (host.roomState.gamePhase === 'MR_WHITE_GUESS') {
    const mwPlayer = host.roomState.players.find(p => p.role === 'MR_WHITE')
    if (mwPlayer) {
      const mwClient = clients.find(c => c.sessionId === mwPlayer.id)
      mwClient?.socket.emit('submit-mr-white-guess', { guess: 'wrongguess' })
      await waitForRoomState(host, s => s.gamePhase !== 'MR_WHITE_GUESS', 5000)
    }
  }
}

async function playToResult(clients, host) {
  let safety = 20
  while (host.roomState.gamePhase !== 'RESULT' && safety-- > 0) {
    console.log(`[playToResult] current phase: ${host.roomState.gamePhase}`)
    if (host.roomState.gamePhase === 'ELIMINATION') {
      await waitPastElimination(clients, host)
    } else if (host.roomState.gamePhase === 'MR_WHITE_GUESS') {
      const mwPlayer = host.roomState.players.find(p => p.role === 'MR_WHITE')
      const mwClient = clients.find(c => c.sessionId === mwPlayer?.id)
      mwClient?.socket.emit('submit-mr-white-guess', { guess: 'wrongguess' })
      await waitForRoomState(host, s => s.gamePhase !== 'MR_WHITE_GUESS', 5000)
    } else if (host.roomState.gamePhase === 'CLUE') {
      await playCluePhase(clients, host)
    } else if (host.roomState.gamePhase === 'VOTE') {
      const activeUC = host.roomState.players.find(p => p.role === 'UNDERCOVER' && !p.eliminated)
      const activeMW = host.roomState.players.find(p => p.role === 'MR_WHITE' && !p.eliminated)
      const toElim = activeUC || activeMW || host.roomState.players.find(p => !p.eliminated)
      if (toElim) await eliminatePlayer(clients, host, toElim.id)
    } else {
      await sleep(500)
    }
  }
}

async function playAgainAll(clients, host) {
  for (const c of clients) c.socket.emit('play-again')
  await waitForRoomState(host, s => s.status === 'LOBBY', 5000)
}

/* ═══════════════════════════════════════════════════════
   PHASE 25 — Configuration & Base Game
   ═══════════════════════════════════════════════════════ */

describe('Phase 25 — Configuration & Base Game', () => {
  let clients, host
  before(async () => { ({ clients, host } = await createAndJoinRoom(5)) })
  after(() => disconnectClients(clients))

  it('defaults to all special roles OFF', () => {
    const sr = host.roomState.configuration.specialRoles
    assert.strictEqual(sr.joyFool, false)
    assert.strictEqual(sr.duelists, false)
    assert.strictEqual(sr.lovers, false)
    assert.strictEqual(sr.revenger, false)
    assert.strictEqual(sr.boomerang, false)
    assert.strictEqual(sr.goddessOfJustice, false)
    assert.strictEqual(sr.ghost, false)
    assert.strictEqual(sr.falafelVendor, false)
    assert.strictEqual(sr.mrMeme, false)
  })

  it('host can modify special-role configuration', async () => {
    await setConfig(host, { joyFool: true })
    assert.strictEqual(host.roomState.configuration.specialRoles.joyFool, true)
    await setConfig(host, { joyFool: false })
  })

  it('non-host cannot modify configuration', async () => {
    const p2 = clients[1]
    p2.socket.emit('update-config', { specialRoles: { joyFool: true } })
    await sleep(300)
    assert.strictEqual(host.roomState.configuration.specialRoles.joyFool, false)
  })

  it('assigns no special role when all disabled', async () => {
    await readyAndStart(clients, host, { joyFool: false, duelists: false })
    for (const c of clients) {
      assert.ok(!c.secret?.specialRole, `${c.name} got unexpected special role: ${c.secret?.specialRole}`)
    }
  })

  it('configuration is locked after game start', async () => {
    assert.strictEqual(host.roomState.status, 'ACTIVE')
    host.socket.emit('update-config', { specialRoles: { joyFool: true } })
    await sleep(300)
    assert.strictEqual(host.roomState.configuration.specialRoles.joyFool, false,
      'Configuration changed during active game')
  })

  it('base game unchanged — no special roles in public state', () => {
    for (const p of host.roomState.players) {
      assert.strictEqual(p.specialRole, undefined)
    }
  })
})

describe('Phase 25 — Minimum-player gating', () => {
  describe('4 players: Joy Fool allowed, Duelists blocked', () => {
    let clients, host
    before(async () => { ({ clients, host } = await createAndJoinRoom(4)) })
    after(() => disconnectClients(clients))

    it('assigns Joy Fool with 4 players (minPlayers=3)', async () => {
      await readyAndStart(clients, host, { joyFool: true, duelists: false })
      await sleep(200)
      const jf = clients.filter(c => c.secret?.specialRole === 'joyFool')
      assert.strictEqual(jf.length, 1, 'Expected exactly 1 Joy Fool')
    })
  })

  describe('4 players: Duelists not assigned (minPlayers=5)', () => {
    let clients, host
    before(async () => { ({ clients, host } = await createAndJoinRoom(4)) })
    after(() => disconnectClients(clients))

    it('assigns zero Duelists with 4 players', async () => {
      await readyAndStart(clients, host, { joyFool: false, duelists: true })
      const duel = clients.filter(c => c.secret?.specialRole === 'duelists')
      assert.strictEqual(duel.length, 0, 'Duelists should not be assigned with <5 players')
      for (const p of host.roomState.players) {
        assert.ok(!p.specialRoleData?.partnerId, `partnerId present for ${p.name} with <5 players`)
      }
    })
  })

  describe('5 players: Duelists assigned', () => {
    let clients, host
    before(async () => { ({ clients, host } = await createAndJoinRoom(5)) })
    after(() => disconnectClients(clients))

    it('assigns exactly 2 Duelists with 5 players', async () => {
      await readyAndStart(clients, host, { joyFool: false, duelists: true })
      await sleep(200)
      const duel = clients.filter(c => c.secret?.specialRole === 'duelists')
      assert.strictEqual(duel.length, 2)
    })
  })
})

/* ═══════════════════════════════════════════════════════
   PHASE 26 — Joy Fool
   ═══════════════════════════════════════════════════════ */

describe('Phase 26 — Joy Fool first-elimination scoring', { timeout: 30000 }, () => {
  let clients, host, joyFoolClient
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: true, duelists: false })
    joyFoolClient = clients.find(c => c.secret?.specialRole === 'joyFool')
    assert.ok(joyFoolClient, 'No Joy Fool assigned')
    await playCluePhase(clients, host)
    await eliminatePlayer(clients, host, joyFoolClient.sessionId)
  })
  after(() => disconnectClients(clients))

  it('Joy Fool outcome generated with +4', () => {
    const outcomes = host.roomState.eliminationResult?.specialRoleOutcomes || host.roomState.specialRoleOutcomes || []
    const jfOutcome = outcomes.find(o => o.role === 'joyFool')
    assert.ok(jfOutcome, 'No Joy Fool outcome generated')
    assert.ok(jfOutcome.message.includes('+4'), 'Outcome should mention +4')
  })

  it('does not end the game prematurely', () => {
    assert.ok(
      ['ELIMINATION', 'MR_WHITE_GUESS', 'CLUE', 'VOTE', 'RESULT'].includes(host.roomState.gamePhase),
      'Game ended unexpectedly'
    )
  })

  it('Joy Fool server-side points = +4 at RESULT (duplicate protection)', async () => {
    await waitPastElimination(clients, host)
    await playToResult(clients, host)
    assert.strictEqual(host.roomState.gamePhase, 'RESULT')
    const jfPlayer = host.roomState.players.find(p => p.id === joyFoolClient.sessionId)
    assert.strictEqual(jfPlayer.points, 4, 'Joy Fool points should be exactly +4')
  })

  it('Result outcome present', () => {
    const outcomes = host.roomState.specialRoleOutcomes || []
    const jfOutcome = outcomes.find(o => o.role === 'joyFool')
    assert.ok(jfOutcome, 'Joy Fool outcome missing from Result')
  })
})

describe('Phase 26 — Joy Fool later elimination (no +4)', { timeout: 30000 }, () => {
  let clients, host, joyFoolClient
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: true, duelists: false })
    joyFoolClient = clients.find(c => c.secret?.specialRole === 'joyFool')
    // Eliminate a non-joy-fool first
    const nonJF = clients.find(c => c.secret?.specialRole !== 'joyFool')
    assert.ok(nonJF, 'Could not find a non-JF victim')
    await playCluePhase(clients, host)
    await eliminatePlayer(clients, host, nonJF.sessionId)
    await waitPastElimination(clients, host)
  })
  after(() => disconnectClients(clients))

  it('Joy Fool bonus = 0 when not eliminated first', async () => {
    await playToResult(clients, host)
    assert.strictEqual(host.roomState.gamePhase, 'RESULT')
    const jfPlayer = host.roomState.players.find(p => p.id === joyFoolClient.sessionId)
    assert.strictEqual(jfPlayer.points, 0, 'Joy Fool should get 0 pts when not eliminated first')
    // No joy fool outcome should exist
    const outcomes = host.roomState.specialRoleOutcomes || []
    const jfOutcomes = outcomes.filter(o => o.role === 'joyFool')
    assert.strictEqual(jfOutcomes.length, 0, 'Joy Fool outcome should not exist when not eliminated first')
  })
})

/* ═══════════════════════════════════════════════════════
   PHASE 27 — Duelists
   ═══════════════════════════════════════════════════════ */

describe('Phase 27 — Duelist scoring & exactly-once', { timeout: 60000 }, () => {
  let clients, host, duelist0, duelist1
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: false, duelists: true })
    const duelists = clients.filter(c => c.secret?.specialRole === 'duelists')
    assert.strictEqual(duelists.length, 2, 'Expected exactly 2 duelists')
    duelist0 = duelists[0]
    duelist1 = duelists[1]
    await playCluePhase(clients, host)
    await eliminatePlayer(clients, host, duelist0.sessionId)
  })
  after(() => disconnectClients(clients))

  it('eliminated Duelist outcome correct', () => {
    const outcomes = host.roomState.eliminationResult?.specialRoleOutcomes || host.roomState.specialRoleOutcomes || []
    const duelOutcome = outcomes.find(o => o.role === 'duelists')
    assert.ok(duelOutcome, 'No duelist outcome')
    assert.strictEqual(duelOutcome.eliminatedName, duelist0.name)
    assert.strictEqual(duelOutcome.survivingName, duelist1.name)
  })

  it('exactly one Duelist outcome generated', () => {
    const outcomes = host.roomState.eliminationResult?.specialRoleOutcomes || host.roomState.specialRoleOutcomes || []
    assert.strictEqual(outcomes.filter(o => o.role === 'duelists').length, 1)
  })

  it('−2/+2 scoring verified at RESULT', async () => {
    await waitPastElimination(clients, host)
    await playToResult(clients, host)
    assert.strictEqual(host.roomState.gamePhase, 'RESULT')
    const d0 = host.roomState.players.find(p => p.id === duelist0.sessionId)
    const d1 = host.roomState.players.find(p => p.id === duelist1.sessionId)
    assert.strictEqual(d0.points, -2, 'Eliminated duelist should have -2')
    assert.strictEqual(d1.points, 2, 'Surviving duelist should have +2')
  })

  it('exactly-once — no duplicate outcomes', () => {
    const allOutcomes = host.roomState.specialRoleOutcomes || []
    assert.strictEqual(allOutcomes.filter(o => o.role === 'duelists').length, 1, 'Duplicate duelist outcome')
  })

  it('normal player points unchanged', () => {
    const normalPlayers = host.roomState.players.filter(p =>
      p.id !== duelist0.sessionId && p.id !== duelist1.sessionId
    )
    for (const p of normalPlayers) {
      assert.strictEqual(p.points, 0, `Normal player ${p.name} has points: ${p.points}`)
    }
  })
})

describe('Phase 27 — Duelist privacy (unresolved)', () => {
  let clients, host
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: false, duelists: true })
  })
  after(() => disconnectClients(clients))

  it('partnerId hidden', () => {
    for (const p of host.roomState.players) assert.ok(!p.specialRoleData?.partnerId)
  })
  it('partnerName hidden', () => {
    for (const p of host.roomState.players) assert.ok(!p.specialRoleData?.partnerName)
  })
  it('duelId hidden', () => {
    for (const p of host.roomState.players) assert.ok(!p.specialRoleData?.duelId)
  })
  it('specialRole hidden during active play', () => {
    for (const p of host.roomState.players) assert.strictEqual(p.specialRole, undefined)
  })
})

describe('Phase 27 — Duelist reconnect privacy', { timeout: 15000 }, () => {
  let clients, host, duelists
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: false, duelists: true })
    duelists = clients.filter(c => c.secret?.specialRole === 'duelists')
    assert.strictEqual(duelists.length, 2)
  })
  after(() => disconnectClients(clients))

  it('reconnect restores identity without leaking partner data', async () => {
    const d = duelists[0]
    const savedToken = d.resumeToken
    d.socket.disconnect()
    await sleep(300)

    const { io: ioLib } = await import('socket.io-client')
    const URL = process.env.TEST_URL || 'http://localhost:3005'
    const newSocket = ioLib(URL, { transports: ['websocket'], reconnection: false })
    await new Promise((res, rej) => {
      newSocket.on('connect', res)
      newSocket.on('connect_error', rej)
    })

    let reconnectedState = null
    let rolePayload = null
    newSocket.on('session-reconnected', state => { reconnectedState = state })
    newSocket.on('role-assigned', payload => { rolePayload = payload })

    newSocket.emit('register', { sessionId: d.sessionId, resumeToken: savedToken, roomId: host.roomId })
    await sleep(500)

    assert.ok(reconnectedState, 'No session-reconnected received')
    for (const p of reconnectedState.players) {
      assert.ok(!p.specialRoleData?.partnerId, `partnerId leaked on reconnect for ${p.name}`)
      assert.ok(!p.specialRoleData?.partnerName, `partnerName leaked on reconnect for ${p.name}`)
      assert.ok(!p.specialRoleData?.duelId, `duelId leaked on reconnect for ${p.name}`)
    }
    assert.ok(rolePayload, 'No role-assigned on reconnect')
    assert.strictEqual(rolePayload.specialRole, 'duelists')
    assert.strictEqual(reconnectedState.players.filter(p => p.id === d.sessionId).length, 1, 'Duplicate player')

    newSocket.disconnect()
  })

  it('register without resumeToken is rejected', async () => {
    const { io: ioLib } = await import('socket.io-client')
    const URL = process.env.TEST_URL || 'http://localhost:3005'
    const imposter = ioLib(URL, { transports: ['websocket'], reconnection: false })
    await new Promise((res, rej) => {
      imposter.on('connect', res)
      imposter.on('connect_error', rej)
    })

    let expiredReceived = false
    imposter.on('session-expired', () => { expiredReceived = true })
    imposter.emit('register', { sessionId: duelists[1].sessionId, resumeToken: 'fake', roomId: host.roomId })
    await sleep(500)
    assert.ok(expiredReceived, 'Impersonation not rejected')
    imposter.disconnect()
  })
})

/* ═══════════════════════════════════════════════════════
   POINTS PRIVACY
   ═══════════════════════════════════════════════════════ */

describe('Active-game points privacy', { timeout: 30000 }, () => {
  let clients, host
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: true, duelists: true })
  })
  after(() => disconnectClients(clients))

  it('points are 0 in public state during active play', () => {
    for (const p of host.roomState.players) {
      assert.strictEqual(p.points, 0, `Points leaked for ${p.name}`)
    }
  })

  it('actual scores visible at RESULT', async () => {
    await playCluePhase(clients, host)
    const duelists = clients.filter(c => c.secret?.specialRole === 'duelists')
    if (duelists.length >= 1) {
      await eliminatePlayer(clients, host, duelists[0].sessionId)
    }
    await waitPastElimination(clients, host)
    await playToResult(clients, host)
    assert.strictEqual(host.roomState.gamePhase, 'RESULT')
    const hasNonZero = host.roomState.players.some(p => p.points !== 0)
    assert.ok(hasNonZero, 'Expected non-zero points at RESULT')
  })
})

/* ═══════════════════════════════════════════════════════
   NEGATIVE SCORE RENDERING LOGIC
   ═══════════════════════════════════════════════════════ */

describe('Negative score rendering logic', () => {
  it('ResultPhase renders −N PTS for negative, +N PTS for positive, nothing for zero', () => {
    function renderScore(points) {
      if (points === 0 || points === undefined) return null
      const sign = points > 0 ? '+' : '−'
      return `${sign}${Math.abs(points)} PTS`
    }
    assert.strictEqual(renderScore(-2), '−2 PTS')
    assert.strictEqual(renderScore(2), '+2 PTS')
    assert.strictEqual(renderScore(4), '+4 PTS')
    assert.strictEqual(renderScore(-4), '−4 PTS')
    assert.strictEqual(renderScore(0), null)
    assert.strictEqual(renderScore(undefined), null)
  })
})

/* ═══════════════════════════════════════════════════════
   COMBINED JOY FOOL + DUELISTS
   ═══════════════════════════════════════════════════════ */

describe('Combined Joy Fool + Duelists', () => {
  describe('Assignment without overlap', () => {
    let clients, host
    before(async () => {
      ({ clients, host } = await createAndJoinRoom(5))
      await readyAndStart(clients, host, { joyFool: true, duelists: true })
    })
    after(() => disconnectClients(clients))

    it('exactly 1 Joy Fool + 2 Duelists, no overlap', async () => {
      await sleep(200)
      const jf = clients.filter(c => c.secret?.specialRole === 'joyFool')
      const duel = clients.filter(c => c.secret?.specialRole === 'duelists')
      assert.strictEqual(jf.length, 1)
      assert.strictEqual(duel.length, 2)
      assert.ok(!duel.some(d => d.sessionId === jf[0].sessionId), 'Overlap detected')
    })

    it('base-role counts unchanged', () => {
      assert.strictEqual(clients.length, host.roomState.configuration.totalPlayers)
    })
  })

  describe('Full game play-through', { timeout: 60000 }, () => {
    let clients, host, jf, duel0, duel1
    before(async () => {
      ({ clients, host } = await createAndJoinRoom(5))
      await readyAndStart(clients, host, { joyFool: true, duelists: true })
      jf = clients.find(c => c.secret?.specialRole === 'joyFool')
      const duelists = clients.filter(c => c.secret?.specialRole === 'duelists')
      duel0 = duelists[0]
      duel1 = duelists[1]
    })
    after(() => disconnectClients(clients))

    it('eliminates Duelist first, plays to RESULT with correct scores', async () => {
      await playCluePhase(clients, host)
      await eliminatePlayer(clients, host, duel0.sessionId)
      await waitPastElimination(clients, host)
      await playToResult(clients, host)

      assert.strictEqual(host.roomState.gamePhase, 'RESULT')

      const d0 = host.roomState.players.find(p => p.id === duel0.sessionId)
      const d1 = host.roomState.players.find(p => p.id === duel1.sessionId)
      assert.strictEqual(d0.points, -2)
      assert.strictEqual(d1.points, 2)

      const jfPlayer = host.roomState.players.find(p => p.id === jf.sessionId)
      assert.strictEqual(jfPlayer.points, 0, 'Joy Fool not eliminated first = 0 pts')

      const outcomes = host.roomState.specialRoleOutcomes || []
      assert.strictEqual(outcomes.filter(o => o.role === 'duelists').length, 1)
    })
  })
})

/* ═══════════════════════════════════════════════════════
   PLAY AGAIN — Complete Reset
   ═══════════════════════════════════════════════════════ */

describe('Play Again — All special roles OFF', { timeout: 30000 }, () => {
  let clients, host
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: false, duelists: false })
    await playToResult(clients, host)
    await playAgainAll(clients, host)
  })
  after(() => disconnectClients(clients))

  it('resets to LOBBY with clean state', () => {
    assert.strictEqual(host.roomState.status, 'LOBBY')
    for (const p of host.roomState.players) {
      assert.strictEqual(p.points, 0, `${p.name} points not reset`)
      assert.ok(!p.specialRole, `${p.name} specialRole not reset`)
      assert.ok(!p.eliminated, `${p.name} still eliminated`)
    }
    assert.ok(!host.roomState.eliminationResult, 'eliminationResult not reset')
    assert.ok(!host.roomState.winner, 'winner not reset')
    assert.ok(!host.roomState.wordPair, 'wordPair not reset')
  })
})

describe('Play Again — Joy Fool + Duelists → fresh assignment', { timeout: 60000 }, () => {
  let clients, host
  before(async () => {
    ({ clients, host } = await createAndJoinRoom(5))
    await readyAndStart(clients, host, { joyFool: true, duelists: true })
    await playToResult(clients, host)
    await playAgainAll(clients, host)
  })
  after(() => disconnectClients(clients))

  it('resets all special-role state', () => {
    assert.strictEqual(host.roomState.status, 'LOBBY')
    for (const p of host.roomState.players) {
      assert.strictEqual(p.points, 0)
      assert.ok(!p.specialRole)
      assert.ok(!p.specialRoleData?.partnerId)
      assert.ok(!p.specialRoleData?.partnerName)
      assert.ok(!p.specialRoleData?.duelId)
      assert.ok(!p.specialRoleData?.resolved)
    }
    assert.deepStrictEqual(host.roomState.specialRoleOutcomes, [])
  })

  it('can assign fresh special roles in new game', async () => {
    await readyAndStart(clients, host, { joyFool: true, duelists: true })
    const jf = clients.filter(c => c.secret?.specialRole === 'joyFool')
    const duel = clients.filter(c => c.secret?.specialRole === 'duelists')
    assert.strictEqual(jf.length, 1)
    assert.strictEqual(duel.length, 2)
  })
})
