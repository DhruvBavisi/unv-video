import React from 'react'

/**
 * HostCrown component
 * Authentic Skribbl golden vector crown with three jewels (red, blue, green),
 * calibrated to connect flush to avatar heads at a -26° angle with transform-origin at base center (50% 85%).
 *
 * @param {Object} props
 * @param {number|string} [props.size=22] - Width of the crown in px or CSS expression (e.g. 20, 22, 'calc(var(--u) * 3.2)')
 * @param {number} [props.angle=-26] - Rotation angle in degrees (default -26deg for flush head contact)
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {Object} [props.style={}] - Inline style overrides
 * @param {string} [props.title='Room Host'] - Accessible tooltip
 */
export default function HostCrown({
  size = 22,
  angle = -26,
  className = '',
  style = {},
  title = 'Room Host',
  ...rest
}) {
  const isNumeric = typeof size === 'number'
  const widthVal = isNumeric ? `${size}px` : size
  const heightVal = isNumeric ? `${Math.round(size * 0.8125)}px` : `calc(${size} * 0.8125)`

  return (
    <svg
      viewBox="0 0 32 26"
      className={`sk-host-crown ${className}`.trim()}
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
      {/* Golden crown body */}
      <path
        d="M 3 22 L 29 22 L 27 9 L 21 15 L 16 4 L 11 15 L 5 9 Z"
        fill="#ffd000"
        stroke="#000000"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Lower headband accent */}
      <path
        d="M 4.5 19 L 27.5 19"
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Jewels: Ruby red center, Sapphire blue left, Emerald green right */}
      <circle cx="16" cy="4" r="1.6" fill="#ff2e55" stroke="#000000" strokeWidth="1.2" />
      <circle cx="5" cy="9" r="1.4" fill="#3388ff" stroke="#000000" strokeWidth="1.2" />
      <circle cx="27" cy="9" r="1.4" fill="#2bd652" stroke="#000000" strokeWidth="1.2" />
    </svg>
  )
}

