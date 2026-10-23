import React, { useState } from 'react'
import { connectSocket } from '../../../shared/realtime/socket.js'
import CodenamesCard from './CodenamesCard.jsx'
import { Icon, TopBar, SettingsModal, PlayersModal } from './CodenamesShared.jsx'



const CLUE_ERRORS = {
  EMPTY_CLUE: 'Enter a clue.',
  INVALID_CLUE: 'One word only, up to 25 characters.',
  CLUE_MATCHES_BOARD_WORD: "A clue can't be a word on the board.",
  INVALID_NUMBER: 'Pick a number from 1 to 9.',
  NOT_YOUR_TURN: "It's not your team's turn.",
  INVALID_PHASE: 'A clue was already given.'
}

export default function CodenamesBoard({ room, playerId, onLeave }) {
  const [clueWord, setClueWord] = useState('')
  const [clueNum, setClueNum] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clueError, setClueError] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)

  const myPlayer = room.players.find(p => p.id === playerId)

  const handleJoinTeam = (team, role) => {
    connectSocket(playerId).emit('codenames:join-team-role', { team, role }, (res) => {
      if (res?.error) alert(res.error === 'SPYMASTER_SLOT_TAKEN' ? 'This Spymaster slot is already taken.' : res.error)
    })
  }

  const board = room.board

  const handleClueSubmit = (e) => {
    e.preventDefault()
    if (!clueWord.trim() || isSubmitting) return
    setClueError('')
    setIsSubmitting(true)
    const unlock = setTimeout(() => setIsSubmitting(false), 8000)
    const socket = connectSocket(playerId)
    socket.emit('codenames:give-clue', { clue: clueWord.trim(), number: clueNum }, (res) => {
      clearTimeout(unlock)
      setIsSubmitting(false)
      if (res?.success) { setClueWord(''); setClueNum(1) }
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

  let statusMessage = 'GAME STARTED'
  if (room.status === 'FINISHED') statusMessage = room.winner ? `${room.winner.toUpperCase()} TEAM WINS` : 'GAME OVER'
  else if (needMsg) statusMessage = needMsg
  else if (isWaiting) statusMessage = 'ROOM STARTED — WAITING FOR PLAYERS'
  else if (isMyClueTurn) statusMessage = 'GIVE YOUR OPERATIVES A CLUE'
  else if (room.phase === 'GUESS_PHASE' && room.currentClue) statusMessage = `${room.currentTeam.toUpperCase()} CLUE: ${room.currentClue.word} ${room.currentClue.number}`
  else if (room.currentTeam) statusMessage = `${room.currentTeam.toUpperCase()} TEAM'S TURN`

  const renderAvatar = (p) => (
    <div key={p.id} className="cn-board-avatar">
      {p.id === room.hostId && <div className="cn-board-crown">👑</div>}
      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}&backgroundColor=transparent`} alt="avatar" />
      <div className="cn-board-avatar-name">{p.name.substring(0, 5)}</div>
    </div>
  )

  const renderSlot = (team, role) => {
    const members = room.players.filter(p => p.team === team && p.role === role)
    const isMine = myPlayer?.team === team && myPlayer?.role === role
    const spyTaken = role === 'SPYMASTER' && members.length > 0
    const canJoin = !isMine && !spyTaken && room.status !== 'FINISHED'
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
    <div className="cn-game-page">
      <TopBar count={room.players.length} onPlayers={() => setShowPlayers(true)} onSettings={() => setShowSettings(true)} />













      <div className="cn-game-main">
        <div className="cn-status-row">
          <div className="cn-status-text">{statusMessage}</div>
          <button className="cn-help-btn" aria-label="Help"><span>?</span></button>
        </div>

        <div className="cn-board-grid">
          {board.map(card => (
            <CodenamesCard key={card.id} card={card} />
          ))}
        </div>

        <div className="cn-game-info-row">
          <div className="cn-team-col blue-col">
            <div className={`cn-top-panel blue-panel${isActive('blue','ops') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">OPERATIVES</div>
              {renderSlot('blue','OPERATIVE')}
            </div>
            <div className="cn-score-section blue-score">
              <div className="cn-score-number">{blueScore}</div>
              <div className="cn-score-thumb" aria-hidden="true" />
            </div>
            <div className={`cn-bottom-panel blue-spy${isActive('blue','spy') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">SPYMASTERS</div>
              {renderSlot('blue','SPYMASTER')}
            </div>
          </div>

          <div className="cn-game-log-col">
            <div className="cn-game-log">
              <div className="cn-log-header">GAME LOG</div>
              <div className="cn-log-content"></div>
            </div>
          </div>

          <div className="cn-team-col red-col">
            <div className={`cn-top-panel red-panel${isActive('red','ops') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">OPERATIVES</div>
              {renderSlot('red','OPERATIVE')}
            </div>
            <div className="cn-score-section red-score">
              <div className="cn-score-number">{redScore}</div>
              <div className="cn-score-thumb" aria-hidden="true" />
            </div>
            <div className={`cn-bottom-panel red-spy${isActive('red','spy') ? ' is-active' : ''}`}>
              <div className="cn-panel-header">SPYMASTERS</div>
              {renderSlot('red','SPYMASTER')}
            </div>
          </div>
        </div>

        {isMyClueTurn && (
          <>
            {clueError && <div className="cn-clue-error" role="alert">{clueError}</div>}
            <form className="cn-clue-control" onSubmit={handleClueSubmit}>
              <input
                type="text"
                className="cn-clue-input"
                placeholder="YOUR CLUE"
                value={clueWord}
                onChange={e => { setClueWord(e.target.value.toUpperCase()); setClueError(''); }}
                disabled={isSubmitting}
                maxLength={25}
              />
              <button type="button" className="cn-clue-dec" onClick={() => setClueNum(n => (n % 9) + 1)} aria-label={`Clue number ${clueNum}, tap to change`} disabled={isSubmitting}>
                <span className="cn-dec-symbol">{clueNum}</span>
              </button>
              <button type="submit" className="cn-clue-submit" disabled={!clueWord.trim() || isSubmitting}>
                <Icon type="up" size={24} />
              </button>
            </form>
          </>
        )}
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onLeave={onLeave} />}
      {showPlayers && <PlayersModal room={room} playerId={playerId} onClose={() => setShowPlayers(false)} />}



















    </div>
  )
}
