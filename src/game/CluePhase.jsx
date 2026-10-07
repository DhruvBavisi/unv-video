import { useState, useRef, useEffect, useCallback, Fragment } from 'react'
import Button from '../components/Button.jsx'
import { emitSubmitClue, emitSendChat, emitSelectVote, emitLockVote, emitUnlockVote, emitGiveFalafel } from './gameState.js'
import { getRoleImage, getRoleImageAlt } from './roleImages.js'
import { MAX_CLUE_LENGTH, MAX_CHAT_LENGTH } from '../../shared/game-limits.js'
import { SPECIAL_ROLES } from '../data/specialRoles.js'
import { useMobileKeyboardFocus } from '../hooks/useMobileKeyboardFocus.js'

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

const SPECIAL_ROLE_AVATAR_LAYOUT = {
  boomerang: { scale: 1.05, translateY: 0, translateX: 0, themeColor: '#ff4551ff', bgColor: 'radial-gradient(circle at center, #FF727A 30%, #F24853 50%, #C12832 100%)', imageVariant: 'bg', borderColor: '#ff5460ff'},
  duelists: { scale: 1.4, translateY: 10, translateX: 0 },
  falafelVendor: { scale: 1, translateY: -5, translateX: 6 },
  ghost: { scale: 1.2, translateY: 0, translateX: 0, themeColor: '#3B82F6', imageVariant: 'bg', bgColor: '#ffffff' },
  goddessOfJustice: { scale: 0.875, translateY: 5, translateX: 0, themeColor: '#22C55E', imageVariant: 'bg-green', bgColor: '#ffffff', },
  joyFool: { scale: 1.1, translateY: 0, translateX: 0,themeColor: '#7C79FC', borderColor: '#8d8bfcff' },
  lovers: { scale: 1.3, translateY: 21, translateX: 0,  bgColor: '#ffffff', themeColor: '#F15990' },
  mrMeme: { scale: 1, translateY: -5, translateX: 12 },
  revenger: { scale: 1, translateY: 5, translateX: 1.5, bgColor: '#ffffff',themeColor: '#06B6D4' }
}

function LocalRoleSection({ localSecret, revealRoles, gamePhase }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isSpecialRoleInfoExpanded, setIsSpecialRoleInfoExpanded] = useState(false)
  const role = localSecret?.role
  const word = localSecret?.word
  const specialRoleKey = localSecret?.specialRole
  const roleVisible = (revealRoles === true || role === 'MR_WHITE') && role != null
  const roleLabel = roleVisible ? role.replace('_', ' ') : '???'
  const wordVisible = gamePhase === 'CLUE' || gamePhase === 'VOTE'
  const specialRoleMeta = specialRoleKey ? SPECIAL_ROLES.find(r => r.key === specialRoleKey) : null

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

        <div style={{ display: 'flex', flexDirection: 'row', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'flex-start' }}>
          {/* Normal Role Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span className="clue-panel__word-label" style={{ marginBottom: '8px' }}>Identity</span>
            {roleVisible ? (
              <div className="clue-panel__avatar" style={{ width: '84px', height: '84px', marginBottom: '5px', padding: 0 }}>
                <img src={getRoleImage(role)} alt={getRoleImageAlt(role)} className="clue-panel__avatar-img" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div className="clue-panel__avatar" style={{ width: '84px', height: '84px', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', background: 'var(--bg-secondary)', padding: 0 }}>
                ?
              </div>
            )}
            <h2 className="clue-panel__role-name" style={{ fontSize: '1.3rem', margin: '0 0 12px 0' }}>{roleVisible ? roleLabel : 'HIDDEN'}</h2>
          </div>

          {/* Special Role Column */}
          {specialRoleMeta && (() => {
            const layout = SPECIAL_ROLE_AVATAR_LAYOUT[specialRoleKey] || { scale: 1, translateY: 0, translateX: 0 }
            const avatarSrc = layout.imageVariant && layout.imageVariant !== 'normal' && specialRoleMeta.avatar
              ? specialRoleMeta.avatar.replace('.png', `-${layout.imageVariant}.png`)
              : specialRoleMeta.avatar;
            
            return (
              <div 
                className="clue-panel__special-role" 
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  '--role-accent': layout.themeColor || 'var(--accent, #a684ff)' 
                }}
              >
                <span className="clue-panel__word-label" style={{ marginBottom: '8px' }}>Special Role</span>
                
                {avatarSrc && (
                  <div 
                    className="clue-panel__avatar" 
                    style={{ 
                      width: '84px', 
                      height: '84px', 
                      padding: 0, 
                      marginBottom: '5px', 
                      position: 'relative',
                      background: layout.bgColor || 'var(--bg-secondary)',
                      ...(layout.borderColor ? { border: `2px solid ${layout.borderColor}` } : {}),
                      overflow: 'hidden'
                    }}
                  >
                    <img 
                      src={avatarSrc} 
                      alt={layout.label || specialRoleMeta.name} 
                      style={{ 
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        transform: `translateX(${layout.translateX}px) scale(${layout.scale}) translateY(${layout.translateY}%)` 
                      }}
                    />
                  </div>
                )}
                
                <h3 className="clue-panel__role-name" style={{ fontSize: '1.3rem', color: 'var(--role-accent)', margin: '0 0 12px 0' }}>
                  {layout.label || specialRoleMeta.name}
                </h3>
              </div>
            )
          })()}
        </div>

        {wordVisible && (
          <div className="clue-panel__secret" style={{ marginTop: '1rem' }}>
            <span className="clue-panel__word-label">Your Secret Word</span>
            <div className="clue-panel__word-box">{word || '???'}</div>
          </div>
        )}

        {specialRoleMeta && (
          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div 
              onClick={(e) => { e.stopPropagation(); setIsSpecialRoleInfoExpanded(!isSpecialRoleInfoExpanded); }}
              style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', cursor: 'pointer', letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px', userSelect: 'none' }}
            >
              VIEW ROLE INFO <span style={{ transform: isSpecialRoleInfoExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '1rem', lineHeight: '0' }}>›</span>
            </div>
            
            {isSpecialRoleInfoExpanded && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', fontSize: '0.75rem', lineHeight: '1.5', color: 'rgba(255, 255, 255, 0.85)', textAlign: 'center', border: '1px solid rgba(255,255,255,0.1)', maxWidth: '400px' }}>
                {specialRoleMeta.description}
              </div>
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

  useMobileKeyboardFocus(inputRef)

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
  for (let i = 1; i <= currentRound; i++) {
    cluesByRound[i] = []
  }
  clues.forEach((clue) => {
    const round = clue.roundNumber || currentRound
    if (!cluesByRound[round]) cluesByRound[round] = []
    cluesByRound[round].push(clue)
  })

  const rounds = Object.keys(cluesByRound).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="comm-panel__scroll" ref={containerRef}>
      {rounds.map((roundStr) => (
        <Fragment key={`round-${roundStr}`}>
          <h2 className="round-heading">Round {String(roundStr).padStart(2, '0')}</h2>
          {cluesByRound[roundStr].length === 0 && Number(roundStr) === currentRound && (
            <p className="comm-panel__empty">No clues yet. The first player will begin shortly.</p>
          )}
          {cluesByRound[roundStr].map((clue) => (
            <div key={clue.id} className={`comm-panel__entry comm-panel__entry--message ${clue.playerId === myPlayerId ? 'comm-panel__entry--self' : ''}`}>
              <span className="comm-panel__entry-name">{clue.playerName}</span>
              <p className="comm-panel__entry-text">{clue.text.replace(/[“”]/g, '')}</p>
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

function ChatFeed({ chat, myPlayerId, gamePhase, onSubmit, currentRound, canChat }) {
  const [text, setText] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const containerRef = useRef(null)
  const chatInputRef = useRef(null)

  useMobileKeyboardFocus(chatInputRef)

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
  for (let i = 1; i <= currentRound; i++) {
    chatByRound[i] = []
  }
  chat.forEach((msg) => {
    const round = msg.roundNumber || currentRound
    if (!chatByRound[round]) chatByRound[round] = []
    chatByRound[round].push(msg)
  })

  const rounds = Object.keys(chatByRound).sort((a, b) => Number(a) - Number(b))

  return (
    <div className="comm-panel__chat">
      <div className="comm-panel__scroll" ref={containerRef} onScroll={handleScroll}>
        {rounds.map((roundStr) => (
          <Fragment key={`round-${roundStr}`}>
            <h2 className="round-heading">Round {String(roundStr).padStart(2, '0')}</h2>
            {chatByRound[roundStr].length === 0 && Number(roundStr) === currentRound && (
              <p className="comm-panel__empty">No messages yet.</p>
            )}
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
        ))}
      </div>
      <div className="comm-panel__input">
        <input
          ref={chatInputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          maxLength={MAX_CHAT_LENGTH + 10}
          disabled={!isGameActive || !canChat}
          className="comm-panel__text-input"
          autoComplete="off"
        />
        <Button
          onClick={handleSubmit}
          disabled={!isGameActive || !text.trim() || overLimit || !canChat}
          className="comm-panel__send-btn"
        >
          Send
        </Button>
      </div>
    </div>
  )
}

function CommunicationPanel({ clues, chat, currentRound, myPlayerId, gamePhase, onSendChat, canChat }) {
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
            canChat={canChat}
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

function VotingPanel({ players, myPlayerId, votes, lockedVotes, voteResult, onSelectVote, onLockVote, onUnlockVote, submitting, eliminationResult, onSourceRect, currentRound }) {
  const activePlayers = players.filter(p => {
    // Keep the currently eliminated player in the list so their card can be used as the animation source
    if (eliminationResult && eliminationResult.playerId === p.id) {
      return true;
    }
    return !p.eliminated && !p.spectator;
  })
  const eligibleVoters = players.filter(p => {
    const isGhostSpectator = p.eliminated === true && p.specialRole === 'ghost'
    return isGhostSpectator || (!p.eliminated && !p.spectator)
  })
  const myVote = votes[myPlayerId]
  const isLocked = lockedVotes.includes(myPlayerId)
  const allVotesConfirmed = eligibleVoters.length > 0 && lockedVotes.length >= eligibleVoters.length
  
  const ghostPlayer = players.find(p => p.eliminated === true && p.specialRole === 'ghost')
  const ghostTargetId = ghostPlayer && lockedVotes.includes(ghostPlayer.id) ? votes[ghostPlayer.id] : null

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
          const isGhostTarget = p.id === ghostTargetId

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
              <div className="voting-card__meta" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isGhostTarget && (
                  <img src="/images/characters/ghost-bg.png" alt="Ghost Voted" title="Ghost voted for this player" style={{ height: '18px', width: '18px', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                )}
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
          onClick={isLocked ? onUnlockVote : onLockVote} 
          disabled={!myVote || submitting || allVotesConfirmed}
          className="voting-card__submit-btn"
        >
          {isLocked ? 'Unlock My Vote' : 'Confirm Vote'}
        </Button>
      </div>
    </div>
  )
}

function RevengerPanel({ players, myPlayerId, isRevenger, onSubmit, submitting, decisionEndsAt }) {
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, (decisionEndsAt || Date.now()) - Date.now()))

  useEffect(() => {
    const updateRemaining = () => setRemainingMs(Math.max(0, (decisionEndsAt || 0) - Date.now()))
    updateRemaining()
    const interval = setInterval(updateRemaining, 250)
    return () => clearInterval(interval)
  }, [decisionEndsAt])

  const remainingSeconds = Math.ceil(remainingMs / 1000)
  
  const activePlayers = players.filter(p => !p.eliminated && !p.spectator)
  
  if (!isRevenger) {
    return (
      <div className="clue-panel__voting" style={{ justifyContent: 'center' }}>
        <div className="clue-panel__voting-header">
          <span className="online-kicker">Special Role Phase</span>
          <h2>THE REVENGER</h2>
          <div className="revenger-decision-timer" aria-live="polite">
            <span>TIME REMAINING</span>
            <strong>{remainingSeconds}s</strong>
          </div>
          <p className="clue-panel__voting-tie" style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Waiting for the Revenger's final strike...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="clue-panel__voting">
      <div className="clue-panel__voting-header">
        <span className="online-kicker">Special Role Phase</span>
        <h2>THE REVENGER</h2>
        <div className="revenger-decision-timer" aria-live="polite">
          <span>TIME REMAINING</span>
          <strong>{remainingSeconds}s</strong>
        </div>
        <p className="clue-panel__voting-tie" style={{ margin: '8px 0', fontSize: '0.85rem' }}>You have been eliminated.<br/>Choose one player to take down with you.</p>
      </div>
      <div className="clue-panel__order" style={{ flexGrow: 1, minHeight: 0 }}>
        <div className="clue-panel__voting-list" style={{ padding: '10px 14px', gap: '7px' }}>
        {activePlayers.map((p, index) => {
          const isMe = p.id === myPlayerId
          const isSelected = p.id === selectedTarget
          const getInitials = (n) => String(n||'').substring(0, 2).toUpperCase()
          return (
            <button 
              key={p.id}
              className={`voting-card ${isSelected ? 'voting-card--selected' : ''}`}
              disabled={isMe}
              onClick={() => setSelectedTarget(p.id)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="voting-card__avatar">{getInitials(p.name)}</span>
              <span className="voting-card__name">{p.name} {isMe ? '(You)' : ''}</span>
            </button>
          )
        })}
      </div>
      </div>
      <div className="clue-panel__voting-actions">
        <Button 
          variant="danger" 
          onClick={() => onSubmit(selectedTarget)} 
          disabled={!selectedTarget || submitting}
          className="voting-card__submit-btn"
        >
          CONFIRM TARGET
        </Button>
      </div>
    </div>
  )
}

function GoddessPanel({ tiedPlayers, myPlayerId, isGoddess, onSubmit, submitting }) {
  const [selectedTarget, setSelectedTarget] = useState(null)
  
  if (!isGoddess) {
    return (
      <div className="clue-panel__voting" style={{ justifyContent: 'center' }}>
        <div className="clue-panel__voting-header">
          <span className="online-kicker">Special Role Phase</span>
          <h2>GODDESS OF JUSTICE</h2>
          <p className="clue-panel__voting-tie" style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>Waiting for the Goddess of Justice to break the tie...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="clue-panel__voting">
      <div className="clue-panel__voting-header">
        <span className="online-kicker">Special Role Phase</span>
        <h2>GODDESS OF JUSTICE</h2>
        <p className="clue-panel__voting-tie" style={{ margin: '8px 0', fontSize: '0.85rem' }}>The vote is tied.<br/>You must decide who is eliminated.</p>
      </div>
      <div className="clue-panel__order" style={{ flexGrow: 1, minHeight: 0 }}>
        <div className="clue-panel__voting-list" style={{ padding: '10px 14px', gap: '7px' }}>
        {tiedPlayers.map((p, index) => {
          const isMe = p.id === myPlayerId
          const isSelected = p.id === selectedTarget
          const getInitials = (n) => String(n||'').substring(0, 2).toUpperCase()
          return (
            <button 
              key={p.id}
              className={`voting-card ${isSelected ? 'voting-card--selected' : ''}`}
              onClick={() => setSelectedTarget(p.id)}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <span className="voting-card__avatar">{getInitials(p.name)}</span>
              <span className="voting-card__name">{p.name} {isMe ? '(You)' : ''}</span>
            </button>
          )
        })}
      </div>
      </div>
      <div className="clue-panel__voting-actions">
        <Button 
          variant="danger" 
          onClick={() => onSubmit(selectedTarget)} 
          disabled={!selectedTarget || submitting}
          className="voting-card__submit-btn"
        >
          CONFIRM TARGET
        </Button>
      </div>
    </div>
  )
}

function FalafelVendorPanel({ players, myPlayerId, isVendor, falafelTargetId, onSubmit, submitting }) {
  const [selectedTarget, setSelectedTarget] = useState(null)
  
  if (!isVendor) return null;
  
  if (falafelTargetId) {
    const targetPlayer = players.find(p => p.id === falafelTargetId);
    return (
      <div className="clue-panel__input" style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>🧆</span>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
          You gave the falafel to <strong style={{ color: '#eab308' }}>{targetPlayer?.name}</strong>.
        </p>
      </div>
    );
  }

  const activePlayers = players.filter(p => !p.eliminated && !p.spectator && p.id !== myPlayerId);

  return (
    <div className="clue-panel__input" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(234, 179, 8, 0.08)', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '6px', padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.9rem', color: '#eab308', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Give Falafel</span>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>1 per round</span>
      </div>
      
      <div className="clue-panel__voting-list" style={{ padding: '4px 0', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
        {activePlayers.map((p) => {
          const isSelected = p.id === selectedTarget;
          return (
            <button
              key={p.id}
              className={`voting-card ${isSelected ? 'voting-card--selected' : ''}`}
              onClick={() => setSelectedTarget(p.id)}
              style={{ 
                minHeight: '36px', 
                padding: '6px 12px',
                background: isSelected ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.05)',
                borderColor: isSelected ? '#eab308' : 'transparent',
                borderWidth: '1px',
                borderStyle: 'solid'
              }}
            >
              <span className="voting-card__name" style={{ color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)' }}>{p.name}</span>
            </button>
          )
        })}
      </div>
      
      <Button 
        variant="primary" 
        onClick={() => {
          if (selectedTarget) onSubmit(selectedTarget);
        }}
        disabled={!selectedTarget || submitting}
        style={{ 
          background: selectedTarget ? '#eab308' : 'rgba(234, 179, 8, 0.3)', 
          color: selectedTarget ? '#000' : 'rgba(255,255,255,0.5)', 
          border: 'none', 
          marginTop: '4px',
          fontWeight: 600
        }}
      >
        {submitting ? 'Giving...' : 'Give Falafel'}
      </Button>
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
    revengerDecisionEndsAt,
  } = state

  const isMyTurn = currentTurnPlayerId === sessionId
  const currentRound = round

  const myPlayer = players.find(p => p.id === sessionId)
  const isGhost = localSecret?.specialRole === 'ghost'
  const canChat = myPlayer && ((!myPlayer.eliminated && !myPlayer.spectator) || isGhost) && !(localSecret?.isFalafelTarget && gamePhase === 'CLUE')

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

  const handleGiveFalafel = useCallback(async (targetId) => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    setClueError('')

    const response = await emitGiveFalafel(socketRef.current, targetId)
    if (!response?.success) {
      setClueError(response?.error || 'Failed to give falafel.')
      submitLockRef.current = false
      setSubmitting(false)
    } else {
      submitLockRef.current = false
      setSubmitting(false)
    }
  }, [socketRef])

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

  const handleUnlockVote = useCallback(async () => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    const response = await emitUnlockVote(socketRef.current)
    if (!response?.success) {
      const msg = ERROR_MESSAGES[response?.error] || 'Failed to unlock vote.'
      setClueError(msg)
    }
    submitLockRef.current = false
    setSubmitting(false)
  }, [socketRef])

  const handleRevengerSubmit = useCallback((targetId) => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    socketRef.current.emit('submit-revenger-decision', { targetId }, (res) => {
      if (!res?.success) {
        setClueError(res?.error || 'Failed to submit decision.')
        submitLockRef.current = false
        setSubmitting(false)
      } else {
        submitLockRef.current = false
        setSubmitting(false)
      }
    })
  }, [socketRef])

  const handleGoddessSubmit = useCallback((targetId) => {
    if (submitLockRef.current) return
    submitLockRef.current = true
    setSubmitting(true)
    socketRef.current.emit('submit-goddess-decision', { targetId }, (res) => {
      if (!res?.success) {
        setClueError(res?.error || 'Failed to submit decision.')
        submitLockRef.current = false
        setSubmitting(false)
      } else {
        submitLockRef.current = false
        setSubmitting(false)
      }
    })
  }, [socketRef])

  // Get current state
  return (
    <section className="clue-phase">
      <div className="clue-phase__grid">
        <aside className="clue-phase__order">
          <div className="card-flip-wrapper">
            <div className={`card-flip-inner ${(gamePhase === 'VOTE' || gamePhase === 'ELIMINATION' || gamePhase === 'MR_WHITE_GUESS' || gamePhase === 'REVENGER_DECISION' || gamePhase === 'GODDESS_DECISION') ? 'is-flipped' : ''}`}>
              
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
                {gamePhase === 'REVENGER_DECISION' ? (
                  <RevengerPanel
                    players={players}
                    myPlayerId={sessionId}
                    isRevenger={localSecret?.specialRole === 'revenger'}
                    onSubmit={handleRevengerSubmit}
                    submitting={submitting}
                    decisionEndsAt={revengerDecisionEndsAt}
                  />
                ) : gamePhase === 'GODDESS_DECISION' ? (
                  <GoddessPanel
                    tiedPlayers={players.filter(p => (voteResult?.tiedPlayers || []).includes(p.id))}
                    myPlayerId={sessionId}
                    isGoddess={localSecret?.specialRole === 'goddessOfJustice'}
                    onSubmit={handleGoddessSubmit}
                    submitting={submitting}
                  />
                ) : (
                  <VotingPanel
                    players={players}
                    myPlayerId={sessionId}
                    votes={votes}
                    lockedVotes={lockedVotes}
                    voteResult={voteResult}
                    onSelectVote={handleSelectVote}
                    onLockVote={handleLockVote}
                    onUnlockVote={handleUnlockVote}
                    submitting={submitting}
                    eliminationResult={state.eliminationResult}
                    onSourceRect={onSourceRect}
                    currentRound={currentRound}
                  />
                )}
              </div>
              
            </div>
          </div>
        </aside>

        <main className="clue-phase__identity">
          <LocalRoleSection localSecret={localSecret} revealRoles={configuration?.revealRoles} gamePhase={gamePhase} />
        </main>

        <div className="clue-phase__input-col">
          {clueError && <div className="clue-phase__error" role="alert">{clueError}</div>}
          
          {localSecret?.isFalafelTarget && gamePhase === 'CLUE' && (
            <div className="clue-panel__input" style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(234, 179, 8, 0.15)', border: '1px solid rgba(234, 179, 8, 0.3)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))' }}>🧆</span>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.95)', lineHeight: 1.4 }}>
                <strong style={{ color: '#eab308', letterSpacing: '0.05em', marginRight: '6px' }}>SILENCED &mdash;</strong>
                You cannot speak this round.
              </p>
            </div>
          )}

          <ClueInput
            isMyTurn={isMyTurn}
            gamePhase={gamePhase}
            submitting={submitting}
            onSubmit={handleSubmitClue}
          />

          {gamePhase === 'CLUE' && localSecret?.specialRole === 'falafelVendor' && !myPlayer?.eliminated && !myPlayer?.spectator && (
            <FalafelVendorPanel
              players={players}
              myPlayerId={sessionId}
              isVendor={true}
              falafelTargetId={localSecret?.falafelTargetId}
              onSubmit={handleGiveFalafel}
              submitting={submitting}
            />
          )}
        </div>

        <aside className="clue-phase__comm">
          <CommunicationPanel
            clues={clues}
            chat={chat}
            currentRound={currentRound}
            myPlayerId={sessionId}
            gamePhase={gamePhase}
            onSendChat={handleSendChat}
            canChat={canChat}
          />
          {chatError && <div className="clue-phase__error" role="alert">{chatError}</div>}
        </aside>
      </div>
    </section>
  )
}