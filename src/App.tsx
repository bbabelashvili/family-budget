import { useState, useEffect } from 'react'
import { AppLockScreen } from './components/AppLockScreen'
import { ProfileSelector } from './components/ProfileSelector'
import { PinModal } from './components/PinModal'
import { Dashboard } from './components/dashboard/Dashboard'
import { getSession, setSession, clearSession, getAppSession } from './lib/auth'
import type { ProfileId } from './types'

export default function App() {
  const [appUnlocked, setAppUnlocked] = useState(() => getAppSession())
  const [activeProfile, setActiveProfile] = useState<ProfileId | null>(null)
  const [showPin, setShowPin] = useState(false)
  const [inDashboard, setInDashboard] = useState(false)

  useEffect(() => {
    if (appUnlocked) {
      const session = getSession()
      if (session) {
        setActiveProfile(session.profileId)
        setInDashboard(true)
      }
    }
  }, [appUnlocked])

  const handleAppUnlock = () => {
    // The session token was already stored by verifyAppPin during unlock.
    setAppUnlocked(true)
    const session = getSession()
    if (session) {
      setActiveProfile(session.profileId)
      setInDashboard(true)
    }
  }

  const handleProfileSelect = (id: ProfileId) => {
    setActiveProfile(id)
    if (id === 'shared' || id === 'travels') {
      setSession(id)
      setInDashboard(true)
    } else {
      setShowPin(true)
    }
  }

  const handlePinSuccess = () => {
    if (activeProfile) {
      setSession(activeProfile)
      setShowPin(false)
      setInDashboard(true)
    }
  }

  const handlePinCancel = () => {
    setShowPin(false)
    setActiveProfile(null)
  }

  const handleLogout = () => {
    clearSession()
    setActiveProfile(null)
    setInDashboard(false)
    setShowPin(false)
  }

  if (!appUnlocked) {
    return <AppLockScreen onUnlock={handleAppUnlock} />
  }

  if (inDashboard && activeProfile) {
    return <Dashboard profileId={activeProfile} onLogout={handleLogout} />
  }

  return (
    <>
      <ProfileSelector onSelect={handleProfileSelect} />
      {showPin && activeProfile && (
        <PinModal
          profileId={activeProfile}
          onSuccess={handlePinSuccess}
          onCancel={handlePinCancel}
        />
      )}
    </>
  )
}
