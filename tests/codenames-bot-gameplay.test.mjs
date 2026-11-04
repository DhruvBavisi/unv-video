import { io as ioc } from 'socket.io-client'
import assert from 'node:assert/strict'

process.env.TEST_FAST_BOTS = 'true'

const URL = process.env.TEST_URL || `http://localhost:${process.env.PORT || 3005}`

function createClient() {
  const sessionId = 'test-session-' + Math.random().toString(36).substring(2, 9)
  const socket = ioc(URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  })
  let roomState = null
  socket.on('codenames:room-state', (state) => {
    roomState = state
  })
  return { socket, sessionId, get roomState() { return roomState }, set roomState(s) { roomState = s } }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function waitForCondition(checkFn, timeoutMs = 4000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      try {
        const res = checkFn()
        if (res) {
          clearInterval(interval)
          resolve(res)
        } else if (Date.now() - start > timeoutMs) {
          clearInterval(interval)
          reject(new Error(`Timeout waiting for condition after ${timeoutMs}ms`))
        }
      } catch (err) {
        clearInterval(interval)
        reject(err)
      }
    }, 25)
  })
}

export async function run() {
  console.log('Testing Codenames Bot Gameplay & Dev Integration...')
  const client = createClient()

  await new Promise((resolve, reject) => {
    client.socket.on('connect', resolve)
    client.socket.on('connect_error', reject)
  })
  assert.ok(client.socket.connected, 'Host connected to server')
  console.log('PASS  Host socket connected')

  // 1. Host creates room
  let roomId = null
  await new Promise((resolve) => {
    client.socket.emit('codenames:create-room', { sessionId: client.sessionId, playerName: 'HostPlayer' }, (res) => {
      assert.ok(res.success, 'Room created successfully')
      roomId = res.roomId
      if (res.room && !client.roomState) client.roomState = res.room
      resolve()
    })
  })
  console.log('PASS  Host created room:', roomId)

  // 2. Host selects Blue Operative and starts single player
  await new Promise((resolve) => {
    client.socket.emit('codenames:join-team-role', { team: 'blue', role: 'OPERATIVE' }, (res) => {
      assert.ok(res.success, 'Host joined as Blue Operative')
      resolve()
    })
  })
  console.log('PASS  Host joined Blue Operative slot')

  await new Promise((resolve) => {
    client.socket.emit('codenames:start-game', (res) => {
      assert.ok(res.success, 'Start game succeeds')
      resolve()
    })
  })
  await waitForCondition(() => client.roomState?.status === 'WAITING_FOR_PLAYERS')
  assert.equal(client.roomState.status, 'WAITING_FOR_PLAYERS', 'Room is waiting for players')
  console.log('PASS  Room transitioned to WAITING_FOR_PLAYERS')

  // 3. Host adds 3 dev bots
  await new Promise((resolve) => {
    client.socket.emit('codenames:dev-add-bots', { count: 3 }, (res) => {
      assert.ok(res.success, 'Dev add bots succeeded')
      resolve()
    })
  })

  // 4. Bots should auto-fill vacant roles and transition room to PLAYING
  await waitForCondition(() => client.roomState.status === 'PLAYING')
  assert.equal(client.roomState.status, 'PLAYING', 'Room is now PLAYING with bots')
  assert.equal(client.roomState.players.length, 4, '4 players in room')
  assert.equal(client.roomState.players.filter(p => p.isBot).length, 3, '3 bots present')
  console.log('PASS  Bots auto-assigned roles and started game into PLAYING status')

  // Verify all 4 required roles are occupied
  const redSpy = client.roomState.players.find(p => p.team === 'red' && p.role === 'SPYMASTER')
  const blueSpy = client.roomState.players.find(p => p.team === 'blue' && p.role === 'SPYMASTER')
  const redOps = client.roomState.players.find(p => p.team === 'red' && p.role === 'OPERATIVE')
  const blueOps = client.roomState.players.find(p => p.team === 'blue' && p.role === 'OPERATIVE')
  assert.ok(redSpy && redSpy.isBot, 'Red Spymaster is a bot')
  assert.ok(blueSpy && blueSpy.isBot, 'Blue Spymaster is a bot')
  assert.ok(redOps && redOps.isBot, 'Red Operative is a bot')
  assert.ok(blueOps && !blueOps.isBot, 'Blue Operative is human host')
  console.log('PASS  All 4 roles correctly assigned with 3 bots and 1 human')

  // 5. Bot Spymaster gives a clue
  // Both teams have bot spymasters, so regardless of startingTeam, a bot spymaster will give a clue!
  await waitForCondition(() => client.roomState.phase === 'GUESS_PHASE', 3000)
  assert.equal(client.roomState.phase, 'GUESS_PHASE', 'Room entered GUESS_PHASE after bot clue')
  assert.ok(client.roomState.currentClue, 'Current clue is present')
  assert.ok(client.roomState.currentClue.word.length >= 2, 'Clue word is a valid word: ' + client.roomState.currentClue.word)
  assert.ok(client.roomState.currentClue.number >= 1, 'Clue number is valid: ' + client.roomState.currentClue.number)
  console.log(`PASS  Bot Spymaster gave clue: "${client.roomState.currentClue.word}" (${client.roomState.currentClue.number})`)

  // 6. Test Operative behavior
  if (client.roomState.currentTeam === 'red') {
    // Red Operative is a bot! Wait for Red Operative to target and reveal a card
    await waitForCondition(() => client.roomState.board.some(c => c.revealed), 8000)
    const revealedCard = client.roomState.board.find(c => c.revealed)
    assert.ok(revealedCard, 'Bot operative revealed a card: ' + revealedCard.word)
    console.log(`PASS  Bot Operative revealed card: "${revealedCard.word}" (${revealedCard.category})`)
  } else {
    // Blue team turn: Host is operative. Host selects and reveals a card
    const unrevealedIdx = client.roomState.board.findIndex(c => !c.revealed)
    await new Promise((resolve) => {
      client.socket.emit('codenames:select-card', { cardIndex: unrevealedIdx }, (res) => {
        assert.ok(res.success, 'Host targeted card')
        resolve()
      })
    })
    await new Promise((resolve) => {
      client.socket.emit('codenames:reveal-card', { cardIndex: unrevealedIdx }, (res) => {
        assert.ok(res.success, 'Host revealed card')
        resolve()
      })
    })
    console.log('PASS  Human Operative made a guess successfully')

    // End human turn to pass to Red team (all bots) if turn hasn't already ended automatically
    if (client.roomState.currentTeam === 'blue' && client.roomState.phase === 'GUESS_PHASE') {
      await new Promise((resolve) => {
        client.socket.emit('codenames:end-turn', (res) => {
          assert.ok(res.success, 'Human ended turn')
          resolve()
        })
      })
      console.log('PASS  Human ended turn; turn passed to bot team')
    } else {
      console.log('PASS  Turn automatically passed to bot team after revealing non-team card')
    }

    if (client.roomState.status === 'FINISHED') {
      console.log('PASS  Game ended after card reveal (assassin or last card)')
    } else {
      // Wait for Red Bot Spymaster to give clue
      await waitForCondition(() => client.roomState.currentTeam === 'red' && client.roomState.phase === 'GUESS_PHASE', 5000)
      console.log(`PASS  Red Bot Spymaster gave clue: "${client.roomState.currentClue.word}" (${client.roomState.currentClue.number})`)

      // Wait for Red Bot Operative to guess and reveal a card
      const prevRevealedCount = client.roomState.board.filter(c => c.revealed).length
      await waitForCondition(() => client.roomState.board.filter(c => c.revealed).length > prevRevealedCount, 6000)
      console.log('PASS  Red Bot Operative targeted and revealed a card')
    }
  }

  // 7. Cleanup
  client.socket.disconnect()
  console.log('\nAll Codenames bot gameplay tests passed successfully!')
}

run().catch(err => {
  console.error('\nFAIL in Codenames bot test:', err)
  process.exit(1)
})
