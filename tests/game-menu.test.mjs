import assert from 'node:assert'
import { describe, it, before, after } from 'node:test'
import { makeClient, connectClients, disconnectClients, emitAck, waitForRoomState } from './helpers.mjs'

describe('Game Menu Host Actions & Authorization', { timeout: 25000 }, () => {
  let host, clients, roomId
  let initialConfig

  before(async () => {
    host = makeClient('Host')
    clients = [
      host,
      makeClient('P2'),
      makeClient('P3')
    ]
    await connectClients(clients)

    const res = await emitAck(host.socket, 'create-room', { sessionId: host.sessionId, playerName: host.name })
    roomId = res.room.roomId

    for (let i = 1; i < clients.length; i++) {
      const joinRes = await emitAck(clients[i].socket, 'join-room', { sessionId: clients[i].sessionId, roomId, playerName: clients[i].name })
      clients[i].roomState = joinRes.room
    }

    await waitForRoomState(host, s => s.players.length === 3)
    
    // Set config
    host.socket.emit('update-config', { totalPlayers: 3, undercover: 1, mrWhite: 0, specialRoles: { joyFool: true } })
    await waitForRoomState(host, s => s.configuration.undercover === 1 && s.configuration.specialRoles.joyFool === true)
    
    initialConfig = JSON.parse(JSON.stringify(host.roomState.configuration))
    
    clients.forEach(c => {
      if (c !== host) c.socket.emit('toggle-ready')
    })
    await waitForRoomState(host, s => s.players.every(p => p.isHost || p.status === 'READY'))

    host.socket.emit('start-game')
    await waitForRoomState(host, s => s.phase === 'ACTIVE')
  })

  after(() => {
    disconnectClients(clients)
  })

  it('rejects host actions from non-host players', async () => {
    const nonHost = clients[1]
    const res1 = await emitAck(nonHost.socket, 'host-new-game')
    assert.strictEqual(res1.error, 'NOT_HOST')

    const res2 = await emitAck(nonHost.socket, 'host-return-to-lobby')
    assert.strictEqual(res2.error, 'NOT_HOST')
  })

  it('allows host to start new game in middle of game and preserves config', async () => {
    const initialVersion = host.roomState.gameVersion || 0
    const res = await emitAck(host.socket, 'host-new-game')
    assert.strictEqual(res.success, true)
    
    await waitForRoomState(host, s => s.gameVersion === initialVersion + 1)
    const state = host.roomState
    assert.strictEqual(state.phase, 'ACTIVE')
    assert.strictEqual(state.gamePhase, 'CLUE')
    assert.strictEqual(state.round, 1)
    assert.deepStrictEqual(state.clues, [])
    assert.deepStrictEqual(state.chat, [])
    assert.deepStrictEqual(state.specialRoleOutcomes, [])
    assert.deepStrictEqual(state.configuration, initialConfig, 'Configuration should remain unchanged')

    state.players.forEach(p => {
      assert.strictEqual(p.eliminated, false)
      assert.strictEqual(p.spectator, false)
      assert.strictEqual(p.points, 0)
    })
  })

  it('allows host to return to lobby and preserves config', async () => {
    const initialVersion = host.roomState.gameVersion || 0
    const res = await emitAck(host.socket, 'host-return-to-lobby')
    assert.strictEqual(res.success, true)
    
    await waitForRoomState(host, s => s.gameVersion === initialVersion + 1)
    const state = host.roomState
    assert.strictEqual(state.phase, 'LOBBY')
    assert.strictEqual(state.status, 'LOBBY')
    assert.deepStrictEqual(state.configuration, initialConfig, 'Configuration should remain unchanged')

    state.players.forEach(p => {
      assert.strictEqual(p.eliminated, false)
      assert.strictEqual(p.points, 0)
    })
  })

  it('rejects new game action if in lobby phase', async () => {
    const res = await emitAck(host.socket, 'host-new-game')
    assert.strictEqual(res.error, 'INVALID_PHASE')
  })
})
