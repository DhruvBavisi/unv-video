import React, { useState, useEffect } from 'react'

/**
 * ServerSkeletonScreen
 * Minimal two-tone skeleton loading screen presented while the backend server is connecting behind.
 * 
 * Strict Two-Tone Palette:
 * 1. Dark page background (#0b0c0d) matching the page behind it.
 * 2. Light translucent card surface with subtle monochrome shimmer bones.
 * Zero interactive buttons, colored glows, or external links.
 */
export default function ServerSkeletonScreen({
  initialView = 'landing',
  targetDestination = null,
  isConnected = false,
  onConnectRedirect,
}) {
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
        onConnectRedirect(targetDestination || initialView)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isConnected, targetDestination, initialView, onConnectRedirect])

  const getStatusText = () => {
    if (isConnected) {
      if (targetDestination && targetDestination !== initialView) {
        const name = targetDestination === 'skribbl' ? 'Skribbl.io' : targetDestination === 'codenames' ? 'Codenames' : 'Undercover'
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
            Connecting to game server and establishing live session...
          </p>
        </section>

        {/* Pure Skeleton Mode Cards Grid (Zero Buttons) */}
        <div className="sk-server-skeleton__grid" aria-hidden="true">
          {/* Card 1: Undercover Placeholder */}
          <div className="sk-server-skeleton__card sk-server-skeleton__card--undercover">
            <div className="sk-server-skeleton__avatar-wrap">
              <div className="sk-skeleton-bone sk-server-skeleton__avatar-bone sk-server-skeleton__avatar-bone--circle" />
            </div>
            <div className="sk-server-skeleton__card-body">
              <div className="sk-skeleton-bone sk-server-skeleton__card-title-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone--short" />
            </div>
            <div className="sk-server-skeleton__card-action">
              <div className="sk-skeleton-bone sk-server-skeleton__card-btn-bone" />
            </div>
          </div>

          {/* Card 2: Skribbl.io Placeholder */}
          <div className="sk-server-skeleton__card sk-server-skeleton__card--skribbl">
            <div className="sk-server-skeleton__avatar-wrap">
              <div className="sk-skeleton-bone sk-server-skeleton__avatar-bone sk-server-skeleton__avatar-bone--doodle" />
            </div>
            <div className="sk-server-skeleton__card-body">
              <div className="sk-skeleton-bone sk-server-skeleton__card-title-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone--short" />
            </div>
            <div className="sk-server-skeleton__card-action">
              <div className="sk-skeleton-bone sk-server-skeleton__card-btn-bone" />
            </div>
          </div>

          {/* Card 3: Codenames Placeholder */}
          <div className="sk-server-skeleton__card sk-server-skeleton__card--codenames">
            <div className="sk-server-skeleton__avatar-wrap">
              <div className="sk-skeleton-bone sk-server-skeleton__avatar-bone sk-server-skeleton__avatar-bone--tiles" />
            </div>
            <div className="sk-server-skeleton__card-body">
              <div className="sk-skeleton-bone sk-server-skeleton__card-title-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone" />
              <div className="sk-skeleton-bone sk-server-skeleton__card-desc-bone--short" />
            </div>
            <div className="sk-server-skeleton__card-action">
              <div className="sk-skeleton-bone sk-server-skeleton__card-btn-bone" />
            </div>
          </div>
        </div>

        {/* Footer (No buttons - purely non-interactive) */}
        <footer className="sk-server-skeleton__footer" />
      </div>
    </div>
  )
}
