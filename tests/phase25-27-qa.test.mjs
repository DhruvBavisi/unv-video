import test, { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { makeClient, emitAck, waitForEvent, waitForRoomState, connectClients, disconnectClients } from './helpers.mjs'

describe('Phase 25-27 Final QA Hardening', () => {
  let clients = []
  let host, p2, p3, p4, p5

  async function setupRoom() {
    host = makeClient('HOST')
    p2 = makeClient('P2')
    p3 = makeClient('P3')
    p4 = makeClient('P4')
    p5 = makeClient('P5')
    clients = [host, p2, p3, p4, p5]
    await connectClients(clients)

    const res = await emitAck(host.socket, 'create-room', { sessionId: host.sessionId, playerName: host.name })
    host.roomId = res.room.roomId
    for (let i = 1; i < 5; i++) {
      await emitAck(clients[i].socket, 'join-room', { roomId: host.roomId, sessionId: clients[i].sessionId, playerName: clients[i].name })
    }
    await waitForRoomState(host, s => s?.players?.length === 5)
  }

  function teardownRoom() {
    disconnectClients(clients)
  }

  describe('Phase 25 - Configuration & Base Game (All OFF)', () => {
    before(setupRoom)
    after(teardownRoom)

    it('has 5 players joined', () => {
      assert.strictEqual(host.roomState.players.length, 5)
    })

    it('defaults to all special roles OFF', () => {
      const config = host.roomState.configuration
      assert.strictEqual(config.specialRoles?.joyFool, false)
      assert.strictEqual(config.specialRoles?.duelists, false)
    })

    it('rejects config update from non-host', async () => {
      p2.socket.emit('update-config', { specialRoles: { joyFool: true } })
      await new Promise(r => setTimeout(r, 200))
      assert.strictEqual(host.roomState.configuration.specialRoles?.joyFool, false)
    })

    it('allows config update from host', async () => {
      host.socket.emit('update-config', { specialRoles: { joyFool: false, duelists: false } })
      await waitForRoomState(host, s => s.configuration.specialRoles.joyFool === false)
      assert.strictEqual(host.roomState.configuration.specialRoles.joyFool, false)
    })

    it('assigns no special role when starting with OFF', async () => {
      clients.forEach(c => { if(c !== host) c.socket.emit('toggle-ready') })
      await waitForRoomState(host, s => s.players.every(p => p.status === 'READY' || p.isHost))
      
      host.socket.emit('start-game')
      await waitForRoomState(host, s => s.status === 'ACTIVE')

      for (const c of clients) {
        assert.ok(!c.secret.specialRole, `Player ${c.name} received unexpected special role`)
      }
    })
  })

  describe('Phase 26 - Joy Fool QA', () => {
    before(setupRoom)
    after(teardownRoom)

    it('assigns exactly one Joy Fool', async () => {
      host.socket.emit('update-config', { specialRoles: { joyFool: true, duelists: false } })
      await waitForRoomState(host, s => s.configuration.specialRoles.joyFool === true)
      
      clients.forEach(c => { if(c !== host) c.socket.emit('toggle-ready') })
      await waitForRoomState(host, s => s.players.every(p => p.status === 'READY' || p.isHost))
      
      host.socket.emit('start-game')
      await waitForRoomState(host, s => s.status === 'ACTIVE')

      const joyFools = clients.filter(c => c.secret?.specialRole === 'joyFool')
      assert.strictEqual(joyFools.length, 1)
    })

    it('hides specialRole in public room state during active play', () => {
      const publicPlayers = host.roomState.players
      for (const p of publicPlayers) {
        assert.ok(!p.specialRole, `Special role leaked for ${p.name}`)
      }
    })
  })

  describe('Phase 27 - Duelists QA', () => {
    before(setupRoom)
    after(teardownRoom)

    it('assigns exactly two Duelists at 5+ players', async () => {
      host.socket.emit('update-config', { specialRoles: { joyFool: false, duelists: true } })
      await waitForRoomState(host, s => s.configuration.specialRoles.duelists === true)
      
      clients.forEach(c => { if(c !== host) c.socket.emit('toggle-ready') })
      await waitForRoomState(host, s => s.players.every(p => p.status === 'READY' || p.isHost))
      
      host.socket.emit('start-game')
      await waitForRoomState(host, s => s.status === 'ACTIVE')

      const duelists = clients.filter(c => c.secret?.specialRole === 'duelists')
      assert.strictEqual(duelists.length, 2)
    })

    it('hides partnerId, partnerName, duelId from public state', () => {
      const publicPlayers = host.roomState.players
      for (const p of publicPlayers) {
        assert.ok(!p.specialRoleData?.partnerId, `partnerId leaked for ${p.name}`)
        assert.ok(!p.specialRoleData?.partnerName, `partnerName leaked for ${p.name}`)
        assert.ok(!p.specialRoleData?.duelId, `duelId leaked for ${p.name}`)
      }
    })
  })

  describe('Integration - Joy Fool + Duelists', () => {
    before(setupRoom)
    after(teardownRoom)
    
    it('plays a full game', async () => {
      host.socket.emit('update-config', { specialRoles: { joyFool: true, duelists: true } })
      await waitForRoomState(host, s => s.configuration.specialRoles.joyFool === true)
      
      clients.forEach(c => { if(c !== host) c.socket.emit('toggle-ready') })
      await waitForRoomState(host, s => s.players.every(p => p.status === 'READY' || p.isHost))
      
      host.socket.emit('start-game')
      await waitForRoomState(host, s => s.status === 'ACTIVE')

      const joyFools = clients.filter(c => c.secret?.specialRole === 'joyFool')
      const duelists = clients.filter(c => c.secret?.specialRole === 'duelists')
      
      assert.strictEqual(joyFools.length, 1)
      assert.strictEqual(duelists.length, 2)
      assert.ok(!duelists.includes(joyFools[0]), 'Overlap detected')

      // Progress to clue phase and vote phase
      host.socket.emit('start-clue-phase')
      await waitForRoomState(host, s => s.gamePhase === 'CLUE')
      
      for (const playerId of host.roomState.turnOrder) {
        const cl = clients.find(c => c.sessionId === playerId)
        cl.socket.emit('submit-clue', { clue: 'test' })
        await waitForRoomState(host, s => s.submittedCluePlayerIds.includes(playerId))
      }
      
      await waitForRoomState(host, s => s.gamePhase === 'VOTE')
      assert.strictEqual(host.roomState.gamePhase, 'VOTE')

      // Eliminate a Duelist and verify scoring
      const victim = duelists[0]
      const otherTarget = clients.find(c => c.sessionId !== victim.sessionId)

      for (const cl of clients) {
        if (cl === victim) cl.socket.emit('select-vote', { targetId: otherTarget.sessionId })
        else cl.socket.emit('select-vote', { targetId: victim.sessionId })
      }
      
      await waitForRoomState(host, s => Object.keys(s.votes).length === 5)
      
      for (const cl of clients) {
        cl.socket.emit('lock-vote')
      }
      
      await waitForRoomState(host, s => s.gamePhase === 'ELIMINATION' || s.gamePhase === 'MR_WHITE_GUESS' || s.gamePhase === 'RESULT')
      
      const outcomes = host.roomState.eliminationResult?.specialRoleOutcomes || host.roomState.specialRoleOutcomes
      assert.ok(outcomes?.length > 0, 'No special role outcomes generated')
      
      const duelistOutcome = outcomes.find(o => o.role === 'duelists')
      assert.ok(duelistOutcome, 'Duelist outcome missing')
      assert.strictEqual(duelistOutcome.eliminatedName, victim.name)

      // Play out the game to reach RESULT phase
      const sleep = ms => new Promise(r => setTimeout(r, ms))
      let retries = 50
      while (host.roomState.gamePhase !== 'RESULT' && retries > 0) {
        retries--
        if (host.roomState.gamePhase === 'ELIMINATION') {
          host.socket.emit('next-phase')
        }
        else if (host.roomState.gamePhase === 'MR_WHITE_GUESS') {
          const mwPlayer = host.roomState.players.find(p => p.role === 'MR_WHITE')
          const mwClient = clients.find(c => c.sessionId === mwPlayer?.id)
          mwClient?.socket.emit('submit-mr-white-guess', { text: 'guess' })
        }
        else if (host.roomState.gamePhase === 'CLUE') {
          for (const playerId of host.roomState.turnOrder) {
            const cl = clients.find(c => c.sessionId === playerId)
            if (cl && !cl.roomState.players.find(p => p.id === cl.sessionId)?.eliminated) {
              cl.socket.emit('submit-clue', { clue: 'test2' })
            }
          }
        }
        else if (host.roomState.gamePhase === 'VOTE') {
          const activeUC = host.roomState.players.find(p => p.role === 'UNDERCOVER' && !p.eliminated)
          const activeMW = host.roomState.players.find(p => p.role === 'MR_WHITE' && !p.eliminated)
          const toEliminate = activeUC || activeMW || host.roomState.players.find(p => !p.eliminated && p.role !== 'UNDERCOVER' && p.role !== 'MR_WHITE')
          
          if (toEliminate) {
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
            await sleep(200)
            for (const cl of clients) {
              if (!cl.roomState.players.find(p => p.id === cl.sessionId)?.eliminated) {
                 cl.socket.emit('lock-vote')
              }
            }
          }
        }
        await sleep(300)
      }

      assert.strictEqual(host.roomState.gamePhase, 'RESULT', 'Game failed to reach RESULT phase')

      clients.forEach(c => c.socket.emit('play-again'))
      await waitForRoomState(host, s => s.status === 'LOBBY', 5000)
      
      const resetP1 = host.roomState.players[0]
      assert.strictEqual(resetP1.points, 0)
      assert.ok(!resetP1.specialRole)
      assert.ok(!host.roomState.eliminationResult)
    })
  })
})
