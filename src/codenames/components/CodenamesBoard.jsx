import React from 'react'
import CodenamesCard from './CodenamesCard'

export default function CodenamesBoard({ board }) {
  if (!board || board.length !== 25) {
    return <div className="codenames-board-empty">Waiting for board...</div>
  }

  return (
    <div className="codenames-board">
      {board.map(card => (
        <CodenamesCard key={card.id} card={card} />
      ))}
    </div>
  )
}
