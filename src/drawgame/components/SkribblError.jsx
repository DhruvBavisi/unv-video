import React from 'react'

export default function SkribblError({ message, style }) {
  if (!message) return null
  return (
    <div className="sk-error-banner" style={{
      background: 'var(--sk-coral)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '12px',
      textAlign: 'center',
      fontFamily: 'var(--sk-font-body)',
      fontWeight: 'bold',
      fontSize: '0.9rem',
      marginBottom: '20px',
      animation: 'skFadeIn 300ms ease forwards',
      ...style
    }}>
      {message}
    </div>
  )
}
