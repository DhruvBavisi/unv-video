import { io } from 'socket.io-client'
import assert from 'node:assert/strict'
import { describe, it, before, after } from 'node:test'

const URL = process.env.TEST_URL || 'http://localhost:3001'

function emitAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (res) => resolve(res))
  })
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function createClient(name) {
  const sessionId = `midgame-test-${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const socket = io(URL, { transports: ['websocket'], reconnection: false })
  const client = { name, sessionId, socket, roomState: null }
  socket.on('codenames:room-state', (state) => {
    client.roomState = state
  })
  return client
}

describe('Codenames Mid-Game Joining & Role Selection Tests', () => {
  let host, p2, p3, p4, pJoinOp, pJoinSpy, pJoinSpy2
  let clients = []
  let roomId

  before(async () => {
    host = createClient('Host')
    p2 = createClient('P2')
    p3 = createClient('P3')
    p4 = createClient('P4')
    pJoinOp = createClient('JoinOp')
    pJoinSpy = createClient('JoinSpy')
    pJoinSpy2 = createClient('JoinSpy2')
    clients = [host, p2, p3, p4, pJoinOp, pJoinSpy, pJoinSpy2]

    await Promise.all(
      clients.map(
        (c) =>
          new Promise((resolve, reject) => {
            c.socket.on('connect', resolve)
            c.socket.on('connect_error', reject)
          })
      )
    )
  })

  after(() => {
    for (const c of clients) {
      try {
        c.socket.disconnect()
      } catch {}
    }
  })

  it('1. Setup active game with 4 players in PLAYING status', async () => {
    const createRes = await emitAck(host.socket, 'codenames:create-room', {
      sessionId: host.sessionId,
      playerName: host.name
    })
    assert.ok(createRes?.success, 'Host room creation should succeed')
    roomId = host.roomState?.id
    assert.ok(roomId, 'Room ID must be populated')

    for (const p of [p2, p3, p4]) {
      const joinRes = await emitAck(p.socket, 'codenames:join-room', {
        sessionId: p.sessionId,
        playerName: p.name,
        roomId
      })
      assert.ok(joinRes?.success, `${p.name} should join room`)
    }

    // Assign standard roles:
    // Red: host (SPY), p2 (OPERATIVE)
    // Blue: p3 (SPY), p4 (OPERATIVE)
    await emitAck(host.socket, 'codenames:join-team-role', { team: 'red', role: 'SPYMASTER' })
    await emitAck(p2.socket, 'codenames:join-team-role', { team: 'red', role: 'OPERATIVE' })
    await emitAck(p3.socket, 'codenames:join-team-role', { team: 'blue', role: 'SPYMASTER' })
    await emitAck(p4.socket, 'codenames:join-team-role', { team: 'blue', role: 'OPERATIVE' })

    const startRes = await emitAck(host.socket, 'codenames:start-game')
    assert.ok(startRes?.success, 'Game should start')
    await sleep(80)

    assert.equal(host.roomState?.status, 'PLAYING', 'Room must be in PLAYING status')
    assert.equal(host.roomState?.phase, 'BOARD_READY', 'Room phase must be BOARD_READY')
  })

  it('2. Player joins mid-game during PLAYING and starts unassigned as spectator', async () => {
    const joinRes = await emitAck(pJoinOp.socket, 'codenames:join-room', {
      sessionId: pJoinOp.sessionId,
      playerName: pJoinOp.name,
      roomId
    })
    assert.ok(joinRes?.success, 'Mid-game join must succeed')
    await sleep(80)

    const playerInRoom = pJoinOp.roomState?.players?.find((p) => p.id === pJoinOp.sessionId)
    assert.ok(playerInRoom, 'Joined player must be in room players list')
    assert.equal(playerInRoom.team, null, 'Team must be null initially')
    assert.equal(playerInRoom.role, null, 'Role must be null initially')

    // Privacy check: unassigned spectator must NOT see unrevealed card categories
    const unrevealedWithCat = pJoinOp.roomState?.board?.some((c) => !c.revealed && c.category)
    assert.equal(unrevealedWithCat, false, 'Spectator must never receive hidden card categories')
  })

  it('3. Mid-game joiner selects Blue Operative and can switch to Red Operative', async () => {
    // Join as Blue Operative
    const selectRes = await emitAck(pJoinOp.socket, 'codenames:join-team-role', {
      team: 'blue',
      role: 'OPERATIVE'
    })
    assert.ok(selectRes?.success, 'Joining Blue Operative mid-game must succeed')
    await sleep(80)

    let playerInRoom = pJoinOp.roomState?.players?.find((p) => p.id === pJoinOp.sessionId)
    assert.equal(playerInRoom.team, 'blue')
    assert.equal(playerInRoom.role, 'OPERATIVE')
    assert.ok(pJoinOp.roomState?.teams?.blue?.includes(pJoinOp.sessionId))

    // Switch from Blue Operative to Red Operative
    const switchRes = await emitAck(pJoinOp.socket, 'codenames:join-team-role', {
      team: 'red',
      role: 'OPERATIVE'
    })
    assert.ok(switchRes?.success, 'Switching between Operative teams must succeed')
    await sleep(80)

    playerInRoom = pJoinOp.roomState?.players?.find((p) => p.id === pJoinOp.sessionId)
    assert.equal(playerInRoom.team, 'red')
    assert.equal(playerInRoom.role, 'OPERATIVE')
    assert.ok(!pJoinOp.roomState?.teams?.blue?.includes(pJoinOp.sessionId), 'Must be removed from Blue')
    assert.ok(pJoinOp.roomState?.teams?.red?.includes(pJoinOp.sessionId), 'Must be added to Red')
  })

  it('4. Operative is blocked from switching to Spymaster mid-game (anti-cheat)', async () => {
    const illegalRes = await emitAck(pJoinOp.socket, 'codenames:join-team-role', {
      team: 'red',
      role: 'SPYMASTER'
    })
    assert.equal(illegalRes?.success, false)
    assert.equal(illegalRes?.error, 'CANNOT_SWITCH_TO_SPYMASTER')
  })

  it('5. New player joins mid-game as Spymaster and receives 25-card color key', async () => {
    const joinRes = await emitAck(pJoinSpy.socket, 'codenames:join-room', {
      sessionId: pJoinSpy.sessionId,
      playerName: pJoinSpy.name,
      roomId
    })
    assert.ok(joinRes?.success)
    await sleep(80)

    // Select Red Spymaster
    const selectSpyRes = await emitAck(pJoinSpy.socket, 'codenames:join-team-role', {
      team: 'red',
      role: 'SPYMASTER'
    })
    assert.ok(selectSpyRes?.success, 'Joining as Spymaster mid-game must succeed')
    await sleep(80)

    const playerInRoom = pJoinSpy.roomState?.players?.find((p) => p.id === pJoinSpy.sessionId)
    assert.equal(playerInRoom.team, 'red')
    assert.equal(playerInRoom.role, 'SPYMASTER')

    // Spymaster private state: all 25 cards must have categories populated
    const allCardsHaveCategory = pJoinSpy.roomState?.board?.every((c) => Boolean(c.category))
    assert.equal(allCardsHaveCategory, true, 'Spymaster must receive full 25-card category key')
  })

  it('6. Multiple Spymasters allowed on the same team', async () => {
    const joinRes2 = await emitAck(pJoinSpy2.socket, 'codenames:join-room', {
      sessionId: pJoinSpy2.sessionId,
      playerName: pJoinSpy2.name,
      roomId
    })
    assert.ok(joinRes2?.success)
    await sleep(80)

    // Select Red Spymaster as well (host and pJoinSpy are already on Red Spymaster)
    const selectSecondSpy = await emitAck(pJoinSpy2.socket, 'codenames:join-team-role', {
      team: 'red',
      role: 'SPYMASTER'
    })
    assert.ok(selectSecondSpy?.success, 'Multiple Spymasters on the same team must be permitted')
    await sleep(80)

    const redSpies = pJoinSpy2.roomState?.players?.filter((p) => p.team === 'red' && p.role === 'SPYMASTER')
    assert.ok(redSpies.length >= 2, 'Red team must have multiple active Spymasters')
  })

  it('7. Spymaster can switch between Red and Blue Spymaster, but cannot switch to Operative', async () => {
    // Switch from Red Spymaster to Blue Spymaster
    const switchSpyRes = await emitAck(pJoinSpy2.socket, 'codenames:join-team-role', {
      team: 'blue',
      role: 'SPYMASTER'
    })
    assert.ok(switchSpyRes?.success, 'Spymaster switching between Red and Blue must succeed')
    await sleep(80)

    let playerInRoom = pJoinSpy2.roomState?.players?.find((p) => p.id === pJoinSpy2.sessionId)
    assert.equal(playerInRoom.team, 'blue')
    assert.equal(playerInRoom.role, 'SPYMASTER')

    // Attempt to switch to Operative
    const illegalSpyToOp = await emitAck(pJoinSpy2.socket, 'codenames:join-team-role', {
      team: 'blue',
      role: 'OPERATIVE'
    })
    assert.equal(illegalSpyToOp?.success, false)
    assert.equal(illegalSpyToOp?.error, 'CANNOT_SWITCH_TO_OPERATIVE')
  })
})
