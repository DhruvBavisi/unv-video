import { useEffect, useRef } from 'react'

export default function GameEntryTransition({ onComplete }) {
  const fired = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fired.current) {
        fired.current = true
        onComplete()
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [onComplete])

  const handleEnd = () => {
    if (!fired.current) {
      fired.current = true
      onComplete()
    }
  }

  return (
    <div className="game-entry-transition" onAnimationEnd={handleEnd} role="status" aria-label="Initializing investigation">
      <span>Undercover</span>
      <small>Case File #001</small>
      <strong>Initializing investigation</strong>
    </div>
  )
}
