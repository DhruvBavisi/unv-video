import { useState, useEffect } from 'react'
import Button from './Button.jsx'

export default function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstallable, setIsInstallable] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if the app is already installed/running in standalone mode
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true)
    }

    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    const handleAppInstalled = () => {
      // Clear the deferredPrompt so it can be garbage collected
      setDeferredPrompt(null)
      setIsInstallable(false)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    // Show the install prompt
    deferredPrompt.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null)
    
    if (outcome === 'accepted') {
      setIsInstallable(false)
    }
  }

  // If already installed or browser doesn't support install prompt, don't show the button
  if (isStandalone || !isInstallable) {
    return null
  }

  return (
    <Button type="button" variant="ghost" onClick={handleInstallClick} className="install-app-btn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Install App
    </Button>
  )
}
