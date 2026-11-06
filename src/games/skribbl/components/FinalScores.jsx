import React, { useMemo } from 'react'
import { rankPlayers } from '../finalScoresRanking.js'
import { getAvatarColorClass } from './Lobby.jsx'
import SkribblAvatar from './SkribblAvatar.jsx'

const tierOf = (rank) => (rank === 1 ? 'gold' : rank === 2 ? 'silver' : 'bronze')

/**
 * Authentic Skribbl-designed trophy SVG:
 * Chunky black borders, #ffd000 gold cup, handles, star highlight & shine
 */
export function SkribblTrophy({ size = 36, className = '' }) {
  return (
    <svg 
      width={size} 
      height={Math.round(size * 1.05)} 
      viewBox="0 0 36 38" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`sk-trophy-svg ${className}`}
      aria-hidden="true"
    >
      {/* Trophy Handles */}
      <path 
        d="M 8 11 C 3 11, 2 19, 9 22 C 10 22.5, 11 22, 11 21" 
        stroke="#000000" 
        strokeWidth="2.4" 
        strokeLinecap="round" 
        fill="#ffb700" 
      />
      <path 
        d="M 28 11 C 33 11, 34 19, 27 22 C 26 22.5, 25 22, 25 21" 
        stroke="#000000" 
        strokeWidth="2.4" 
        strokeLinecap="round" 
        fill="#ffb700" 
      />
      {/* Cup Body */}
      <path 
        d="M 8 7 L 28 7 C 28 17, 24 23, 18 24 C 12 23, 8 17, 8 7 Z" 
        fill="#ffd000" 
        stroke="#000000" 
        strokeWidth="2.4" 
        strokeLinejoin="round" 
      />
      {/* Cup Lip / Top Rim */}
      <ellipse 
        cx="18" 
        cy="7" 
        rx="10" 
        ry="2.4" 
        fill="#ffe04d" 
        stroke="#000000" 
        strokeWidth="2.4" 
      />
      {/* Trophy Stem */}
      <path 
        d="M 16 24 L 16 29 L 20 29 L 20 24" 
        fill="#e6a800" 
        stroke="#000000" 
        strokeWidth="2.4" 
      />
      {/* Trophy Base */}
      <path 
        d="M 11 29 L 25 29 L 27 34 L 9 34 Z" 
        fill="#422206" 
        stroke="#000000" 
        strokeWidth="2.4" 
        strokeLinejoin="round" 
      />
      {/* Star Emblem on Cup */}
      <path 
        d="M 18 12 L 19.3 15 L 22.5 15.2 L 20 17.2 L 20.8 20.3 L 18 18.6 L 15.2 20.3 L 16 17.2 L 13.5 15.2 L 16.7 15 Z" 
        fill="#ffffff" 
        stroke="#000000" 
        strokeWidth="1.2" 
        strokeLinejoin="round" 
      />
      {/* Shine Highlight Curve */}
      <path 
        d="M 11 11 C 11 15, 12 18, 14 20" 
        stroke="#ffffff" 
        strokeWidth="1.6" 
        strokeLinecap="round" 
      />
    </svg>
  )
}

export function AvatarSlot({ player, size = 'podium' }) {
  if (player?.avatar && typeof player.avatar === 'object') {
    const avatarPx = size === 'podium' ? 44 : size === 'card' ? 32 : 28
    return (
      <div className={`sk-final-avatar-slot sk-final-avatar-slot--${size}`}>
        <SkribblAvatar avatar={player.avatar} size={avatarPx} />
      </div>
    )
  }
  const avatarSrc = player?.avatarUrl || (typeof player?.avatar === 'string' ? player.avatar : null)
  if (avatarSrc) {
    return (
      <div className={`sk-final-avatar-slot sk-final-avatar-slot--${size}`}>
        <img src={avatarSrc} alt={player?.name || ''} className="sk-final-avatar-img" />
      </div>
    )
  }
  const colorClass = getAvatarColorClass(player?.id)
  const initial = player?.name ? player.name.charAt(0).toUpperCase() : '?'
  return (
    <div className={`sk-final-avatar-slot sk-final-avatar-slot--${size}`}>
      <div className={`sk-avatar ${colorClass} sk-final-avatar-fallback`}>
        {initial}
      </div>
    </div>
  )
}

/**
 * Computes structured horizontal row distributions for runner players (#4 and below).
 * Rules:
 * 1. For total <= 5: Single row of players.
 * 2. For total > 5: Multiple balanced rows where NO row ever has a single isolated player.
 * 3. 14 players (11 runners): exactly [5, 4, 2] (Row 1: 5, Row 2: 4, Row 3: 2).
 * 4. 15 players (12 runners): exactly [5, 4, 3] (Row 1: 5, Row 2: 4, Row 3: 3).
 * 5. Max cards per row is 5 to fit cleanly on mobile screens without overflowing.
 */
export function getRunnerRowDistribution(total) {
  if (total <= 0) return []
  if (total === 1) return [1]
  if (total === 2) return [2]
  if (total === 3) return [3]
  if (total === 4) return [4]
  if (total === 5) return [5]
  if (total === 6) return [3, 3]
  if (total === 7) return [4, 3]
  if (total === 8) return [4, 4]
  if (total === 9) return [5, 4]
  if (total === 10) return [5, 5]
  if (total === 11) return [5, 4, 2] // 14 total players: 3 rows (5-4-2)
  if (total === 12) return [5, 4, 3] // 15 total players: 3 rows (5-4-3)
  if (total === 13) return [5, 4, 4]
  if (total === 14) return [5, 5, 4]
  if (total === 15) return [5, 5, 5]
  if (total === 16) return [5, 4, 4, 3]
  if (total === 17) return [5, 4, 4, 4]

  // Fallback for any larger count:
  // Math.ceil(remaining.length / remainingRows) balances distribution so each row has 2+ players and never an orphan 1 player
  const numRows = Math.ceil(total / 5)
  const result = []
  let rem = total
  for (let r = 0; r < numRows; r++) {
    const remainingRows = numRows - r
    let size = Math.ceil(rem / remainingRows)
    if (remainingRows === 2 && rem - size === 1) {
      size--
    }
    result.push(size)
    rem -= size
  }
  return result
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

  // When total players exceed 8 (more than 5 runners), the stage shifts up to fit the next row
  const isCrowded = ranked.length > 8

  // Partition runners (#4 and below) into structured horizontal rows:
  // - Total <= 8 players (up to 5 runners): Single row of up to 5 players.
  // - Total > 8 players: Evenly balanced rows so NO row ever has a single isolated player at the center.
  //   For 14 players (11 runners), distributes as [5, 4, 2].
  //   For 15 players (12 runners), distributes as [5, 4, 3].
  const runnerRows = useMemo(() => {
    if (!rest || rest.length === 0) return []
    const total = rest.length

    // Single row for up to 5 runner players (total <= 8 players)
    if (total <= 5) {
      return [{
        key: `row-4-to-${3 + total}`,
        label: `Places 4 – ${3 + total}`,
        players: rest,
      }]
    }

    // When players exceed 8 (runners > 5):
    // Distribute using getRunnerRowDistribution so no row ever has an orphan 1 player
    // Math.ceil(remaining.length / remainingRows) provides the balanced distribution baseline
    const distribution = getRunnerRowDistribution(total)
    const result = []
    let remaining = [...rest]
    let currentStartRank = 4

    for (let r = 0; r < distribution.length; r++) {
      const rowSize = distribution[r]
      const chunk = remaining.splice(0, rowSize)
      const endRank = currentStartRank + chunk.length - 1
      result.push({
        key: `row-${currentStartRank}-to-${endRank}`,
        label: `Places ${currentStartRank} – ${endRank}`,
        players: chunk,
      })
      currentStartRank = endRank + 1
    }

    return result
  }, [rest])

  const buttonLabel = isSubmitting
    ? 'RETURNING TO LOBBY...'
    : hasOptedIn
      ? 'WAITING FOR OTHERS...'
      : 'PLAY AGAIN'

  return (
    <div className={`sk-final ${isCrowded ? 'sk-final--crowded' : ''}`} role="region" aria-label="Final scores">
      {/* Hidden SVG Filter for Color Crayon Textured Borders */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <filter id="sk-crayon-stroke" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="3" result="crayonGrain" />
            <feDisplacementMap in="SourceGraphic" in2="crayonGrain" scale="2.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>

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

      {/* Results Content Area: Stage shifts up when player count exceeds 8 to fit next row */}
      <div className={`sk-final-content ${isCrowded ? 'sk-final-content--crowded' : ''}`}>
        {/* Podium Area: 2nd (left), 1st (center), 3rd (right) */}
        <div className={`sk-final-podium-wrap ${isCrowded ? 'sk-final-podium-wrap--crowded' : ''}`}>
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
                  <div className={`sk-final-podium-header ${podiumPlace === 1 ? 'sk-final-podium-header--winner' : ''}`}>
                    {podiumPlace === 1 ? (
                      <div className="sk-final-winner-actor">
                        {/* 1st Place Avatar leaps left and right catching an angled Skribbl trophy on his side (no crown/trophy behind) */}
                        <div className="sk-final-winner-avatar-wrap">
                          <AvatarSlot player={p} size="podium" />
                          <div className="sk-final-trophy-wrap" title="Winner Trophy">
                            <SkribblTrophy size={36} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="sk-final-stand-actor">
                        <AvatarSlot player={p} size="podium" />
                      </div>
                    )}
                  </div>
                  <div className="sk-final-box">
                    <span className="sk-final-rank">#{p.rank}</span>
                    <span className="sk-final-name" title={p.name}>{p.name}</span>
                    <span className="sk-final-points">{p.score} pts</span>
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

        {/* Structured Rows: Places 4 to 9 in first row, next 5 in subsequent rows (No pills) */}
        {runnerRows.length > 0 && (
          <div className="sk-final-runners-section" data-sk-scroll>
            {runnerRows.map((rowGroup, rIdx) => (
              <div 
                key={rowGroup.key} 
                className={`sk-final-row-group sk-final-row-group--${rIdx === 0 ? 'top-tier' : 'next-tier'}`}
              >
                <div className="sk-final-row-grid">
                  {rowGroup.players.map((p) => (
                    <div
                      key={p.id}
                      className={
                        'sk-final-player-card' +
                        (p.id === sessionId ? ' is-you' : '') +
                        (p.isConnected === false ? ' is-offline' : '')
                      }
                    >
                      <div className="sk-final-card-rank">#{p.rank}</div>
                      <div className="sk-final-card-avatar">
                        <AvatarSlot player={p} size="card" />
                      </div>
                      <div className="sk-final-card-info">
                        <span className="sk-final-card-name" title={p.name}>{p.name}</span>
                        <span className="sk-final-card-points">{p.score} pts</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
