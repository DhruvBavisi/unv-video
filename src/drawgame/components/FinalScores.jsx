import { useMemo } from 'react'
import { rankPlayers } from '../finalScoresRanking.js'

const tierOf = (rank) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze')

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
  // left-to-right: 2nd, 1st, 3rd  (indexes into `ranked`: 1, 0, 2)
  const slots = [1, 0, 2].map((i) => ({ player: ranked[i], place: i + 1 }))

  const buttonLabel = isSubmitting
    ? 'RETURNING TO LOBBY...'
    : hasOptedIn
      ? 'WAITING FOR OTHERS...'
      : 'PLAY AGAIN'

  return (
    <section className="sk-final" aria-label="Final scores">
      <header className="sk-final-header">
        <span className="sk-final-kicker">GAME OVER</span>
        <button
          type="button"
          className="sk-topbar-settings-btn"
          onClick={(e) => onOpenSettings(e.currentTarget.getBoundingClientRect())}
          aria-label="Settings"
        >
          <img src="/images/svg/settings.svg" alt="" className="sk-topbar-settings-icon" />
        </button>
      </header>

      <div className="sk-final-scroll" data-sk-scroll>
        <h1 className="sk-final-title">
          {winners.length === 1 ? (
            <>
              <span className="sk-final-winner">{winners[0].name}</span> is the winner!
            </>
          ) : winners.length > 1 ? (
            "It's a tie!"
          ) : (
            'Game over'
          )}
        </h1>
        {winners.length > 1 && (
          <p className="sk-final-subtitle">{winners.map((p) => p.name).join(' & ')}</p>
        )}

        <div className="sk-final-podium">
          {slots.map(({ player: p, place }, s) =>
            p ? (
              <div
                key={p.id}
                className={
                  `sk-final-slot sk-final-slot--place${place} sk-final-slot--${tierOf(p.rank)}` +
                  (p.id === sessionId ? ' is-you' : '') +
                  (p.isConnected === false ? ' is-offline' : '')
                }
              >
                {/* AVATAR SLOT (not implemented yet): render <PlayerAvatar player={p} /> here later */}
                <div className="sk-final-box">
                  <span className="sk-final-rank">#{p.rank}</span>
                  <span className="sk-final-name">{p.name}</span>
                  <span className="sk-final-points">{p.score} points</span>
                  {p.id === sessionId && <span className="sk-badge sk-final-you">YOU</span>}
                  {p.playAgain && <span className="sk-badge sk-final-ready">READY</span>}
                </div>
              </div>
            ) : (
              <div key={`empty-${s}`} className="sk-final-slot sk-final-slot--empty" aria-hidden="true" />
            )
          )}
        </div>

        {rest.length > 0 && (
          <ol className="sk-final-list">
            {rest.map((p, idx) => (
              <li
                key={p.id}
                className={
                  'sk-final-row' +
                  (p.id === sessionId ? ' is-you' : '') +
                  (p.isConnected === false ? ' is-offline' : '')
                }
                style={{ '--i': idx }}
              >
                {/* AVATAR SLOT (not implemented yet) */}
                <span className="sk-final-row-rank">#{p.rank}</span>
                <span className="sk-final-row-name">{p.name}</span>
                {p.id === sessionId && <span className="sk-badge sk-final-you">YOU</span>}
                {p.playAgain && <span className="sk-badge sk-final-ready">READY</span>}
                <span className="sk-final-row-points">{p.score} points</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer className="sk-final-footer">
        {readyCount > 0 && (
          <div className="sk-final-ready-count">{readyCount}/{ranked.length} READY</div>
        )}
        {error && (
          <div role="alert" className="sk-error" style={{ textAlign: 'center' }}>
            {error}
          </div>
        )}
        <button
          type="button"
          className="sk-btn"
          onClick={onPlayAgain}
          disabled={Boolean(isSubmitting) || Boolean(hasOptedIn)}
        >
          {buttonLabel}
        </button>
      </footer>
    </section>
  )
}
