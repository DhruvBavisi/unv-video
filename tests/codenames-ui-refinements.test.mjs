import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { executeGiveClue, executeCardReveal, executeTableReset } from '../server/games/codenames/codenamesBot.js'

describe('Codenames UI Refinements & History Metadata Verification', () => {
  it('executeGiveClue records spymaster details in turnHistory', () => {
    const room = {
      currentTeam: 'red',
      phase: 'CLUE_PHASE',
      players: [
        { id: 'p1', name: 'Dhruv', team: 'red', role: 'SPYMASTER', avatar: 'tile-a1.webp' },
        { id: 'p2', name: 'Agent Smith', team: 'red', role: 'OPERATIVE' }
      ],
      turnHistory: []
    }

    executeGiveClue(room, 'RIVER', 3)

    assert.strictEqual(room.turnHistory.length, 1)
    const turn = room.turnHistory[0]
    assert.strictEqual(turn.team, 'red')
    assert.strictEqual(turn.clue.word, 'RIVER')
    assert.strictEqual(turn.clue.number, 3)
    assert.ok(turn.spymaster, 'Spymaster must be attached to turn')
    assert.strictEqual(turn.spymaster.id, 'p1')
    assert.strictEqual(turn.spymaster.name, 'Dhruv')
  })

  it('executeCardReveal records guesser details in turnHistory guesses', () => {
    const room = {
      currentTeam: 'red',
      phase: 'GUESS_PHASE',
      currentClue: { word: 'RIVER', number: 3 },
      players: [
        { id: 'p1', name: 'Dhruv', team: 'red', role: 'SPYMASTER' },
        { id: 'p2', name: 'Agent Fox', team: 'red', role: 'OPERATIVE', avatar: 'tile-b1.webp' }
      ],
      board: [
        { id: 0, word: 'WATER', category: 'red', revealed: false },
        { id: 1, word: 'APPLE', category: 'blue', revealed: false }
      ],
      turnHistory: [
        {
          id: 'turn-1',
          team: 'red',
          clue: { word: 'RIVER', number: 3 },
          spymaster: { id: 'p1', name: 'Dhruv' },
          guesses: []
        }
      ]
    }

    executeCardReveal(room, 0, 'p2')

    assert.strictEqual(room.turnHistory[0].guesses.length, 1)
    const guess = room.turnHistory[0].guesses[0]
    assert.strictEqual(guess.word, 'WATER')
    assert.strictEqual(guess.category, 'red')
    assert.ok(guess.guesser, 'Guesser object must be present')
    assert.strictEqual(guess.guesser.id, 'p2')
    assert.strictEqual(guess.guesser.name, 'Agent Fox')
    assert.strictEqual(guess.guessedBy, 'Agent Fox')
  })

  it('executeTableReset generates new words and moves all players to spectators', () => {
    const room = {
      status: 'PLAYING',
      phase: 'GUESS_PHASE',
      startingTeam: 'red',
      currentTeam: 'red',
      players: [
        { id: 'p1', name: 'Dhruv', team: 'red', role: 'SPYMASTER' },
        { id: 'p2', name: 'Operative 1', team: 'red', role: 'OPERATIVE' },
        { id: 'p3', name: 'Enemy Spy', team: 'blue', role: 'SPYMASTER' }
      ],
      teams: { red: ['p1', 'p2'], blue: ['p3'] },
      spymasters: { red: 'p1', blue: 'p3' },
      currentClue: { word: 'CODE', number: 2 },
      guessesLeft: 2,
      board: [{ id: 0, word: 'OLD_WORD', revealed: true }],
      turnHistory: [{ id: 'turn-1' }]
    }

    executeTableReset(room)

    assert.strictEqual(room.status, 'WAITING_FOR_PLAYERS')
    assert.strictEqual(room.phase, 'WAITING_FOR_PLAYERS')
    assert.strictEqual(room.board.length, 25)
    assert.notStrictEqual(room.board[0].word, 'OLD_WORD')
    assert.strictEqual(room.currentClue, null)
    assert.strictEqual(room.guessesLeft, null)
    assert.strictEqual(room.turnHistory.length, 0)
    assert.deepStrictEqual(room.teams, { red: [], blue: [] })
    assert.deepStrictEqual(room.spymasters, { red: null, blue: null })
    // All players must move to spectators
    assert.ok(room.players.every(p => p.team === null && p.role === null), 'All players must have team=null and role=null')
  })

  it('CSS defines card aspect ratio strictly as 11 / 10', () => {
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    assert.ok(cssContent.includes('--cn-board-card-ratio: 11 / 10;'), 'CSS must define --cn-board-card-ratio as 11 / 10')
    assert.ok(!cssContent.includes('--cn-board-card-ratio: 1.18'), 'Old 1.18 card ratio must be removed')
    assert.ok(!cssContent.includes('--cn-board-card-ratio: 1.22'), 'Old 1.22 card ratio must be removed')
  })

  it('CSS includes Spymaster Clue Banner and Guesser badge classes with overlapping avatar', () => {
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    assert.ok(cssContent.includes('.cn-log-clue-banner'), 'Spymaster banner class must be present')
    assert.ok(cssContent.includes('.cn-log-clue-pill'), 'Clue word pill class must be present')
    assert.ok(cssContent.includes('.cn-log-clue-badge'), 'Clue number circle class must be present')
    assert.ok(cssContent.includes('.cn-log-spymaster-avatar-wrap'), 'Spymaster avatar wrap must be present')
    assert.ok(cssContent.includes('.cn-log-guess-badge'), 'Guesser badge must be present')
    assert.ok(cssContent.includes('.cn-log-guess-avatar-group'), 'Guesser avatar group must be present')
    assert.ok(cssContent.includes('.cn-log-guess-word-pill'), 'Guesser word pill must be present')
    assert.ok(cssContent.includes('flex-wrap: wrap;'), 'Guesses must wrap horizontally')
  })

  it('CSS includes restart button styling in TopBar nav', () => {
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    assert.ok(cssContent.includes('.cn-nav-btn.restart-btn'), 'Restart button styles must exist')
  })

  it('CSS includes Score Card Thumbnail image styles', () => {
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    assert.ok(cssContent.includes('.cn-score-thumb img'), 'Score card thumb image styling must exist')
  })

  it('CSS includes upgraded Bottom Guess Clue Bar classes and custom padding', () => {
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    assert.ok(cssContent.includes('.cn-bottom-guess-clue-bar'), 'Bottom guess clue bar container must be present')
    assert.ok(cssContent.includes('.cn-bottom-guess-clue-pill'), 'Bottom clue pill must be present')
    assert.ok(cssContent.includes('.cn-bottom-guess-clue-num'), 'Bottom clue number circle must be present')
    assert.ok(cssContent.includes('.cn-bottom-guess-clue-num--red'), 'Red team number color must be defined')
    assert.ok(cssContent.includes('.cn-bottom-guess-clue-num--blue'), 'Blue team number color must be defined')
    assert.ok(cssContent.includes('padding: calc(var(--u) * 0.8) calc(var(--u) * 1.4);'), 'Bottom clue bar must have upgraded padding')
    assert.ok(cssContent.includes('linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)'), 'Upgraded 3D gradient for pills must be present')
  })

  it('Viewport meta tag includes interactive-widget=resizes-content for keyboard space assignment', () => {
    const htmlContent = fs.readFileSync(path.resolve('index.html'), 'utf-8')
    assert.ok(htmlContent.includes('interactive-widget=resizes-content'), 'index.html must specify interactive-widget=resizes-content')
  })

  it('CSS and CodenamesBoard implement comfort keyboard spacer so page extends only enough for keyboard to sit below input', () => {
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    const jsxContent = fs.readFileSync(path.resolve('src/games/codenames/components/CodenamesBoard.jsx'), 'utf-8')
    assert.ok(cssContent.includes('.cn-keyboard-spacer'), 'CSS must define .cn-keyboard-spacer')
    assert.ok(cssContent.includes('.has-keyboard-open'), 'CSS must handle .has-keyboard-open state')
    assert.ok(jsxContent.includes('cn-keyboard-spacer'), 'CodenamesBoard must render keyboard spacer below input')
    assert.ok(jsxContent.includes('keyboardSpace'), 'CodenamesBoard must track keyboardSpace state')
    assert.ok(jsxContent.includes('setIsInputFocused(true)'), 'CodenamesBoard must track input focus')
    assert.ok(jsxContent.includes('setIsInputFocused(false)'), 'CodenamesBoard must track input blur')
    assert.ok(jsxContent.includes('getIphoneKeyboardHeight'), 'CodenamesBoard must calculate iPhone keyboard height including suggestions')
    assert.ok(jsxContent.includes('KEYBOARD_CLEARANCE_BUFFER'), 'CodenamesBoard must define KEYBOARD_CLEARANCE_BUFFER to prevent keyboard/accessory bar overlap')
    assert.ok(jsxContent.includes('Math.max(0, Math.round(kbHeight - restingSpaceBelowRef.current + KEYBOARD_CLEARANCE_BUFFER))'), 'CodenamesBoard must calculate difference including clearance buffer')
    assert.ok(cssContent.includes('transition: none !important'), 'CSS must disable spacer transition to prevent lag and overlap')
    assert.ok(cssContent.includes('cn-keyboard-active'), 'CSS must allow whole page scrolling via cn-keyboard-active')
    assert.ok(jsxContent.includes('cn-keyboard-active'), 'CodenamesBoard must manage cn-keyboard-active class for full-page scrolling')
    assert.ok(!jsxContent.includes("vv.addEventListener('scroll'"), 'CodenamesBoard must not listen to visualViewport scroll to avoid hijacking touch scrolling')
  })

  it('Pressing Enter on clue input opens the number picker (0 to ∞) and dismisses keyboard', () => {
    const jsxContent = fs.readFileSync(path.resolve('src/games/codenames/components/CodenamesBoard.jsx'), 'utf-8')
    assert.ok(jsxContent.includes("e.key === 'Enter'"), 'Clue input must have onKeyDown listener for Enter key')
    assert.ok(jsxContent.includes('setShowNumberPicker(true)'), 'Enter key must trigger setShowNumberPicker(true)')
    assert.ok(jsxContent.includes('e.currentTarget.blur()'), 'Enter key must blur input to dismiss virtual keyboard')
  })

  it('ResetConfirmModal exists and matches tactical theme styling', () => {
    const sharedContent = fs.readFileSync(path.resolve('src/games/codenames/components/CodenamesShared.jsx'), 'utf-8')
    const cssContent = fs.readFileSync(path.resolve('src/games/codenames/styles/codenames.css'), 'utf-8')
    const jsxContent = fs.readFileSync(path.resolve('src/games/codenames/components/CodenamesBoard.jsx'), 'utf-8')

    assert.ok(sharedContent.includes('export function ResetConfirmModal'), 'ResetConfirmModal must be exported')
    assert.ok(cssContent.includes('.cn-reset-modal'), 'CSS must style .cn-reset-modal')
    assert.ok(cssContent.includes('.cn-reset-header-icon-wrap'), 'CSS must style restart icon wrap')
    assert.ok(cssContent.includes('.cn-reset-btn-confirm'), 'CSS must style confirm reset button')
    assert.ok(jsxContent.includes('<ResetConfirmModal'), 'CodenamesBoard must render ResetConfirmModal')
    assert.ok(jsxContent.includes('showResetModal'), 'CodenamesBoard must control showResetModal state')
  })

  it('TopBar component renders restart button when onRestart is provided', () => {
    const sharedContent = fs.readFileSync(path.resolve('src/games/codenames/components/CodenamesShared.jsx'), 'utf-8')
    assert.ok(sharedContent.includes('onRestart'), 'TopBar must accept onRestart prop')
    assert.ok(sharedContent.includes('restart-btn'), 'TopBar must render restart-btn')
    assert.ok(sharedContent.includes("type === 'restart'"), 'Icon must support restart icon')
  })

  it('CodenamesBoard component integrates the new layouts, table reset, and removes duplicate banners', () => {
    const jsxContent = fs.readFileSync(path.resolve('src/games/codenames/components/CodenamesBoard.jsx'), 'utf-8')
    assert.ok(jsxContent.includes('cn-log-clue-banner'), 'Board must render clue banner in log')
    assert.ok(jsxContent.includes('cn-log-guess-badge'), 'Board must render guess badge')
    assert.ok(jsxContent.includes('cn-log-guess-avatar-group'), 'Board must render guess avatar group')
    assert.ok(jsxContent.includes('cn-log-guess-word-pill'), 'Board must render guess word pill')
    assert.ok(jsxContent.includes('blueScoreCardImage'), 'Board must use random card image for blue score')
    assert.ok(jsxContent.includes('redScoreCardImage'), 'Board must use random card image for red score')
    assert.ok(jsxContent.includes('onRestart={handleTableReset}'), 'Board must pass onRestart to TopBar')
    assert.ok(jsxContent.includes("socket.emit('codenames:table-reset'"), 'Board must emit codenames:table-reset')
    assert.ok(!jsxContent.includes('MATCH CONCLUDED &bull;'), 'Redundant match concluded banner must be removed')
    assert.ok(!jsxContent.includes('WAITING FOR <strong'), 'Redundant waiting for turn banner must be removed')
  })
})
