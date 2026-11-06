import React, { useState, useEffect, useRef, useMemo } from 'react'
import { connectSocket } from '../../../shared/realtime/socket.js'
import CodenamesCard from './CodenamesCard.jsx'
import { Icon, TopBar, SettingsModal, PlayersModal, RulesModal, ResetConfirmModal } from './CodenamesShared.jsx'
import { getPlayerAvatarUrl } from '../utils/cardTiles.js'



const CLUE_ERRORS = {
  EMPTY_CLUE: 'Enter a clue.',
  INVALID_CLUE: 'One word only, up to 25 characters.',
  CLUE_MATCHES_BOARD_WORD: "A clue can't be a word on the board.",
  INVALID_NUMBER: 'Pick a number from 1 to 9 or ∞.',
  NOT_YOUR_TURN: "It's not your team's turn.",
  INVALID_PHASE: 'A clue was already given.'
}

const NUMBER_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, '∞']

// Extra clearance buffer so the clue input row and circular buttons sit completely
// above the Safari Form Accessory Bar (^ v Done) and predictive rows with clean breathing room
const KEYBOARD_CLEARANCE_BUFFER = 54

function getIphoneKeyboardHeight() {
  if (typeof window === 'undefined') return 336
  if (window.visualViewport) {
    const vvDiff = window.innerHeight - window.visualViewport.height
    if (vvDiff > 100) return Math.round(vvDiff)
  }
  const w = window.innerWidth || (typeof screen !== 'undefined' ? screen.width : 390)
  const h = window.innerHeight || (typeof screen !== 'undefined' ? screen.height : 844)
  const maxDim = Math.max(w, h)
  const minDim = Math.min(w, h)

  if (minDim >= 414 && maxDim >= 890) {
    return 346 // iPhone Pro Max / Plus default with QuickType predictive row
  }
  if (maxDim <= 680) {
    return 260 // iPhone SE / 8 default with QuickType predictive row
  }
  return 336 // Standard iPhone 12/13/14/15/16 default with QuickType predictive row
}

export default function CodenamesBoard({ room, playerId, onLeave }) {
  const [clueWord, setClueWord] = useState('')
  const [clueNum, setClueNum] = useState(null)
  const [showNumberPicker, setShowNumberPicker] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clueError, setClueError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [keyboardSpace, setKeyboardSpace] = useState(0)
  const [selectedCardIndex, setSelectedCardIndex] = useState(null)
  const [flippingIndices, setFlippingIndices] = useState(new Set())

  const restingSpaceBelowRef = useRef(0)

  const myPlayer = room.players.find(p => p.id === playerId)
  const board = room.board
  const revealedSetRef = useRef(new Set())
  const isInitializedRef = useRef(false)
  const logContainerRef = useRef(null)

  // Stable random card images for remaining word count card thumbnails
  const blueScoreCardImage = useMemo(() => {
    const variants = ['a', 'b', 'c', 'd', 'e']
    const seed = String(room?.id || 'room-blue').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const variant = variants[seed % variants.length]
    return `/images/characters/codenames/tile-${variant}2.webp`
  }, [room?.id])

  const redScoreCardImage = useMemo(() => {
    const variants = ['a', 'b', 'c', 'd', 'e']
    const seed = String(room?.id || 'room-red').split('').reduce((acc, c) => acc + c.charCodeAt(0), 7)
    const variant = variants[seed % variants.length]
    return `/images/characters/codenames/tile-${variant}1.webp`
  }, [room?.id])

  // Auto-scroll chat box / game log to latest transmission
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [room.turnHistory])

  // Preload all 20 character tile WebP images for zero-latency 3D flips without blank flashes
  useEffect(() => {
    const variants = ['a', 'b', 'c', 'd', 'e']
    const codes = [1, 2, 3, 4]
    variants.forEach(v => {
      codes.forEach(c => {
        const img = new Image()
        img.src = `/images/characters/codenames/tile-${v}${c}.webp`
      })
    })
  }, [])

  useEffect(() => {
    setSelectedCardIndex(null)
    setShowNumberPicker(false)
    setClueWord('')
    setClueNum(null)
    if (room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'LOBBY') {
      revealedSetRef.current.clear()
      setFlippingIndices(new Set())
      isInitializedRef.current = false
    }
  }, [room.phase, room.currentTeam, room.status])

  useEffect(() => {
    if (!board || board.length === 0) return

    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      board.forEach((card, i) => {
        if (card.revealed) revealedSetRef.current.add(i)
      })
      return
    }

    const newlyRevealed = []
    board.forEach((card, i) => {
      if (card.revealed && !revealedSetRef.current.has(i)) {
        revealedSetRef.current.add(i)
        newlyRevealed.push(i)
      }
    })

    if (newlyRevealed.length > 0) {
      setFlippingIndices(prev => {
        const next = new Set(prev)
        newlyRevealed.forEach(i => next.add(i))
        return next
      })
      const timer = setTimeout(() => {
        setFlippingIndices(prev => {
          const next = new Set(prev)
          newlyRevealed.forEach(i => next.delete(i))
          return next
        })
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [board])

  // Handle mobile keyboard spacing so the page only extends by the exact difference
  // between the full iPhone keyboard height (including predictive suggestion row)
  // and the space naturally present below the input row to the end of the page.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const vv = window.visualViewport
    const appEl = document.querySelector('.codenames-app--game')

    const measureRestingSpace = () => {
      const clueRow = document.querySelector('.cn-action-control-wrap--bottom')
      const rect = clueRow?.getBoundingClientRect()
      if (!rect) return 0
      const currentScrollY = window.scrollY || 0
      const restingBottom = rect.bottom + currentScrollY
      const viewportBottom = window.innerHeight + currentScrollY
      return Math.max(0, viewportBottom - restingBottom)
    }

    const syncKeyboardSpace = () => {
      if (!isInputFocused) {
        setKeyboardSpace(0)
        restingSpaceBelowRef.current = 0
        appEl?.classList.remove('has-keyboard-open')
        document.body.classList.remove('cn-keyboard-active')
        document.documentElement.classList.remove('cn-keyboard-active')
        return
      }

      if (!restingSpaceBelowRef.current) {
        restingSpaceBelowRef.current = measureRestingSpace()
      }

      const kbHeight = getIphoneKeyboardHeight()
      const difference = Math.max(0, Math.round(kbHeight - restingSpaceBelowRef.current + KEYBOARD_CLEARANCE_BUFFER))
      
      setKeyboardSpace(prev => (Math.abs(prev - difference) > 4 ? difference : prev))

      if (difference > 0) {
        appEl?.classList.add('has-keyboard-open')
        document.body.classList.add('cn-keyboard-active')
        document.documentElement.classList.add('cn-keyboard-active')
      } else {
        appEl?.classList.remove('has-keyboard-open')
        document.body.classList.remove('cn-keyboard-active')
        document.documentElement.classList.remove('cn-keyboard-active')
      }
    }

    if (isInputFocused) {
      syncKeyboardSpace()
      // Only listen to resize (virtual keyboard size change) — NEVER listen to scroll
      // so user touch scrolling can move freely without triggering state updates or hijacking scroll
      if (vv) {
        vv.addEventListener('resize', syncKeyboardSpace)
      }
      return () => {
        if (vv) {
          vv.removeEventListener('resize', syncKeyboardSpace)
        }
        document.body.classList.remove('cn-keyboard-active')
        document.documentElement.classList.remove('cn-keyboard-active')
      }
    } else {
      setKeyboardSpace(0)
      restingSpaceBelowRef.current = 0
      appEl?.classList.remove('has-keyboard-open')
      document.body.classList.remove('cn-keyboard-active')
      document.documentElement.classList.remove('cn-keyboard-active')
      if (window.scrollY !== 0) {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }, [isInputFocused])

  const handleJoinTeam = (team, role) => {
    connectSocket(playerId).emit('codenames:join-team-role', { team, role }, (res) => {
      if (res?.error) alert(res.error === 'SPYMASTER_SLOT_TAKEN' ? 'This Spymaster slot is already taken.' : res.error)
    })
  }

  const handleClueSubmit = (e) => {
    e?.preventDefault?.()
    if (!clueWord.trim() || isSubmitting) return
    if (clueNum === null || clueNum === '-') {
      setShowNumberPicker(true)
      setClueError('')
      if (typeof document !== 'undefined' && document.activeElement && document.activeElement.blur) {
        document.activeElement.blur()
      }
      return
    }
    setClueError('')
    setIsSubmitting(true)
    setShowNumberPicker(false)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:give-clue', { clue: clueWord.trim(), number: clueNum }, (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      if (res?.success) { setClueWord(''); setClueNum(null); setShowNumberPicker(false); }
      else setClueError(CLUE_ERRORS[res?.error] || 'Could not send the clue.')
    })
  }

  let blueScore = '-'
  let redScore = '-'
  if (board) {
    const canSeeHidden = board.some(c => c.category && !c.revealed)
    if (canSeeHidden) {
      blueScore = board.filter(c => c.category === 'blue' && !c.revealed).length
      redScore = board.filter(c => c.category === 'red' && !c.revealed).length
    } else if (room.startingTeam) {
      const totalBlue = room.startingTeam === 'blue' ? 9 : 8
      const totalRed = room.startingTeam === 'red' ? 9 : 8
      const revealedBlue = board.filter(c => c.revealed && c.category === 'blue').length
      const revealedRed = board.filter(c => c.revealed && c.category === 'red').length
      blueScore = totalBlue - revealedBlue
      redScore = totalRed - revealedRed
    }
  }

  const isWaiting = room.status === 'WAITING_FOR_PLAYERS' || room.phase === 'WAITING_FOR_PLAYERS'
  const roleNeeded = (t) => !room.players.some(p => p.team === t && p.role === 'SPYMASTER') ? `${t.toUpperCase()} TEAM NEEDS A SPYMASTER` : !room.players.some(p => p.team === t && p.role === 'OPERATIVE') ? `${t.toUpperCase()} TEAM NEEDS AN OPERATIVE` : null
  const needMsg = room.status === 'FINISHED' ? null : (roleNeeded('red') || roleNeeded('blue'))
  const clueStage = (room.phase === 'BOARD_READY' || room.phase === 'CLUE_PHASE') && !isWaiting
  const isActive = (team, kind) => room.status === 'PLAYING' && !isWaiting && team === room.currentTeam && kind === (clueStage ? 'spy' : 'ops')
  const canSeeBoardColors = myPlayer?.role === 'SPYMASTER'
  const isMyClueTurn = room.status === 'PLAYING' && !isWaiting && canSeeBoardColors && myPlayer?.team === room.currentTeam && clueStage && !needMsg
  const isMyGuessTurn = room.status === 'PLAYING' && !isWaiting && myPlayer?.role === 'OPERATIVE' && myPlayer?.team === room.currentTeam && room.phase === 'GUESS_PHASE' && !needMsg

  const handleCardClick = (index) => {
    if (!isMyGuessTurn || isSubmitting) return
    const card = board?.[index]
    if (!card || card.revealed) return
    setClueError('')
    const nextIdx = selectedCardIndex === index ? null : index
    setSelectedCardIndex(nextIdx)
    const socket = connectSocket(playerId)
    socket.emit('codenames:select-card', { cardIndex: nextIdx })
  }

  const handleConfirmGuess = (index = selectedCardIndex) => {
    if (!isMyGuessTurn || isSubmitting || index === null) return
    const card = board?.[index]
    if (!card || card.revealed) return
    setClueError('')
    setIsSubmitting(true)
    const targetIdx = index
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:reveal-card', { cardIndex: targetIdx }, (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      setSelectedCardIndex(null)
      if (res?.error) {
        setClueError(res.error === 'CARD_ALREADY_REVEALED' ? 'That card has already been revealed.' : res.error)
      }
    })
  }

  const handleCancelSelection = () => {
    setSelectedCardIndex(null)
    const socket = connectSocket(playerId)
    socket.emit('codenames:select-card', { cardIndex: null })
  }

  const handleEndTurn = () => {
    if (!isMyGuessTurn || isSubmitting) return
    setClueError('')
    setIsSubmitting(true)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:end-turn', (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      setSelectedCardIndex(null)
      if (res?.error) setClueError(res.error)
    })
  }

  const handleTableReset = () => {
    if (isSubmitting) return
    setShowResetModal(true)
  }

  const handleConfirmReset = () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:table-reset', (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      setShowResetModal(false)
      if (res?.error) alert(res.error)
    })
  }

  const handlePlayAgain = () => {
    if (isSubmitting) return
    setIsSubmitting(true)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:table-reset', (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      if (res?.error) alert(res.error)
    })
  }

  const guessesLeftDisplay = room.currentClue?.number === '∞' ? '∞' : (room.guessesLeft ?? 0)
  let statusMessage = 'GAME STARTED'
  if (room.status === 'FINISHED') {
    if (room.winner) {
      const isRed = room.winner === 'red'
      const reasonText = room.endReason === 'ASSASSIN'
        ? ` (${isRed ? 'BLUE' : 'RED'} REVEALED THE ASSASSIN)`
        : ' (ALL AGENTS FOUND)'
      statusMessage = `🏆 ${room.winner.toUpperCase()} TEAM WINS!${reasonText}`
    } else {
      statusMessage = 'GAME OVER'
    }
  } else if (needMsg) {
    statusMessage = needMsg
  } else if (isWaiting) {
    statusMessage = 'ROOM STARTED — WAITING FOR PLAYERS'
  } else if (isMyClueTurn) {
    statusMessage = 'GIVE YOUR OPERATIVES A CLUE'
  } else if (isMyGuessTurn) {
    statusMessage = `SELECT A CARD TO REVEAL (${guessesLeftDisplay} LEFT)`
  } else if (room.phase === 'GUESS_PHASE' && room.currentClue) {
    statusMessage = `${room.currentTeam.toUpperCase()} GUESSING: ${room.currentClue.word} ${room.currentClue.number} (${guessesLeftDisplay} LEFT)`
  } else if (room.currentTeam) {
    statusMessage = `${room.currentTeam.toUpperCase()} SPYMASTER IS THINKING...`
  }

  const renderAvatar = (p) => (
    <div key={p.id} className="cn-board-avatar">
      {p.id === room.hostId && <div className="cn-board-crown">👑</div>}
      <img src={getPlayerAvatarUrl(p)} alt="avatar" />
      <div className="cn-board-avatar-name">{p.name.substring(0, 5)}</div>
    </div>
  )

  const renderSlot = (team, role) => {
    const members = room.players.filter(p => p.team === team && p.role === role)
    const isMine = myPlayer?.team === team && myPlayer?.role === role

    // Mid-game joining & switching rules:
    // 1. Cannot join the exact slot you are already in
    // 2. Spectators / unassigned players: can join ANY slot (Red/Blue Operative or Spymaster)
    // 3. Operatives: can switch between Red and Blue Operatives (Red Operative <-> Blue Operative)
    // 4. Spymasters: can switch between Red and Blue Spymasters (Red Spymaster <-> Blue Spymaster)
    let canJoin = false
    if (!isMine) {
      if (!myPlayer?.role) {
        canJoin = true
      } else if (myPlayer.role === 'OPERATIVE' && role === 'OPERATIVE') {
        canJoin = true
      } else if (myPlayer.role === 'SPYMASTER' && role === 'SPYMASTER') {
        canJoin = true
      }
    }

    return (
      <div className="cn-panel-content cn-panel-content--join">
        <div className="cn-panel-avatars">{members.map(renderAvatar)}</div>
        {canJoin && (
          <button className="cn-spy-join-btn" onClick={() => handleJoinTeam(team, role)}>
            <span>JOIN TEAM</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`cn-game-page ${keyboardSpace > 0 ? 'has-keyboard-open' : ''} ${isInputFocused ? 'is-clue-focused' : ''}`}>
      <TopBar
        count={room.players.length}
        onPlayers={() => setShowPlayers(true)}
        onSettings={() => setShowSettings(true)}
        onRestart={handleTableReset}
      />













      <div className="cn-game-main">
        {/* 1. GAME-INFO ROW (Blue Team, Game Log, Red Team) */}
        <div className="cn-game-info-row">
          <div className="cn-team-col blue-col">
            <div className={`cn-top-panel blue-panel${isActive('blue','ops') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">OPERATIVES</div>
              {renderSlot('blue','OPERATIVE')}
            </div>
            <div className="cn-score-section blue-score">
              <div className="cn-score-number">{blueScore}</div>
              <div className="cn-score-thumb" aria-hidden="true">
                <img src={blueScoreCardImage} alt="Blue card" />
              </div>
            </div>
            <div className={`cn-bottom-panel blue-spy${isActive('blue','spy') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">SPYMASTERS</div>
              {renderSlot('blue','SPYMASTER')}
            </div>
          </div>

          <div className="cn-game-log-col">
            <div className="cn-game-log">
              <div className="cn-log-header">
                <div className="cn-log-header-title-wrap">
                  <span className="cn-log-header-pulse" />
                  <span className="cn-log-header-title">GAME LOG</span>
                </div>
                <span className="cn-log-count-pill">{room.turnHistory?.length || 0}</span>
              </div>
              <div className="cn-log-content" ref={logContainerRef}>
                {(!room.turnHistory || room.turnHistory.length === 0) ? (
                  <div className="cn-log-empty">
                    <span className="cn-log-empty-radar" />
                    <span>AWAITING FIRST CLUE</span>
                  </div>
                ) : (
                  room.turnHistory.map(turn => {
                    const spymaster = turn.spymaster || room.players?.find(p => p.team === turn.team && p.role === 'SPYMASTER')
                    const spymasterName = spymaster?.name || (turn.team === 'red' ? 'Red Spymaster' : 'Blue Spymaster')
                    return (
                      <div key={turn.id} className={`cn-log-item cn-log-item--${turn.team}`}>
                        <div className={`cn-log-clue-banner cn-log-clue-banner--${turn.team}`}>
                          <div className="cn-log-spymaster-avatar-wrap">
                            <div className="cn-log-spymaster-avatar-disc">
                              <img src={getPlayerAvatarUrl(spymaster)} alt={spymasterName} />
                            </div>
                            <div className={`cn-log-spymaster-name-badge cn-log-spymaster-name-badge--${turn.team}`}>
                              {spymasterName.length > 7 ? `${spymasterName.substring(0, 6)}…` : spymasterName}
                            </div>
                          </div>
                          <div className="cn-log-clue-pill">
                            {turn.clue?.word}
                          </div>
                          <div className="cn-log-clue-badge">
                            {turn.clue?.number}
                          </div>
                        </div>
                        {turn.guesses && turn.guesses.length > 0 && (
                          <div className="cn-log-guesses">
                            {turn.guesses.map((g, gi) => {
                              const guesser = g.guesser || (g.guesserId ? room.players?.find(p => p.id === g.guesserId) : null) || (g.playerId ? room.players?.find(p => p.id === g.playerId) : null)
                              const guesserName = guesser?.name || g.guessedBy || (turn.team === 'red' ? 'Red Operative' : 'Blue Operative')
                              const guesserTeam = guesser?.team || turn.team
                              return (
                                <div key={gi} className="cn-log-guess-badge">
                                  <div className="cn-log-guess-avatar-group">
                                    <div className="cn-log-guess-avatar-disc">
                                      <img src={getPlayerAvatarUrl(guesser)} alt={guesserName} />
                                    </div>
                                    <div className={`cn-log-guess-avatar-name cn-log-guess-avatar-name--${guesserTeam}`}>
                                      {guesserName.length > 6 ? `${guesserName.substring(0, 5)}…` : guesserName}
                                    </div>
                                  </div>
                                  <div className={`cn-log-guess-word-pill cn-log-guess-word-pill--${g.category}`}>
                                    <span className="cn-chip-symbol">
                                      {g.category === 'assassin' ? '💀' : g.category === turn.team ? '✓' : '•'}
                                    </span>
                                    <span className="cn-chip-word">{g.word}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div className="cn-team-col red-col">
            <div className={`cn-top-panel red-panel${isActive('red','ops') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">OPERATIVES</div>
              {renderSlot('red','OPERATIVE')}
            </div>
            <div className="cn-score-section red-score">
              <div className="cn-score-number">{redScore}</div>
              <div className="cn-score-thumb" aria-hidden="true">
                <img src={redScoreCardImage} alt="Red card" />
              </div>
            </div>
            <div className={`cn-bottom-panel red-spy${isActive('red','spy') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">SPYMASTERS</div>
              {renderSlot('red','SPYMASTER')}
            </div>
          </div>
        </div>

        {/* 2. DEV CONTROLS ROW (Only during waiting lobby in dev mode) */}
        {isWaiting && import.meta.env.DEV && myPlayer?.id === room.hostId && (
          <div className="cn-action-control-wrap">
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', width: '100%' }}>
              <button
                type="button"
                className="cn-confirm-btn"
                style={{ background: '#2563eb', maxWidth: '320px' }}
                onClick={() => connectSocket(playerId).emit('codenames:dev-add-bots', { count: 3 })}
              >
                🤖 DEV: FILL WITH BOTS & PLAY
              </button>
            </div>
          </div>
        )}

        {/* 3. STATUS ROW (Turn text & ? rules button) */}
        <div className={`cn-status-row ${room.status === 'FINISHED' ? `cn-status-row--finished cn-status-row--${room.winner || 'neutral'}` : ''}`}>
          <div className="cn-status-text">{statusMessage}</div>
          <button className="cn-help-btn" aria-label="How to play" onClick={() => setShowRules(true)}><span>?</span></button>
        </div>

        {/* 4. MAIN WORD BOARD (5x5 grid) */}
        <div className="cn-board-grid">
          {board.map((card, index) => {
            const targeters = room.players.filter(p => (room.targetedCards?.[p.id] === index) || (p.id === playerId && selectedCardIndex === index))
            const isMyTarget = isMyGuessTurn && selectedCardIndex === index
            return (
              <CodenamesCard
                key={card.id || index}
                card={card}
                isSpymaster={canSeeBoardColors}
                isClickable={isMyGuessTurn && !card.revealed && !isSubmitting}
                isSelected={isMyTarget}
                isFlipping={flippingIndices.has(index)}
                targeters={targeters}
                showPickHand={isMyTarget}
                onPick={() => handleConfirmGuess(index)}
                onClick={() => handleCardClick(index)}
              />
            )
          })}
        </div>

        {/* 5. GIVE CLUE ROW / BOTTOM GUESS CLUE BAR (At bottom of main word grid) */}
        {isMyClueTurn ? (
          <>
            <div className="cn-action-control-wrap cn-action-control-wrap--bottom">
              {clueError && <div className="cn-clue-error" role="alert">{clueError}</div>}
              <form className="cn-clue-control" onSubmit={handleClueSubmit}>
                {showNumberPicker && (
                  <>
                    <div className="cn-picker-backdrop" onClick={() => setShowNumberPicker(false)} />
                    <div className="cn-number-picker-row" role="dialog" aria-label="Select clue number">
                      {NUMBER_OPTIONS.map(opt => (
                        <button
                          key={opt}
                          type="button"
                          className={`cn-num-frame ${clueNum === opt ? 'is-selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setClueNum(opt)
                            setShowNumberPicker(false)
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <input
                  type="text"
                  className="cn-clue-input"
                  placeholder="YOUR CLUE"
                  value={clueWord}
                  onChange={e => { setClueWord(e.target.value.toUpperCase()); setClueError(''); }}
                  onFocus={() => {
                    setIsInputFocused(true)
                    if (typeof window !== 'undefined') {
                      const clueRow = document.querySelector('.cn-action-control-wrap--bottom')
                      const rect = clueRow?.getBoundingClientRect()
                      if (rect) {
                        const spaceBelow = Math.max(0, window.innerHeight - rect.bottom)
                        restingSpaceBelowRef.current = spaceBelow
                        const kbHeight = getIphoneKeyboardHeight()
                        const diff = Math.max(0, Math.round(kbHeight - spaceBelow + KEYBOARD_CLEARANCE_BUFFER))
                        setKeyboardSpace(diff)
                        if (diff > 0) {
                          document.querySelector('.codenames-app--game')?.classList.add('has-keyboard-open')
                          document.body.classList.add('cn-keyboard-active')
                          document.documentElement.classList.add('cn-keyboard-active')
                        }
                      }
                    }
                  }}
                  onBlur={() => {
                    setIsInputFocused(false)
                    restingSpaceBelowRef.current = 0
                    document.body.classList.remove('cn-keyboard-active')
                    document.documentElement.classList.remove('cn-keyboard-active')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (clueWord.trim()) {
                        setShowNumberPicker(true)
                        setClueError('')
                        e.currentTarget.blur()
                      } else {
                        setClueError('Enter a clue.')
                      }
                    }
                  }}
                  disabled={isSubmitting}
                  maxLength={25}
                />
                <button
                  type="button"
                  className={`cn-clue-dec ${showNumberPicker ? 'is-active' : ''}`}
                  onClick={() => setShowNumberPicker(prev => !prev)}
                  aria-label={clueNum !== null && clueNum !== undefined ? `Clue number ${clueNum}, tap to change` : 'Select clue number, currently unset'}
                  aria-expanded={showNumberPicker}
                  disabled={isSubmitting}
                >
                  <span className="cn-dec-symbol">{clueNum !== null && clueNum !== undefined ? clueNum : '-'}</span>
                </button>
                <button
                  type="submit"
                  className="cn-clue-submit"
                  disabled={!clueWord.trim() || clueNum === null || clueNum === '-' || isSubmitting}
                >
                  <Icon type="up" size={24} />
                </button>
              </form>
            </div>
            {keyboardSpace > 0 && (
              <div
                className="cn-keyboard-spacer"
                style={{ height: `${keyboardSpace}px` }}
                aria-hidden="true"
              />
            )}
          </>
        ) : (room.phase === 'GUESS_PHASE' && room.currentClue) ? (
          <div className="cn-bottom-guess-clue-bar">
            {clueError && <div className="cn-clue-error" role="alert">{clueError}</div>}
            <div className="cn-bottom-guess-clue-pill">
              {room.currentClue.word}
            </div>
            <div className={`cn-bottom-guess-clue-num cn-bottom-guess-clue-num--${room.currentTeam}`}>
              {room.currentClue.number}
            </div>
            {isMyGuessTurn && (
              <div className="cn-bottom-guess-actions">
                {selectedCardIndex !== null ? (
                  <>
                    <button
                      type="button"
                      className="cn-confirm-btn cn-confirm-btn--compact"
                      onClick={() => handleConfirmGuess(selectedCardIndex)}
                      disabled={isSubmitting}
                    >
                      CONFIRM: {board?.[selectedCardIndex]?.word}
                    </button>
                    <button
                      type="button"
                      className="cn-cancel-btn cn-cancel-btn--compact"
                      onClick={handleCancelSelection}
                      disabled={isSubmitting}
                    >
                      CANCEL
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="cn-end-turn-btn cn-end-turn-btn--compact"
                    onClick={handleEndTurn}
                    disabled={isSubmitting}
                  >
                    END GUESSING
                  </button>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* 6. BOTTOM ACTION BAR (At bottom of main word grid) */}
        {room.status === 'FINISHED' && (
          <div className="cn-bottom-action-bar">
            {myPlayer?.id === room.hostId ? (
              <button
                type="button"
                className="cn-play-again-bottom-btn"
                onClick={handlePlayAgain}
                disabled={isSubmitting}
              >
                PLAY AGAIN
              </button>
            ) : (
              <div className="cn-finished-waiting-badge">
                WAITING FOR HOST TO START NEXT GAME...
              </div>
            )}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          room={room}
          playerId={playerId}
          onClose={() => setShowSettings(false)}
          onLeave={onLeave}
        />
      )}
      {showPlayers && <PlayersModal room={room} playerId={playerId} onClose={() => setShowPlayers(false)} />}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {showResetModal && (
        <ResetConfirmModal
          isOpen={showResetModal}
          onConfirm={handleConfirmReset}
          onCancel={() => setShowResetModal(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  )
}
