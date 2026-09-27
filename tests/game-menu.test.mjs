import assert from 'node:assert'
import { describe, it, before, after } from 'node:test'
import { makeClient, connectClients, disconnectClients, emitAck, waitForRoomState } from './helpers.mjs'

describe('Game Menu Host Actions & Authorization', { timeout: 15000 }, () => {
  let host, clients, roomId

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
    host.socket.emit('update-config', { totalPlayers: 3, undercover: 1, mrWhite: 0 })
    await waitForRoomState(host, s => s.configuration.undercover === 1)
    
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

  it('allows host to start new game in middle of game', async () => {
    // Current state is ACTIVE
    const initialVersion = host.roomState.gameVersion || 0
    const res = await emitAck(host.socket, 'host-new-game')
    assert.strictEqual(res.success, true)
    
    await waitForRoomState(host, s => s.gameVersion === initialVersion + 1)
    assert.strictEqual(host.roomState.phase, 'ACTIVE')
    assert.strictEqual(host.roomState.round, 1)
    // Ensures clues are cleared, new roles assigned, etc.
    assert.deepStrictEqual(host.roomState.clues, [])
  })

  it('allows host to return to lobby', async () => {
    const initialVersion = host.roomState.gameVersion || 0
    const res = await emitAck(host.socket, 'host-return-to-lobby')
    assert.strictEqual(res.success, true)
    
    await waitForRoomState(host, s => s.gameVersion === initialVersion + 1)
    assert.strictEqual(host.roomState.phase, 'LOBBY')
    assert.strictEqual(host.roomState.status, 'LOBBY')
  })

  it('rejects new game action if in lobby phase', async () => {
    const res = await emitAck(host.socket, 'host-new-game')
    assert.strictEqual(res.error, 'INVALID_PHASE')
  })
})
