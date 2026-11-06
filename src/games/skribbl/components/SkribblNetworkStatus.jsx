import React from 'react'

/**
 * Signal Bars SVG icon for network connection status
 * 4 ascending bars colored dynamically by status:
 * - Connected: Vibrant Emerald Green (#10B981)
 * - Connecting: Pulsing Amber (#F59E0B)
 * - Disconnected: Alert Crimson (#EF4444)
 */
export function NetworkBarsIcon({ status = 'Connected', size = 20 }) {
  const normalizedStatus = status === 'Connecting' ? 'Connecting' : status === 'Disconnected' ? 'Disconnected' : 'Connected'
  const stateClass = normalizedStatus.toLowerCase()

  return (
    <svg 
      width={size} 
      height={Math.round(size * 0.9)} 
      viewBox="0 0 20 18" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`sk-network-bars sk-network-bars--${stateClass}`}
      aria-hidden="true"
    >
      <rect className="sk-net-bar sk-net-bar-1" x="2" y="13" width="2.8" height="5" rx="1.4" />
      <rect className="sk-net-bar sk-net-bar-2" x="6.6" y="9.5" width="2.8" height="8.5" rx="1.4" />
      <rect className="sk-net-bar sk-net-bar-3" x="11.2" y="5.5" width="2.8" height="12.5" rx="1.4" />
      <rect className="sk-net-bar sk-net-bar-4" x="15.8" y="1.5" width="2.8" height="16.5" rx="1.4" />
    </svg>
  )
}

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
        <NetworkBarsIcon status={normalizedStatus} size={18} />
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
      <NetworkBarsIcon status={normalizedStatus} size={22} />
    </div>
  )
}
