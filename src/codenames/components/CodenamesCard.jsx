import React from 'react'

export default function CodenamesCard({ card }) {
  // card: { id, word, category, revealed }
  // category can be 'red', 'blue', 'neutral', 'assassin' or undefined (if Operative and not revealed)
  
  let classNames = 'codenames-card'
  
  if (card.revealed) {
    classNames += ' revealed'
    if (card.category) classNames += ` category-${card.category}`
  } else if (card.category) {
    // Spymaster view
    classNames += ` spymaster category-${card.category}`
  } else {
    classNames += ' unrevealed'
  }

  const len = card.word.length
  const wordSize = len > 9 ? 2.8 : len > 7 ? 3.15 : 3.65

  return (
    <div className={classNames}>
      <div className="card-inner">
        <div className="card-top"></div>
        <div className="card-bottom">
          <span className="card-word" style={{ fontSize: `calc(var(--u) * ${wordSize})` }}>{card.word}</span>
        </div>
      </div>
    </div>
  )
}
