import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { io } from 'socket.io-client'

const URL = process.env.TEST_URL || 'http://localhost:3001'

function createClient(name) {
  const socket = io(URL, { transports: ['websocket'], reconnection: false })
  const sessionId = `test-${name}-${Math.random().toString(36).slice(2, 8)}`
  return {
    socket,
    name,
    sessionId,
    roomState: null,
    chatMessages: []
  }
}

function emitAck(socket, event, payload, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout on ${event}`)), timeoutMs)
    const cb = (res) => {
      clearTimeout(timer)
      resolve(res)
    }
    if (payload === undefined) {
      socket.emit(event, cb)
    } else {
      socket.emit(event, payload, cb)
    }
  })
}

function waitForRoomState(client, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    if (client.roomState && predicate(client.roomState)) {
      return resolve(client.roomState)
    }
    const timer = setTimeout(() => {
      client.socket.off('draw:room-state', onState)
      reject(new Error(`Timeout waiting for state predicate`))
    }, timeoutMs)
    const onState = (state) => {
      client.roomState = state
      if (predicate(state)) {
        clearTimeout(timer)
        client.socket.off('draw:room-state', onState)
        resolve(state)
      }
    }
    client.socket.on('draw:room-state', onState)
  })
}

function waitForChatMessage(client, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const existing = client.chatMessages.find(predicate)
    if (existing) return resolve(existing)
    const timer = setTimeout(() => {
      client.socket.off('draw:chat-message', onMsg)
      reject(new Error('Timeout waiting for chat message'))
    }, timeoutMs)
    const onMsg = (msg) => {
      client.chatMessages.push(msg)
      if (predicate(msg)) {
        clearTimeout(timer)
        client.socket.off('draw:chat-message', onMsg)
        resolve(msg)
      }
    }
    client.socket.on('draw:chat-message', onMsg)
  })
}

describe('Skribbl Vote Kick & Player Action Tests', () => {
  it('PlayerStrip component verifies single tap gear icon and Portal overlay', () => {
    const stripContent = fs.readFileSync(path.resolve('src/games/skribbl/components/PlayerStrip.jsx'), 'utf-8')
    
    // Verifies long-press timer is completely removed
    assert.ok(!stripContent.includes('longPressTimerRef'), 'Long press timer must be removed from PlayerStrip')
    assert.ok(!stripContent.includes('setTimeout('), 'No arbitrary timeout handlers for selection')
    
    // Verifies single tap gear button with settings SVG and transparent background
    assert.ok(stripContent.includes('className="sk-gear-btn"'), 'PlayerStrip must render .sk-gear-btn')
    assert.ok(stripContent.includes('/images/svg/settings.svg'), 'PlayerStrip must use settings SVG')
    assert.ok(stripContent.includes("background: 'transparent'"), 'Settings button must have transparent background')
    
    // Verifies createPortal to document.body to prevent ChatBox overlap
    assert.ok(stripContent.includes('createPortal('), 'PlayerStrip must render modal using createPortal')
    assert.ok(stripContent.includes('document.body'), 'Modal must mount directly to document.body')
    assert.ok(stripContent.includes('zIndex: 999999'), 'Modal must have highest z-index')
    
    // Verifies Vote Kick and Kick buttons
    assert.ok(stripContent.includes('KICK PLAYER'), 'Modal must include KICK PLAYER option for host')
    assert.ok(stripContent.includes('VOTE KICK'), 'Modal must include VOTE KICK option')
    assert.ok(stripContent.includes('onVoteKickPlayer'), 'PlayerStrip must accept and invoke onVoteKickPlayer')
  })

  it('Server draw:vote-kick broadcasts vote message and kicks when all other players agree', async () => {
    const c1 = createClient('P1-Host')
    const c2 = createClient('P2-Voter')
    const c3 = createClient('P3-Target')

    try {
      const connectPromises = [c1, c2, c3].map(c => new Promise((resolve) => {
        c.socket.on('connect', () => {
          c.socket.on('draw:chat-message', (msg) => c.chatMessages.push(msg))
          c.socket.on('draw:room-state', (st) => { c.roomState = st })
          c.socket.emit('register', { sessionId: c.sessionId })
          resolve()
        })
      }))
      await Promise.all(connectPromises)

      // P1 creates room
      const createRes = await emitAck(c1.socket, 'draw:create-room', {
        playerName: c1.name,
        sessionId: c1.sessionId
      })
      assert.ok(createRes?.room, 'Host room creation should return room')
      const roomId = createRes.room.id

      // P2 and P3 join
      await emitAck(c2.socket, 'draw:join-room', { roomId, playerName: c2.name, sessionId: c2.sessionId })
      await emitAck(c3.socket, 'draw:join-room', { roomId, playerName: c3.name, sessionId: c3.sessionId })

      // Wait for all 3 players in room
      await waitForRoomState(c1, st => st.players.length === 3)

      // Test 1: Self vote kick should be rejected
      const selfVoteRes = await emitAck(c2.socket, 'draw:vote-kick', { targetId: c2.sessionId })
      assert.strictEqual(selfVoteRes?.success, false)
      assert.strictEqual(selfVoteRes?.error, 'CANNOT_TARGET_SELF')

      // Test 2: P2 votes to kick P3 (Target). Total needed = 2 (all connected players excluding P3: P1 + P2).
      const vote1Promise = waitForChatMessage(c1, msg => 
        msg.type === 'SYSTEM' && 
        msg.message === `Vote to kick ${c3.name} (1/2)` &&
        !msg.message.includes(c2.name)
      )
      const vote1Res = await emitAck(c2.socket, 'draw:vote-kick', { targetId: c3.sessionId })
      assert.strictEqual(vote1Res?.success, true)
      assert.strictEqual(vote1Res?.kicked, false)
      assert.strictEqual(vote1Res?.voteCount, 1)
      assert.strictEqual(vote1Res?.totalVotes, 2)

      const chatMsg1 = await vote1Promise
      assert.ok(chatMsg1.message.includes('(1/2)'), 'Chat message must include "(1/2)" vote count/total')

      // Test 3: Duplicate vote from P2 should be rejected
      const dupRes = await emitAck(c2.socket, 'draw:vote-kick', { targetId: c3.sessionId })
      assert.strictEqual(dupRes?.success, false)
      assert.strictEqual(dupRes?.error, 'ALREADY_VOTED')

      // Test 4: P1 (Host) also votes to kick P3. Reaches 2/2 -> P3 is kicked!
      let p3KickedEvent = false
      const kickedPromise = new Promise(resolve => {
        c3.socket.once('draw:kicked', () => {
          p3KickedEvent = true
          resolve()
        })
      })

      const kickedChatPromise = waitForChatMessage(c1, msg => 
        msg.type === 'SYSTEM' && msg.message.includes(`${c3.name} was kicked from the room.`)
      )

      const vote2Res = await emitAck(c1.socket, 'draw:vote-kick', { targetId: c3.sessionId })
      assert.strictEqual(vote2Res?.success, true)
      assert.strictEqual(vote2Res?.kicked, true)
      assert.strictEqual(vote2Res?.voteCount, 2)
      assert.strictEqual(vote2Res?.totalVotes, 2)

      await Promise.all([kickedChatPromise, kickedPromise])
      assert.ok(p3KickedEvent, 'Target client must receive draw:kicked event')

      // Wait for room state to reflect P3 removal
      const finalState = await waitForRoomState(c1, st => st.players.length === 2 && !st.players.some(p => p.id === c3.sessionId))
      assert.strictEqual(finalState.players.length, 2)
    } finally {
      c1.socket.disconnect()
      c2.socket.disconnect()
      c3.socket.disconnect()
    }
  })
})
