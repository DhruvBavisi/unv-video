import React, { useState, useEffect } from 'react'
import { getCodenamesTile, getPlayerAvatarUrl } from '../utils/cardTiles.js'

export { getCodenamesTile, getPlayerAvatarUrl }

export default function CodenamesCard({
  card,
  isSpymaster = false,
  isClickable = false,
  isSelected = false,
  isFlipping = false,
  targeters = [],
  showPickHand = false,
  onPick = null,
  onClick
}) {
  const [isAwningOpen, setIsAwningOpen] = useState(false)

  // Reset awning when a card is reset or new round begins
  useEffect(() => {
    if (!card.revealed) {
      setIsAwningOpen(false)
    }
  }, [card.revealed])

  let classNames = 'codenames-card'

  if (isSpymaster) {
    classNames += ' is-spymaster spymaster'
  }
  
  if (card.revealed) {
    classNames += ' revealed'
    if (card.category) classNames += ` category-${card.category}`
  } else if (card.category) {
    // Spymaster view or end of game view
    classNames += ` spymaster category-${card.category}`
  } else {
    classNames += ' unrevealed'
  }

  if (isClickable && !card.revealed) {
    classNames += ' clickable'
  }

  if (isSelected && !card.revealed) {
    classNames += ' is-selected'
  }

  if (isFlipping) {
    classNames += ' is-flipping'
  }

  const len = card.word.length
  const wordSize = len > 9 ? 2.8 : len > 7 ? 3.15 : 3.65

  const handleCardClick = (e) => {
    if (card.revealed) {
      // Toggle awning window flap so the word beneath can be peeked
      setIsAwningOpen(prev => !prev)
      return
    }
    if (isClickable && onClick) {
      onClick(e)
    }
  }

  const handleKeyDown = (e) => {
    if ((e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      handleCardClick(e)
    }
  }

  const tileUrl = card.category
    ? getCodenamesTile(card.category, card.id, card.word, card.tileVariant)
    : null

  return (
    <div
      className={classNames}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={isClickable || card.revealed ? 0 : undefined}
      aria-label={`${card.word}${card.revealed && card.category ? ` (${card.category})` : ''}`}
    >
      <div className="cn-card-flipper">
        {/* FRONT FACE: The authentic word card (with Spymaster rim if Spymaster) */}
        <div className="cn-card-face cn-card-face--front">
          {/* Top Left: Operative Avatars & Names / Compact Team Pills */}
          {targeters && targeters.length > 0 && !card.revealed && (
            <div className={`cn-card-targeters ${targeters.length > 1 ? 'is-multi' : 'is-single'}`}>
              {targeters.length === 1 ? (
                targeters.map(p => (
                  <div key={p.id} className={`cn-card-targeter cn-targeter--${p.team || 'blue'}`} title={p.name}>
                    <img
                      src={getPlayerAvatarUrl(p)}
                      alt=""
                      className="cn-card-targeter-img"
                    />
                    <span className="cn-card-targeter-name">{p.name.substring(0, 5)}</span>
                  </div>
                ))
              ) : (
                targeters.map(p => (
                  <div
                    key={p.id}
                    className={`cn-card-targeter-pill cn-pill--${p.team || 'blue'}`}
                    title={p.name}
                  >
                    {p.name.substring(0, 4)}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Top Right: Pick Hand Symbol (Green Background with White Border) */}
          {showPickHand && !card.revealed && (
            <button
              type="button"
              className="cn-card-pick-btn"
              onClick={(e) => {
                e.stopPropagation()
                onPick?.()
              }}
              aria-label={`Confirm pick: ${card.word}`}
              title="Pick this word"
            >
              <svg viewBox="0 0 24 24" className="cn-pick-hand-svg" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/>
                <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
              </svg>
            </button>
          )}

          <div className="card-inner">
            <div className="card-top"></div>
            <div className="card-bottom">
              <span className="card-word" style={{ fontSize: `calc(var(--u) * ${wordSize})` }}>{card.word}</span>
            </div>
          </div>
        </div>

        {/* BACK FACE: Awning Window (Top-Hung Flap with Revealed Character Tile) */}
        <div className={`cn-card-face cn-card-face--back${card.category ? ` bg-${card.category}` : ''}`}>
          {/* Base Layer: authentic card plate underneath the flap, exposed when awning opens */}
          <div className="cn-awning-base">
            <div className="cn-awning-card-plate">
              <span className="cn-awning-word" style={{ fontSize: `calc(var(--u) * ${wordSize})` }}>
                {card.word}
              </span>
            </div>
          </div>

          {/* Awning Flap: hinged at top, holds character image; lifts up on open (30deg), drops down on close */}
          <div className={`cn-awning-flap ${isAwningOpen ? 'is-open' : ''}`}>
            {tileUrl && (
              <img
                src={tileUrl}
                alt={card.category || ''}
                className="cn-card-revealed-img"
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
