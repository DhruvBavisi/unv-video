import React from 'react'

/**
 * CodenamesCrown component
 * Sleek espionage / secret agent gold metallic crown designed specifically for Codenames.
 * Features sharp geometric facets, metallic gold gradients, dark tactical outlines,
 * a central blue operative jewel, and an emblem star crest on the central peak.
 *
 * @param {Object} props
 * @param {number|string} [props.size=20] - Width of the crown in px or CSS expression
 * @param {number} [props.angle=-18] - Rotation angle in degrees (default -18deg for circular avatars)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Object} [props.style={}] - Inline style overrides
 * @param {string} [props.title='Room Host'] - Accessible title
 */
export default function CodenamesCrown({
  size = 20,
  angle = -18,
  className = '',
  style = {},
  title = 'Room Host',
  ...rest
}) {
  const isNumeric = typeof size === 'number'
  const widthVal = isNumeric ? `${size}px` : size
  // 28:22 aspect ratio
  const heightVal = isNumeric ? `${Math.round(size * (22 / 28))}px` : `calc(${size} * (22 / 28))`

  return (
    <svg
      viewBox="0 0 28 22"
      className={`cn-host-crown ${className}`.trim()}
      style={{
        width: widthVal,
        height: heightVal,
        transform: angle ? `rotate(${angle}deg)` : undefined,
        transformOrigin: '50% 85%',
        display: 'block',
        pointerEvents: 'none',
        userSelect: 'none',
        flexShrink: 0,
        ...style
      }}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      {...rest}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id="cnGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fff275" />
          <stop offset="40%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="cnBandGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>
      </defs>

      {/* Main Angular Crown Silhouette */}
      <path
        d="M 2.5 17.5 L 25.5 17.5 L 24 7 L 18 12 L 14 3 L 10 12 L 4 7 Z"
        fill="url(#cnGoldGrad)"
        stroke="#0b1320"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Geometric Facet Highlights */}
      <polygon points="14,3 10,12 14,14.5 18,12" fill="#ffffff" opacity="0.25" />
      <line x1="14" y1="3" x2="14" y2="14.5" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.6" />

      {/* Headband Base Band */}
      <rect x="2.5" y="14.5" width="23" height="3" rx="1" fill="url(#cnBandGrad)" stroke="#0b1320" strokeWidth="1.1" />
      <line x1="3.5" y1="15" x2="24.5" y2="15" stroke="#ffffff" strokeWidth="0.7" opacity="0.5" />

      {/* Studs & Operative Cyan Jewel */}
      <circle cx="6" cy="16" r="0.9" fill="#ffffff" opacity="0.9" />
      <circle cx="14" cy="16" r="1.1" fill="#38bdf8" stroke="#0b1320" strokeWidth="0.5" />
      <circle cx="22" cy="16" r="0.9" fill="#ffffff" opacity="0.9" />

      {/* Central Peak Crest Diamond */}
      <polygon points="14,1.8 15.1,3 14,4.2 12.9,3" fill="#ffffff" stroke="#0b1320" strokeWidth="0.5" />
    </svg>
  )
}

