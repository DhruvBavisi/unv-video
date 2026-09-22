import { useState, useCallback, useEffect } from 'react'
import { emitSubmitVote } from './gameState.js'

function getInitials(name) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}

const VOTE_ERROR_MESSAGES = {
  SELF_VOTE: 'You cannot vote for yourself.',
  ALREADY_VOTED: 'You have already cast your vote.',
  NOT_ACTIVE_PLAYER: 'Only active players can vote.',
  INVALID_TARGET: 'That player cannot be voted for.',
  VOTE_PHASE_NOT_ACTIVE: 'Voting is not currently active.',
  PLAYER_NOT_FOUND: 'Connection issue — try refreshing.',
  ROOM_NOT_FOUND: 'Room not found.',
}

export default function VotePhase({ state, socketRef }) {
  const [submitting, setSubmitting] = useState(false)
  const [voteError, setVoteError] = useState('')

  const {
    sessionId,
    players,
    votes,
    voteOutcome,
    eliminatedPlayerId,
    votingAttempt,
    gamePhase,
    round,
    roomId,
  } = state

  const isVoting = gamePhase === 'VOTING'
  const isVoteResult = gamePhase === 'VOTE_RESULT'

  const activePlayers = players.filter((p) => !p.eliminated && !p.spectator && p.status === 'PLAYING')
  const me = players.find((p) => p.id === sessionId)
  const isActivePlayer = me && !me.eliminated && !me.spectator && me.status === 'PLAYING'
  const myVoteTargetId = votes[sessionId]
  const hasVoted = myVoteTargetId !== undefined
  const votesCount = Object.keys(votes).length
  const eligibleVoterCount = activePlayers.filter((p) => p.isConnected).length

  const eliminatedPlayer = eliminatedPlayerId
    ? players.find((p) => p.id === eliminatedPlayerId)
    : null

  // Build per-candidate vote tallies for display
  const tally = {}
  for (const targetId of Object.values(votes)) {
    tally[targetId] = (tally[targetId] || 0) + 1
  }

  useEffect(() => {
    setSubmitting(false)
    setVoteError('')
  }, [gamePhase, votingAttempt])

  useEffect(() => {
    if (voteError) {
      const timer = setTimeout(() => setVoteError(''), 4000)
      return () => clearTimeout(timer)
    }
  }, [voteError])

  const handleVote = useCallback(async (targetId) => {
    if (submitting || hasVoted || !isVoting) return
    setSubmitting(true)
    setVoteError('')

    const response = await emitSubmitVote(socketRef.current, targetId)

    if (!response?.success) {
      const msg = VOTE_ERROR_MESSAGES[response?.error] || 'Failed to submit vote.'
      setVoteError(msg)
    }
    setSubmitting(false)
  }, [submitting, hasVoted, isVoting, socketRef])

  return (
    <section className="vote-phase">
      {/* Header */}
      <header className="vote-phase__header">
        <span className="online-kicker">Round {round}</span>
        <h2 className="vote-phase__title">
          {isVoteResult && voteOutcome === 'TIE'
            ? 'TIE — REVOTING'
            : isVoteResult && voteOutcome === 'ELIMINATED'
              ? 'VOTE RESULT'
              : 'VOTE'}
        </h2>
        {votingAttempt > 1 && (
          <span className="vote-phase__attempt">Attempt {votingAttempt}</span>
        )}
      </header>

      {/* Vote Result Banner */}
      {isVoteResult && (
        <div className={`vote-result-banner ${voteOutcome === 'TIE' ? 'vote-result-banner--tie' : 'vote-result-banner--eliminated'}`}>
          {voteOutcome === 'TIE' ? (
            <>
              <span className="vote-result-banner__icon">⚖</span>
              <div className="vote-result-banner__content">
                <strong>Tie — No Elimination</strong>
                <p>The votes were split. Preparing for another round…</p>
              </div>
            </>
          ) : (
            <>
              <span className="vote-result-banner__icon">✕</span>
              <div className="vote-result-banner__content">
                <strong>{eliminatedPlayer?.name || 'Unknown'} has been eliminated</strong>
                <p>The investigation continues.</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="vote-phase__grid">
        {/* Left: instruction / status */}
        <aside className="vote-phase__sidebar">
          {isVoting && (
            <div className="vote-panel">
              <span className="online-kicker">Instructions</span>
              <p className="vote-panel__rule">Select one suspect to eliminate.</p>
              <ul className="vote-panel__rules">
                <li>You cannot vote for yourself.</li>
                <li>Your vote is final once cast.</li>
                <li>Ties trigger a new vote.</li>
              </ul>
              {isActivePlayer && (
                <div className="vote-progress">
                  <div
                    className="vote-progress__bar"
                    style={{ width: eligibleVoterCount > 0 ? `${(votesCount / eligibleVoterCount) * 100}%` : '0%' }}
                  />
                  <span className="vote-progress__label">{votesCount} / {eligibleVoterCount} voted</span>
                </div>
              )}
              {!isActivePlayer && (
                <p className="vote-panel__spectator-note">You are observing this vote.</p>
              )}
            </div>
          )}

          {isVoteResult && (
            <div className="vote-panel">
              <span className="online-kicker">Final Tally</span>
              <div className="vote-tally">
                {activePlayers.map((p) => {
                  const count = tally[p.id] || 0
                  const isEliminated = p.id === eliminatedPlayerId
                  return (
                    <div key={p.id} className={`vote-tally__row ${isEliminated ? 'vote-tally__row--eliminated' : ''}`}>
                      <span className="vote-tally__name">{p.name}</span>
                      <span className="vote-tally__count">{count} vote{count !== 1 ? 's' : ''}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </aside>

        {/* Right: candidate cards */}
        <main className="vote-phase__candidates">
          <span className="online-kicker">
            {isVoting ? 'Select a suspect' : 'All suspects'}
          </span>

          {voteError && (
            <div className="vote-phase__error" role="alert">{voteError}</div>
          )}

          <div className="vote-candidates">
            {activePlayers.map((candidate) => {
              const isSelf = candidate.id === sessionId
              const isVotedFor = myVoteTargetId === candidate.id
              const receivedVotes = tally[candidate.id] || 0
              const isEliminated = candidate.id === eliminatedPlayerId
              const canVote = isVoting && isActivePlayer && !hasVoted && !isSelf && !submitting

              return (
                <button
                  key={candidate.id}
                  className={[
                    'vote-candidate',
                    isSelf ? 'vote-candidate--self' : '',
                    isVotedFor ? 'vote-candidate--selected' : '',
                    isEliminated ? 'vote-candidate--eliminated' : '',
                    !canVote && isVoting ? 'vote-candidate--locked' : '',
                  ].join(' ')}
                  onClick={() => canVote && handleVote(candidate.id)}
                  disabled={!canVote}
                  aria-pressed={isVotedFor}
                  aria-label={`Vote for ${candidate.name}${isSelf ? ' (you)' : ''}`}
                >
                  <span className="vote-candidate__avatar">{getInitials(candidate.name)}</span>
                  <span className="vote-candidate__name">
                    {candidate.name}
                    {isSelf && <span className="vote-candidate__you-tag"> (You)</span>}
                  </span>
                  {receivedVotes > 0 && (
                    <span className="vote-candidate__votes">
                      {receivedVotes} vote{receivedVotes !== 1 ? 's' : ''}
                    </span>
                  )}
                  {isVotedFor && (
                    <span className="vote-candidate__check" aria-hidden="true">✓ Your vote</span>
                  )}
                  {isEliminated && (
                    <span className="vote-candidate__eliminated-tag" aria-hidden="true">ELIMINATED</span>
                  )}
                </button>
              )
            })}
          </div>

          {isVoting && hasVoted && (
            <p className="vote-phase__voted-notice">
              Your vote has been cast. Waiting for others…
            </p>
          )}
        </main>
      </div>
    </section>
  )
}
