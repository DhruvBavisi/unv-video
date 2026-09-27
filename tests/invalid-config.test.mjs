import assert from 'node:assert'
import { describe, it, before, after } from 'node:test'
import { makeClient, connectClients, disconnectClients, emitAck, waitForRoomState } from './helpers.mjs'

describe('Invalid Configuration Validation', { timeout: 10000 }, () => {
  let host

  before(async () => {
    host = makeClient('Host')
    await connectClients([host])
    const res = await emitAck(host.socket, 'create-room', { sessionId: host.sessionId, playerName: host.name })
    host.roomState = res.room
  })

  after(() => {
    disconnectClients([host])
  })

  it('rejects invalid totalPlayers (< 3)', async () => {
    const originalConfig = { ...host.roomState.configuration }
    host.socket.emit('update-config', { totalPlayers: 2, undercover: 0, mrWhite: 0 })
    // Wait slightly to ensure it didn't mutate
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(host.roomState.configuration.totalPlayers, originalConfig.totalPlayers)
  })

  it('rejects negative undercover count', async () => {
    const originalConfig = { ...host.roomState.configuration }
    host.socket.emit('update-config', { undercover: -1 })
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(host.roomState.configuration.undercover, originalConfig.undercover)
  })

  it('rejects negative mrWhite count', async () => {
    const originalConfig = { ...host.roomState.configuration }
    host.socket.emit('update-config', { mrWhite: -1 })
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(host.roomState.configuration.mrWhite, originalConfig.mrWhite)
  })

  it('rejects undercover + mrWhite = 0', async () => {
    const originalConfig = { ...host.roomState.configuration }
    host.socket.emit('update-config', { undercover: 0, mrWhite: 0 })
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(host.roomState.configuration.undercover, originalConfig.undercover)
  })

  it('rejects civilian count below 50%', async () => {
    const originalConfig = { ...host.roomState.configuration }
    host.socket.emit('update-config', { totalPlayers: 10, undercover: 4, mrWhite: 2 }) // 6 imposters out of 10
    await new Promise(r => setTimeout(r, 200))
    assert.strictEqual(host.roomState.configuration.totalPlayers, originalConfig.totalPlayers)
  })

  it('non-host cannot bypass validation or update config', async () => {
    const nonHost = makeClient('NonHost')
    await connectClients([nonHost])
    await emitAck(nonHost.socket, 'join-room', { sessionId: nonHost.sessionId, roomId: host.roomState.roomId, playerName: nonHost.name })
    await waitForRoomState(nonHost, s => s !== null)

    const originalConfig = { ...host.roomState.configuration }
    
    // Attempt valid config change but as non-host
    nonHost.socket.emit('update-config', { totalPlayers: 4, undercover: 1, mrWhite: 0 })
    await new Promise(r => setTimeout(r, 200))
    
    assert.strictEqual(host.roomState.configuration.totalPlayers, originalConfig.totalPlayers, 'Non-host was able to update config')
    disconnectClients([nonHost])
  })
})
