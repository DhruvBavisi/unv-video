import React from 'react'

export default function SkribblNetworkStatus({ status = 'Connected', inGame = false, inline = false }) {
  const normalizedStatus = status === 'Connecting' ? 'Connecting' : status === 'Disconnected' ? 'Disconnected' : 'Connected'
  const stateClass = normalizedStatus.toLowerCase()

  if (inline) {
    return (
      <div 
        className={`sk-settings-status-badge sk-settings-status-badge--${stateClass}`}
        role="status"
        aria-live="polite"
        aria-label={`Network status: ${normalizedStatus}`}
        title={`Network status: ${normalizedStatus}`}
      >
        <span className="sk-network-status__dot" aria-hidden="true" />
        <span className="sk-network-status__text">{normalizedStatus}</span>
      </div>
    )
  }

  return (
    <div 
      className={`sk-network-status sk-network-status--${stateClass} ${inGame ? 'sk-network-status--in-game' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={`Network status: ${normalizedStatus}`}
      title={`Network status: ${normalizedStatus}`}
    >
      <span className="sk-network-status__dot" aria-hidden="true" />
      <span className="sk-network-status__text">{normalizedStatus}</span>
    </div>
  )
}
