import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import Button from '../components/Button.jsx'
import { emitSubmitClue, emitSendChat, emitSelectVote, emitLockVote } from './gameState.js'
import { getRoleImage, getRoleImageAlt } from './roleImages.js'
import { MAX_CLUE_LENGTH, MAX_CHAT_LENGTH } from '../../shared/game-limits.js'

const ERROR_MESSAGES = {
  NOT_YOUR_TURN: 'It is not your turn.',
  CLUE_ALREADY_SUBMITTED: 'You have already submitted your clue.',
  EMPTY_CLUE: 'Enter a clue first.',
  CLUE_TOO_LONG: 'Your clue is too long.',
  PLAYER_NOT_FOUND: 'Connection issue — try refreshing.',
  ROOM_NOT_FOUND: 'Room not found.',
  CLUE_PHASE_NOT_ACTIVE: 'Clue phase is not active.',
  NOT_ACTIVE_PLAYER: 'You are not an active player.',
  EMPTY_MESSAGE: 'Enter a message first.',
  MESSAGE_TOO_LONG: 'Message is too long.',
  GAME_NOT_ACTIVE: 'Game is not active.',
}

function LocalRoleSection({ localSecret, revealRoles, gamePhase }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const role = localSecret?.role
  const word = localSecret?.word
  const roleVisible = revealRoles === true && role != null
  const roleLabel = roleVisible ? role.replace('_', ' ') : '???'
  const wordVisible = gamePhase === 'CLUE' || gamePhase === 'VOTE'

  return (
    <div className={`clue-panel__identity${roleVisible ? ` clue-panel__identity--${role.toLowerCase()}` : ''} ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      
      <div 
        className="clue-panel__identity-toggle"
        onClick={() => !isExpanded && setIsExpanded(true)}
        role="button"
        tabIndex={0}
      >
        <span>🔒</span> SHOW ROLE &amp; SECRET WORD <span className="chevron">›</span>
      </div>

      <div className="clue-panel__identity-content">
        <span className="online-kicker">Classified</span>
        {roleVisible ? (
          <div className="clue-panel__avatar">
            <img src={getRoleImage(role)} alt={getRoleImageAlt(role)} className="clue-panel__avatar-img" />
          </div>
        ) : null}
        <h2 className="clue-panel__role-name">{roleLabel}</h2>
        {wordVisible && (
          <div className="clue-panel__secret">
            <span className="clue-panel__word-label">Your Secret Word</span>
            {word ? (
              <div className="clue-panel__word-box">{word}</div>
            ) : (
              <p className="clue-panel__no-word">No word assigned. Listen carefully to every clue.</p>
            )}
          </div>
        )}
        <div className="clue-panel__identity-actions">
          <Button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}>HIDE</Button>
        </div>
      </div>
    </div>
  )
}

function TurnIndicator({ currentTurnPlayerId, myPlayerId, players, gamePhase }) {
  const isMyTurn = currentTurnPlayerId === myPlayerId
  const currentPlayer = players.find((p) => p.id === currentTurnPlayerId)
  const playerName = currentPlayer?.name || 'Unknown'

  if (gamePhase === 'VOTE') {
    return (
      <div className="clue-panel__turn clue-panel__turn--vote">
        <span className="online-kicker">Voting Phase</span>
        <h2>Select your suspect</h2>
        <p>Discuss and cast your vote.</p>
      </div>
    )
  }

  if (isMyTurn) {
    return (
      <div className="clue-panel__turn clue-panel__turn--active">
        <span className="online-kicker">Your turn</span>
        <h2>Your turn</h2>
        <p>Give one clue related to your word.</p>
      </div>
    )
  }

  return (
    <div className="clue-panel__turn clue-panel__turn--waiting">
      <span className="online-kicker">Waiting</span>
      <h2>Waiting for {playerName}</h2>
      <p>Their clue will appear shortly.</p>
    </div>
  )
}

function ClueInput({ isMyTurn, gamePhase, submitting, onSubmit }) {
  const [text, setText] = useState('')
  const inputRef = useRef(null)
  const charCount = text.length
  const overLimit = charCount > MAX_CLUE_LENGTH
  const canSubmit = isMyTurn && gamePhase === 'CLUE' && !submitting && !overLimit

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }, [canSubmit, text, onSubmit])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  useEffect(() => {
    if (isMyTurn && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isMyTurn])

  return (
    <div className={`clue-panel__input ${isMyTurn ? 'clue-panel__input--active' : ''}`}>
      <label className="clue-panel__input-label">Clue</label>
      <div className="clue-panel__input-row">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={canSubmit ? 'Type your clue here...' : 'Waiting...'}
          maxLength={MAX_CLUE_LENGTH + 10}
          disabled={!canSubmit}
          className="clue-panel__text-input"
          autoComplete="off"
          spellCheck="false"
        />
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="clue-panel__submit-btn"
        >
          {submitting ? 'Sending...' : 'Give Clue'}
        </Button>
      </div>
      <div className="clue-panel__input-meta">
        <span className="clue-panel__input-hint">
          {overLimit
            ? 'Max clue length is 120 characters'
            : canSubmit ? 'Press Enter to submit' : 'Only the active player can submit a clue'}
        </span>
        <span className={`clue-panel__char-count ${overLimit ? 'clue-panel__char-count--over' : ''}`}>
          {charCount} / {MAX_CLUE_LENGTH}
        </span>
      </div>
    </div>
  )
}

function ClueOrderDisplay({ turnOrder, currentTurnPlayerId, submittedCluePlayerIds, players, myPlayerId, currentRound }) {
  const renderItem = (playerId, index) => {
    const player = players.find((p) => p.id === playerId)
    const playerName = player?.name || 'Unknown'
    const isCurrent = playerId === currentTurnPlayerId
    const isCompleted = submittedCluePlayerIds.includes(playerId)
    const isMe = playerId === myPlayerId

    let statusClass = 'clue-panel__order-item--upcoming'
    let statusLabel = 'Upcoming'
    if (isCompleted) {
      statusClass = 'clue-panel__order-item--completed'
      statusLabel = 'Completed'
    } else if (isCurrent) {
      statusClass = 'clue-panel__order-item--current'
      statusLabel = isMe ? '→ Your Turn' : '→ Current'
    }

    return (
      <div key={playerId} className={`clue-panel__order-item ${statusClass}`}>
        <span className="clue-panel__order-position">{String(index + 1).padStart(2, '0')}</span>
        <span className="clue-panel__order-avatar">{getInitials(playerName)}</span>
        <span className="clue-panel__order-name">{playerName}</span>
        <span className="clue-panel__order-status">{isCompleted ? `✓ ${statusLabel}` : statusLabel}</span>
      </div>
    )
  }

  return (
    <div className="clue-panel__order">
      <div className="clue-panel__order-header">
        <span className="clue-panel__order-title">Clue Order</span>
        <span className="clue-panel__round-badge">Round {String(currentRound).padStart(2, '0')}</span>
      </div>
      <div className="clue-panel__order-list">
        {turnOrder.length === 0 ? (
          <p className="clue-panel__order-empty">No turn order established yet.</p>
        ) : (
          turnOrder.map(renderItem)
        )}
      </div>
    </div>
  )
}

function ClueFeed({ clues, myPlayerId, currentRound }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [clues.length])

  // Group clues by roundNumber
  const cluesByRound = {}
  clues.forEach((clue) => {
    const round = clue.roundNumber || currentRound
    if (!cluesByRound[round]) cluesByRound[round] = []
    cluesByRound[round].push(clue)
  })

  const rounds = Object.keys(cluesByRound).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="comm-panel__scroll" ref={containerRef}>
      {rounds.length === 0 ? (
        <>
          <h2 className="round-heading">Round {String(currentRound).padStart(2, '0')}</h2>
          <p className="comm-panel__empty">No clues yet. The first player will begin shortly.</p>
        </>
      ) : (
        rounds.map((roundStr) => (
          <Fragment key={`round-${roundStr}`}>
            <h2 className="round-heading">Round {String(roundStr).padStart(2, '0')}</h2>
            {cluesByRound[roundStr].map((clue) => (
              <div key={clue.id} className={`comm-panel__entry comm-panel__entry--message ${clue.playerId === myPlayerId ? 'comm-panel__entry--self' : ''}`}>
                <span className="comm-panel__entry-name">{clue.playerName}</span>
                <p className="comm-panel__entry-text">{clue.text.replace(/[“”]/g, '')}</p>
              </div>
            ))}
          </Fragment>
        ))
      )}
    </div>
  )
}

function ChatFeed({ chat, myPlayerId, gamePhase, onSubmit, currentRound }) {
  const [text, setText] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef(null)

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [chat.length, autoScroll])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40)
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    if (trimmed.length > MAX_CHAT_LENGTH) return
    onSubmit(trimmed)
    setText('')
    setAutoScroll(true)
  }, [text, onSubmit])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }, [handleSubmit])

  const isGameActive = gamePhase === 'CLUE' || gamePhase === 'VOTE'
  const overLimit = text.length > MAX_CHAT_LENGTH

  // Group chat by roundNumber
  const chatByRound = {}
  chat.forEach((msg) => {
    const round = msg.roundNumber || currentRound
    if (!chatByRound[round]) chatByRound[round] = []
    chatByRound[round].push(msg)
  })

  const rounds = Object.keys(chatByRound).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="comm-panel__chat">
      <div className="comm-panel__scroll" ref={containerRef} onScroll={handleScroll}>
        {rounds.length === 0 ? (
          <>
            <h2 className="round-heading">Round {String(currentRound).padStart(2, '0')}</h2>
            <p className="comm-panel__empty">No messages yet.</p>
          </>
        ) : (
          rounds.map((roundStr) => (
            <Fragment key={`round-${roundStr}`}>
              <h2 className="round-heading">Round {String(roundStr).padStart(2, '0')}</h2>
              {chatByRound[roundStr].map((msg) => (
                <div
                  key={msg.id}
                  className={`comm-panel__entry comm-panel__entry--message ${msg.playerId === myPlayerId ? 'comm-panel__entry--self' : ''}`}
                >
                  <span className="comm-panel__entry-name">{msg.playerName}</span>
                  <p className="comm-panel__entry-text">{msg.text}</p>
                </div>
              ))}
            </Fragment>
          ))
        )}
      </div>
      <div className="comm-panel__input">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={MAX_CHAT_LENGTH + 10}
          disabled={!isGameActive}
          className="comm-panel__text-input"
          autoComplete="off"
        />
        <Button
          onClick={handleSubmit}
          disabled={!isGameActive || !text.trim() || overLimit}
          className="comm-panel__send-btn"
        >
          Send
        </Button>
      </div>
    </div>
  )
}

function CommunicationPanel({ clues, chat, currentRound, myPlayerId, gamePhase, onSendChat }) {
  const [activeTab, setActiveTab] = useState('clues')
  const [unreadClues, setUnreadClues] = useState(0)
  const [unreadChat, setUnreadChat] = useState(0)
  const cluesSeenRef = useRef(clues.length)
  const chatSeenRef = useRef(chat.length)

  useEffect(() => {
    if (clues.length < cluesSeenRef.current) {
      cluesSeenRef.current = clues.length
      return
    }
    if (clues.length === cluesSeenRef.current) return
    const fresh = clues.slice(cluesSeenRef.current)
    cluesSeenRef.current = clues.length
    if (activeTab !== 'clues') {
      const foreign = fresh.filter((c) => c.playerId !== myPlayerId).length
      if (foreign > 0) setUnreadClues((count) => count + foreign)
    }
  }, [clues, activeTab, myPlayerId])

  useEffect(() => {
    if (chat.length < chatSeenRef.current) {
      chatSeenRef.current = chat.length
      return
    }
    if (chat.length === chatSeenRef.current) return
    const fresh = chat.slice(chatSeenRef.current)
    chatSeenRef.current = chat.length
    if (activeTab !== 'chat') {
      const foreign = fresh.filter((m) => m.playerId !== myPlayerId).length
      if (foreign > 0) setUnreadChat((count) => count + foreign)
    }
  }, [chat, activeTab, myPlayerId])

  const switchTab = useCallback((tab) => {
    setActiveTab(tab)
    if (tab === 'clues') {
      cluesSeenRef.current = clues.length
      setUnreadClues(0)
    } else {
      chatSeenRef.current = chat.length
      setUnreadChat(0)
    }
  }, [chat, clues])

  // We no longer filter by round number so previous round clues remain visible
  return (
    <div className="comm-panel">
      <div className="comm-panel__tabs">
        <button
          type="button"
          className={`comm-panel__tab ${activeTab === 'clues' ? 'comm-panel__tab--active' : ''}`}
          onClick={() => switchTab('clues')}
        >
          <span>Clues</span>
          {unreadClues > 0 && <span className="comm-panel__badge">{unreadClues}</span>}
        </button>
        <button
          type="button"
          className={`comm-panel__tab ${activeTab === 'chat' ? 'comm-panel__tab--active' : ''}`}
          onClick={() => switchTab('chat')}
        >
          <span>Chat</span>
          {unreadChat > 0 && <span className="comm-panel__badge">{unreadChat}</span>}
        </button>
      </div>
      <div className="comm-panel__body">
        <div className={`comm-panel__feed ${activeTab === 'clues' ? 'comm-panel__feed--active' : ''}`}>
          <ClueFeed clues={clues} myPlayerId={myPlayerId} currentRound={currentRound} />
        </div>
        <div className={`comm-panel__feed ${activeTab === 'chat' ? 'comm-panel__feed--active' : ''}`}>
          <ChatFeed
            chat={chat}
            myPlayerId={myPlayerId}
            gamePhase={gamePhase}
            onSubmit={onSendChat}
            currentRound={currentRound}
          />
        </div>
      </div>
    </div>
  )
}

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

function VotingPanel({ players, myPlayerId, votes, lockedVotes, voteResult, onSelectVote, onLockVote, submitting, eliminationResult, onSourceRect, currentRound }) {
  const activePlayers = players.filter(p => {
    // Keep the currently eliminated player in the list so their card can be used as the animation source
    if (eliminationResult && eliminationResult.playerId === p.id) {
      return true;
    }
    return !p.eliminated && !p.spectator;
  })
  const myVote = votes[myPlayerId]
  const isLocked = lockedVotes.includes(myPlayerId)
  
  const voteCounts = {}
  Object.values(votes).forEach(targetId => {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1
  })
  
  const buttonRefs = useRef({})
  useEffect(() => {
    if (eliminationResult && eliminationResult.playerId) {
      const btn = buttonRefs.current[eliminationResult.playerId]
      if (btn && onSourceRect) {
        onSourceRect(btn.getBoundingClientRect())
      }
    }
  }, [eliminationResult, onSourceRect])
  
  return (
    <div className="clue-panel__voting">
      <div className="clue-panel__voting-header">
        <span className="online-kicker">Elimination</span>
        <h2>Time to Vote</h2>
        {voteResult?.tie && <p className="clue-panel__voting-tie">TIE! A revote is required.</p>}
      </div>
      <div className="clue-panel__order" style={{ flexGrow: 1, minHeight: 0 }}>
        <div className="clue-panel__order-header">
          <span className="clue-panel__order-title">Voting Phase</span>
          <span className="clue-panel__round-badge">Round {String(currentRound || 1).padStart(2, '0')}</span>
        </div>
        <div className="clue-panel__voting-list" style={{ padding: '10px 14px', gap: '7px' }}>
        {activePlayers.map((p, index) => {
          const isMe = p.id === myPlayerId
          const isSelected = p.id === myVote
          const hasLocked = lockedVotes.includes(p.id)
          const isEliminatedAnim = eliminationResult?.playerId === p.id
          return (
            <button 
              key={p.id}
              ref={el => buttonRefs.current[p.id] = el}
              className={`voting-card ${isSelected ? 'voting-card--selected' : ''} ${hasLocked ? 'voting-card--locked' : ''} ${isEliminatedAnim ? 'voting-card--eliminated-anim' : ''}`}
              disabled={isLocked || isMe || isEliminatedAnim}
              onClick={() => onSelectVote(p.id)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="voting-card__avatar">{getInitials(p.name)}</span>
              <span className="voting-card__name">{p.name} {isMe ? '(You)' : ''}</span>
              <div className="voting-card__meta">
                {voteCounts[p.id] > 0 && (
                  <span className="voting-card__votes">{voteCounts[p.id]} Vote{voteCounts[p.id] > 1 ? 's' : ''}</span>
                )}
                {hasLocked && <span className="voting-card__status">✓ Locked</span>}
              </div>
            </button>
          )
        })}
      </div>
      </div>
      <div className="clue-panel__voting-actions">
        <Button 
          variant="danger" 
          onClick={onLockVote} 
          disabled={isLocked || !myVote || submitting}
          className="voting-card__submit-btn"
        >
          {isLocked ? 'Vote Locked' : 'Confirm Vote'}
        </Button>
      </div>
    </div>
  )
}

export default function CluePhase({ state, socketRef, onSourceRect }) {
  const [submitting, setSubmitting] = useState(false)
  const [clueError, setClueError] = useState('')
  const [chatError, setChatError] = useState('')
  const submitLockRef = useRef(false)

  const {
    sessionId,
    localSecret,
    configuration,
    clues,
    chat,
    currentTurnPlayerId,
    players,
    round,
    gamePhase,
    roomId,
    turnOrder,
    submittedCluePlayerIds,
    votes,
    lockedVotes,
    voteResult,
  } = state

  const isMyTurn = currentTurnPlayerId === sessionId
  const currentRound = round

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant'
    })
  }, [])

  useEffect(() => {
    submitLockRef.current = false
    setSubmitting(false)
    setClueError('')
  }, [currentTurnPlayerId, gamePhase])

  useEffect(() => {
    if (clueError) {
      const timer = setTimeout(() => setClueError(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [clueError])

  useEffect(() => {
    if (chatError) {
      const timer = setTimeout(() => setChatError(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [chatError])

  const handleSubmitClue = useCallback(async (clueText) => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    setClueError('')

    const response = await emitSubmitClue(socketRef.current, roomId, clueText)

    if (!response?.success) {
      const msg = ERROR_MESSAGES[response?.error] || 'Failed to submit clue.'
      setClueError(msg)
      submitLockRef.current = false
      setSubmitting(false)
    }
  }, [roomId, socketRef])

  const handleSendChat = useCallback(async (text) => {
    setChatError('')
    const response = await emitSendChat(socketRef.current, roomId, text)
    if (!response?.success) {
      const msg = ERROR_MESSAGES[response?.error] || 'Failed to send message.'
      setChatError(msg)
    }
  }, [roomId, socketRef])

  const handleSelectVote = useCallback(async (targetId) => {
    if (submitLockRef.current) return
    const response = await emitSelectVote(socketRef.current, targetId)
    if (!response?.success) {
      const msg = ERROR_MESSAGES[response?.error] || 'Failed to select vote.'
      setClueError(msg)
    }
  }, [socketRef])

  const handleLockVote = useCallback(async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    const response = await emitLockVote(socketRef.current)
    if (!response?.success) {
      const msg = ERROR_MESSAGES[response?.error] || 'Failed to lock vote.'
      setClueError(msg)
      submitLockRef.current = false
      setSubmitting(false)
    } else {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }, [socketRef])

  // Get current state
  return (
    <section className="clue-phase">
      <div className="clue-phase__grid">
        <aside className="clue-phase__order">
          <div className="card-flip-wrapper">
            <div className={`card-flip-inner ${(gamePhase === 'VOTE' || gamePhase === 'ELIMINATION' || gamePhase === 'MR_WHITE_GUESS') ? 'is-flipped' : ''}`}>
              
              {/* FRONT FACE: Clue Order & Turn Indicator */}
              <div className="card-face card-front">
                <TurnIndicator
                  currentTurnPlayerId={currentTurnPlayerId}
                  myPlayerId={sessionId}
                  players={players}
                  gamePhase={gamePhase}
                />
                <ClueOrderDisplay
                  turnOrder={turnOrder}
                  currentTurnPlayerId={currentTurnPlayerId}
                  submittedCluePlayerIds={submittedCluePlayerIds}
                  players={players}
                  myPlayerId={sessionId}
                  currentRound={currentRound}
                />
              </div>

              {/* BACK FACE: Voting Panel */}
              <div className="card-face card-back">
                <VotingPanel
                  players={players}
                  myPlayerId={sessionId}
                  votes={votes}
                  lockedVotes={lockedVotes}
                  voteResult={voteResult}
                  onSelectVote={handleSelectVote}
                  onLockVote={handleLockVote}
                  submitting={submitting}
                  eliminationResult={state.eliminationResult}
                  onSourceRect={onSourceRect}
                  currentRound={currentRound}
                />
              </div>
              
            </div>
          </div>
        </aside>

        <main className="clue-phase__identity">
          <LocalRoleSection localSecret={localSecret} revealRoles={configuration?.revealRoles} gamePhase={gamePhase} />
        </main>

        <div className="clue-phase__input-col">
          {clueError && <div className="clue-phase__error" role="alert">{clueError}</div>}
          <ClueInput
            isMyTurn={isMyTurn}
            gamePhase={gamePhase}
            submitting={submitting}
            onSubmit={handleSubmitClue}
          />
        </div>

        <aside className="clue-phase__comm">
          <CommunicationPanel
            clues={clues}
            chat={chat}
            currentRound={currentRound}
            myPlayerId={sessionId}
            gamePhase={gamePhase}
            onSendChat={handleSendChat}
          />
          {chatError && <div className="clue-phase__error" role="alert">{chatError}</div>}
        </aside>
      </div>
    </section>
  )
}