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

  return (
    <div className={classNames}>
      <span className="card-word">{card.word}</span>
    </div>
  )
}
