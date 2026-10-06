import React from 'react'

export default function DrawingTopBar({
  room,
  timeRemaining,
  isDrawer,
  onOpenSettings
}) {
  const roundText = `Round ${room.round} of ${room.totalRounds}`
  
  // Calculate character length if guesser, or show word if drawer
  const wordToDraw = room.selectedWord || ''
  const charLength = wordToDraw.length
  
  // Prepare visual representation
  const hintDisplay = isDrawer 
    ? wordToDraw 
    : (room.hint || wordToDraw.replace(/[a-zA-Z0-9]/g, '_'))

  return (
    <div className="sk-topbar-wrapper">
      <div className="sk-topbar-container">
        
        {/* LEFT SECTION */}
        <div className="sk-topbar-left">
          <div className="sk-topbar-clock-wrapper">
            <img 
              src="/images/svg/clock.svg" 
              alt="Clock" 
              className="sk-topbar-clock-icon" 
            />
            <div className={`sk-topbar-timer ${timeRemaining <= 10 ? 'sk-topbar-timer--danger' : ''}`}>
              {timeRemaining}
            </div>
          </div>
          <div className="sk-topbar-round">{roundText}</div>
        </div>

        {/* CENTER SECTION */}
        <div className="sk-topbar-center">
          <div className="sk-topbar-heading">
            {isDrawer ? 'DRAW THIS' : 'GUESS THIS'}
          </div>
          <div className="sk-topbar-word">
            {hintDisplay}
            <span className="sk-topbar-charlength">{charLength > 0 ? charLength : ''}</span>
          </div>
        </div>

        {/* RIGHT SECTION */}
        <div className="sk-topbar-right">
          <button 
            className="sk-topbar-settings-btn"
            onClick={onOpenSettings}
            aria-label="Settings"
          >
            <img 
              src="/images/svg/settings.svg" 
              alt="Settings" 
              className="sk-topbar-settings-icon" 
            />
          </button>
        </div>

      </div>
      <div className="sk-topbar-divider"></div>
    </div>
  )
}
