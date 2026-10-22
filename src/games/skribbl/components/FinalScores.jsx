import React, { useMemo } from 'react'
import { rankPlayers } from '../finalScoresRanking.js'

const tierOf = (rank) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze')

export function AvatarSlot({ player, size = 'podium' }) {
  const avatarSrc = player?.avatarUrl || player?.avatar
  if (!avatarSrc) {
    return null
  }
  return (
    <div className={`sk-final-avatar-slot sk-final-avatar-slot--${size}`}>
      <img src={avatarSrc} alt={player?.name || ''} className="sk-final-avatar-img" />
    </div>
  )
}

export default function FinalScores({
  players,
  sessionId,
  isSubmitting,
  hasOptedIn,
  error,
  onPlayAgain,
  onOpenSettings,
}) {
  const ranked = useMemo(() => rankPlayers(players), [players])
  const winners = ranked.filter((p) => p.rank === 1)
  const rest = ranked.slice(3)
  const readyCount = ranked.filter((p) => p.playAgain).length

  // Left-to-right columns: 2nd place (left), 1st place (center), 3rd place (right)
  const slots = [
    { position: 'second', podiumPlace: 2, player: ranked[1] },
    { position: 'first', podiumPlace: 1, player: ranked[0] },
    { position: 'third', podiumPlace: 3, player: ranked[2] },
  ]

  const buttonLabel = isSubmitting
    ? 'RETURNING TO LOBBY...'
    : hasOptedIn
      ? 'WAITING FOR OTHERS...'
      : 'PLAY AGAIN'

  return (
    <div className="sk-final" role="region" aria-label="Final scores">
      {/* Winner Headline */}
      <div className="sk-final-headline-wrap">
        <h1 className="sk-final-title">
          {winners.length === 1 ? (
            <>
              <span className="sk-final-winner-name">{winners[0].name}</span> is the winner!
            </>
          ) : winners.length > 1 ? (
            <>
              <span className="sk-final-winner-name">{winners.map((p) => p.name).join(' & ')}</span> are the winners!
            </>
          ) : (
            'Game Over'
          )}
        </h1>
        {winners.length > 1 && (
          <p className="sk-final-subtitle">It's a tie!</p>
        )}
      </div>

      {/* Results Content Area: Podium centered in available space, lower players beneath */}
      <div className="sk-final-content">
        {/* Podium Area: 2nd (left), 1st (center), 3rd (right) */}
        <div className="sk-final-podium-wrap">
          <div className="sk-final-podium">
            {slots.map(({ player: p, position, podiumPlace }, s) =>
              p ? (
                <div
                  key={p.id}
                  className={
                    `sk-final-slot sk-final-slot--${position} sk-final-slot--pos-${podiumPlace} sk-final-slot--place${p.rank} sk-final-slot--${tierOf(p.rank)}` +
                    (p.id === sessionId ? ' is-you' : '') +
                    (p.isConnected === false ? ' is-offline' : '')
                  }
                >
                  <AvatarSlot player={p} size="podium" />
                  <div className="sk-final-box">
                    <span className="sk-final-rank">#{p.rank}</span>
                    <span className="sk-final-name" title={p.name}>{p.name}</span>
                    <span className="sk-final-points">{p.score} points</span>
                    {(p.id === sessionId || p.playAgain) && (
                      <div className="sk-final-badges">
                        {p.id === sessionId && <span className="sk-badge sk-final-you">YOU</span>}
                        {p.playAgain && <span className="sk-badge sk-final-ready">READY</span>}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  key={`empty-${s}`}
                  className={`sk-final-slot sk-final-slot--${position} sk-final-slot--pos-${podiumPlace} sk-final-slot--empty`}
                  aria-hidden="true"
                />
              )
            )}
          </div>
        </div>

        {/* Lower Row / Grid of Remaining Players (#4 and below) */}
        {rest.length > 0 && (
          <div className="sk-final-rest-container" data-sk-scroll>
            <div className="sk-final-rest-row">
              {rest.map((p) => (
                <div
                  key={p.id}
                  className={
                    'sk-final-rest-item' +
                    (p.id === sessionId ? ' is-you' : '') +
                    (p.isConnected === false ? ' is-offline' : '')
                  }
                >
                  <span className="sk-final-rest-rank">#{p.rank}</span>
                  <AvatarSlot player={p} size="row" />
                  <span className="sk-final-rest-name" title={p.name}>{p.name}</span>
                  <span className="sk-final-rest-points">{p.score} points</span>
                  {(p.id === sessionId || p.playAgain) && (
                    <div className="sk-final-rest-badges">
                      {p.id === sessionId && <span className="sk-badge sk-final-you">YOU</span>}
                      {p.playAgain && <span className="sk-badge sk-final-ready">READY</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="sk-final-footer">
        {readyCount > 0 && (
          <span className="sk-final-ready-count">{readyCount}/{ranked.length} READY</span>
        )}
        {error && (
          <div role="alert" className="sk-error sk-final-error">
            {error}
          </div>
        )}
        <button
          type="button"
          className="sk-btn sk-final-btn"
          onClick={onPlayAgain}
          disabled={Boolean(isSubmitting) || Boolean(hasOptedIn)}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  )
}
