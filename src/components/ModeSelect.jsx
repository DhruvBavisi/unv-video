import React from 'react'

export default function ModeSelect({ onSelectUndercover, onSelectSkribbl, onSelectCodenames, onBack }) {
  return (
    <div className="mode-select mode-select--cinematic">
      
      {/* ATMOSPHERIC BACKGROUND ZONES */}
      <div className="mode-select__bg">
        <div className="mode-select__bg-layer mode-select__bg-base"></div>
        <div className="mode-select__bg-layer mode-select__bg-uc-glow"></div>
        <div className="mode-select__bg-layer mode-select__bg-sk-glow"></div>
        <div className="mode-select__bg-layer mode-select__bg-noise"></div>
        <div className="mode-select__bg-layer mode-select__bg-vignette"></div>
      </div>

      <div className="mode-select__topbar">
        {onBack && (
          <button className="mode-select__back-btn" onClick={onBack}>
            <span className="mode-select__back-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </span>
            <span className="mode-select__back-text">BACK</span>
          </button>
        )}
      </div>

      <div className="mode-select__content">
        <div className="mode-select__header">
          <div className="mode-select__eyebrow">
            <span className="mode-select__eyebrow-dot"></span>
            CHOOSE YOUR EXPERIENCE
          </div>
          <h1 className="mode-select__title">GAME MODE</h1>
        </div>
        
        <div className="mode-select__panels">
          
          {/* UNDERCOVER PANEL */}
          <div className="mode-select__panel mode-select__panel--uc" onClick={onSelectUndercover}>
            
            <div className="mode-select__panel-bg"></div>
            <div className="mode-select__panel-glow"></div>
            <div className="mode-select__panel-border"></div>
            
            {/* Corner Markers */}
            <div className="mode-select__corner mode-select__corner--tl"></div>
            <div className="mode-select__corner mode-select__corner--br"></div>

            <div className="mode-select__panel-index">01</div>
            
            <div className="mode-select__panel-art">
              <svg className="mode-select__art-svg mode-select__art-svg--uc-hat" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M21,14c0-0.6-0.4-1.1-1-1.1h-0.9l-2.4-6.4C16.3,5.6,15.5,5,14.5,5h-5C8.5,5,7.7,5.6,7.4,6.5L5,12.9H4c-0.6,0-1,0.5-1,1.1 C3,15.1,3.9,16,5,16h14C20.1,16,21,15.1,21,14z M8.5,12.9l1.8-4.8c0.1-0.2,0.3-0.4,0.6-0.4h2.2c0.3,0,0.5,0.2,0.6,0.4l1.8,4.8H8.5z"/>
              </svg>
              <svg className="mode-select__art-svg mode-select__art-svg--uc-glass" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </div>
            
            <div className="mode-select__panel-info">
              <h2 className="mode-select__panel-title">UNDERCOVER</h2>
              <p className="mode-select__panel-subtitle">SOCIAL DEDUCTION</p>
            </div>

            <div className="mode-select__panel-cta">
              <span className="mode-select__cta-text">INVESTIGATE</span>
              <span className="mode-select__cta-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </span>
            </div>
          </div>

          {/* SKRIBBL PANEL */}
          <div className="mode-select__panel mode-select__panel--sk" onClick={onSelectSkribbl}>
            
            <div className="mode-select__panel-bg"></div>
            <div className="mode-select__panel-glow"></div>
            <div className="mode-select__panel-border"></div>

            {/* Corner Markers */}
            <div className="mode-select__corner mode-select__corner--tr"></div>
            <div className="mode-select__corner mode-select__corner--bl"></div>

            <div className="mode-select__panel-index">02</div>
            
            <div className="mode-select__panel-art">
              <svg className="mode-select__art-svg mode-select__art-svg--sk-pencil" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
              <svg className="mode-select__art-svg mode-select__art-svg--sk-palette" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M12 3c-4.97 0-9 4.03-9 9 0 4.17 2.84 7.67 6.69 8.69.42.11.81-.19.81-.62v-2.03c0-.39.27-.75.65-.82 1.48-.3 2.91-1.08 4.09-2.33 2.87-3.05 1.87-8.08-1.5-8.86-.33-.07-.63-.23-.88-.47C12.44 5.2 12.23 5 12 5zM8 11.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm3-3.5c-.83 0-1.5-.67-1.5-1.5S10.17 5 11 5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4 3.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm.5 4c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            </div>

            <div className="mode-select__panel-info">
              <h2 className="mode-select__panel-title">SKRIBBL</h2>
              <p className="mode-select__panel-subtitle">DRAW & GUESS</p>
            </div>

            <div className="mode-select__panel-cta">
              <span className="mode-select__cta-text">PLAY</span>
              <span className="mode-select__cta-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </span>
            </div>
          </div>

          {/* CODENAMES PANEL */}
          <div className="mode-select__panel mode-select__panel--sk" onClick={onSelectCodenames}>
            
            <div className="mode-select__panel-bg" style={{background: 'radial-gradient(circle at 50% 0%, rgba(200,50,50,0.15) 0%, transparent 70%)'}}></div>
            <div className="mode-select__panel-glow"></div>
            <div className="mode-select__panel-border"></div>

            {/* Corner Markers */}
            <div className="mode-select__corner mode-select__corner--tr"></div>
            <div className="mode-select__corner mode-select__corner--bl"></div>

            <div className="mode-select__panel-index">03</div>
            
            <div className="mode-select__panel-art">
              <svg className="mode-select__art-svg mode-select__art-svg--uc-glass" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
              </svg>
            </div>

            <div className="mode-select__panel-info">
              <h2 className="mode-select__panel-title">CODENAMES</h2>
              <p className="mode-select__panel-subtitle">WORD ASSOCIATION</p>
            </div>

            <div className="mode-select__panel-cta">
              <span className="mode-select__cta-text">PLAY</span>
              <span className="mode-select__cta-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
