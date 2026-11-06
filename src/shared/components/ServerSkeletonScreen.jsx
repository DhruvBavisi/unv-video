import React, { useState, useEffect } from 'react'

/**
 * ServerSkeletonScreen
 * Minimal two-tone skeleton loading screen presented while the backend server is connecting behind.
 * 
 * Strict Two-Tone Palette:
 * 1. Dark page background (#0b0c0d) matching the page behind it.
 * 2. Light translucent card surface with subtle monochrome shimmer bones.
 * Zero extra colored glows, buttons, or highlights.
 */
export default function ServerSkeletonScreen({
  initialView = 'landing',
  targetDestination = null,
  onSelectDestination,
  isConnected = false,
  onConnectRedirect,
}) {
  const [selectedDest, setSelectedDest] = useState(targetDestination || null)
  const [connectionTime, setConnectionTime] = useState(0)

  // Track elapsed connection seconds for adaptive friendly UX messaging
  useEffect(() => {
    const timer = setInterval(() => {
      setConnectionTime(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // When connection completes, redirect or reveal page
  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => {
        onConnectRedirect(selectedDest || initialView)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isConnected, selectedDest, initialView, onConnectRedirect])

  const handleChoose = (dest) => {
    setSelectedDest(dest)
    if (onSelectDestination) {
      onSelectDestination(dest)
    }
  }

  const getStatusText = () => {
    if (isConnected) {
      if (selectedDest && selectedDest !== initialView) {
        const name = selectedDest === 'skribbl' ? 'Skribbl.io' : selectedDest === 'codenames' ? 'Codenames' : 'Undercover'
        return `Connected! Launching ${name}...`
      }
      return 'Connected! Entering game...'
    }
    if (connectionTime >= 6) {
      return 'Connecting to server... almost ready'
    }
    return 'Connecting to game server...'
  }

  return (
    <div 
      className="sk-server-skeleton" 
      role="status" 
      aria-live="polite" 
      aria-busy={!isConnected}
    >
      <div className="sk-server-skeleton__content">
        {/* Header Bar */}
        <header className="sk-server-skeleton__header">
          <div className="sk-server-skeleton__brand">
            <div className="sk-skeleton-bone sk-server-skeleton__logo-bone" />
            <div className="sk-skeleton-bone sk-server-skeleton__title-bone" />
          </div>

          {/* Connection Status Pill */}
          <div className={`sk-server-skeleton__status-pill ${isConnected ? 'is-connected' : ''}`}>
            <span className="sk-server-skeleton__status-dot" aria-hidden="true" />
            <span className="sk-server-skeleton__status-label">{getStatusText()}</span>
          </div>
        </header>

        {/* Hero / Instructions Section */}
        <section className="sk-server-skeleton__hero">
          <div className="sk-skeleton-bone sk-server-skeleton__heading-bone" />
          <p className="sk-server-skeleton__subtitle">
            {selectedDest ? (
              <span className="sk-server-skeleton__selected-cue">
                ✓ <strong>{selectedDest.toUpperCase()}</strong> selected — redirecting on connection.
              </span>
            ) : (
              'Tap any game below to jump straight in once connected, or wait to stay on this page.'
            )}
          </p>
        </section>

        {/* Interactive Mode Cards Grid */}
        <div className="sk-server-skeleton__grid" role="group" aria-label="Game Modes">
          {/* Card 1: Undercover */}
          <button
            type="button"
            className={`sk-server-skeleton__card sk-server-skeleton__card--undercover ${selectedDest === 'undercover' ? 'is-selected' : ''}`}
            onClick={() => handleChoose('undercover')}
            aria-pressed={selectedDest === 'undercover'}
            title="Play Undercover"
          >
            <div className="sk-server-skeleton__avatar-wrap">
              <div className="sk-skeleton-bone sk-server-skeleton__avatar-bone sk-server-skeleton__avatar-bone--circle" />
            </div>
            <div className="sk-server-skeleton__card-body">
              <div className="sk-skeleton-bone sk-server-skeleton__card-title-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone--short" />
            </div>
            <div className="sk-server-skeleton__card-action">
              <div className="sk-server-skeleton__action-btn">
                {selectedDest === 'undercover' ? '✓ Launching Undercover...' : 'Play Undercover'}
              </div>
            </div>
          </button>

          {/* Card 2: Skribbl.io */}
          <button
            type="button"
            className={`sk-server-skeleton__card sk-server-skeleton__card--skribbl ${selectedDest === 'skribbl' ? 'is-selected' : ''}`}
            onClick={() => handleChoose('skribbl')}
            aria-pressed={selectedDest === 'skribbl'}
            title="Play Skribbl.io"
          >
            <div className="sk-server-skeleton__avatar-wrap">
              <div className="sk-skeleton-bone sk-server-skeleton__avatar-bone sk-server-skeleton__avatar-bone--doodle" />
            </div>
            <div className="sk-server-skeleton__card-body">
              <div className="sk-skeleton-bone sk-server-skeleton__card-title-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone--short" />
            </div>
            <div className="sk-server-skeleton__card-action">
              <div className="sk-server-skeleton__action-btn">
                {selectedDest === 'skribbl' ? '✓ Launching Skribbl.io...' : 'Play Skribbl.io'}
              </div>
            </div>
          </button>

          {/* Card 3: Codenames */}
          <button
            type="button"
            className={`sk-server-skeleton__card sk-server-skeleton__card--codenames ${selectedDest === 'codenames' ? 'is-selected' : ''}`}
            onClick={() => handleChoose('codenames')}
            aria-pressed={selectedDest === 'codenames'}
            title="Play Codenames"
          >
            <div className="sk-server-skeleton__avatar-wrap">
              <div className="sk-skeleton-bone sk-server-skeleton__avatar-bone sk-server-skeleton__avatar-bone--tiles" />
            </div>
            <div className="sk-server-skeleton__card-body">
              <div className="sk-skeleton-bone sk-server-skeleton__card-title-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone--short" />
            </div>
            <div className="sk-server-skeleton__card-action">
              <div className="sk-server-skeleton__action-btn">
                {selectedDest === 'codenames' ? '✓ Launching Codenames...' : 'Play Codenames'}
              </div>
            </div>
          </button>
        </div>

        {/* Footer Navigation Choice */}
        <footer className="sk-server-skeleton__footer">
          <button
            type="button"
            className={`sk-server-skeleton__opt-btn ${selectedDest === 'landing' ? 'is-selected' : ''}`}
            onClick={() => handleChoose('landing')}
          >
            {selectedDest === 'landing' ? '✓ Staying on Home Page' : 'Stay on Home Page'}
          </button>

          {connectionTime >= 20 && !isConnected && (
            <button
              type="button"
              className="sk-server-skeleton__opt-btn sk-server-skeleton__opt-btn--fallback"
              onClick={() => onConnectRedirect(selectedDest || initialView)}
              style={{ marginLeft: '12px' }}
            >
              Continue without waiting
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}
