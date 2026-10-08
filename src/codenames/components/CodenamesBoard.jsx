import React from 'react'

export default function CodenamesBoard({ board }) {
  // If no board provided, create a placeholder 5x5 board
  const cards = board && board.length === 25 ? board : Array.from({ length: 25 }, (_, i) => ({
    id: String(i),
    word: `WORD ${i + 1}`,
    revealed: false
  }))

  return (
    <div className="codenames-board">
      {cards.map(card => (
        <div 
          key={card.id} 
          className="codenames-card"
          style={{ opacity: card.revealed ? 0.6 : 1 }}
        >
          {card.word}
        </div>
      ))}
    </div>
  )
}
