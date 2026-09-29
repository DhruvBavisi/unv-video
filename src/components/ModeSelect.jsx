import React from 'react'
import Button from './Button.jsx'

export default function ModeSelect({ onSelectUndercover, onSelectSkribbl }) {
  return (
    <div className="mode-select">
      <div className="section-inner">
        <h1 className="mode-select__title">GAME MODE</h1>
        <div className="mode-select__cards">
          <div className="mode-select__card">
            <h2 className="mode-select__card-title">UNDERCOVER</h2>
            <p className="mode-select__card-desc">Social deduction</p>
            <Button variant="primary" onClick={onSelectUndercover} className="mode-select__btn">PLAY</Button>
          </div>
          <div className="mode-select__card">
            <h2 className="mode-select__card-title">SKRIBBL</h2>
            <p className="mode-select__card-desc">Draw & guess</p>
            <Button variant="primary" onClick={onSelectSkribbl} className="mode-select__btn">PLAY</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
