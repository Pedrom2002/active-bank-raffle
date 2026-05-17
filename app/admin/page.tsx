'use client'

import { useState, useEffect } from 'react'
import { PinGate } from './PinGate'
import { Dashboard } from './Dashboard'

export default function AdminPage() {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking')

  useEffect(() => {
    fetch('/api/admin/me')
      .then(r => setStatus(r.ok ? 'unlocked' : 'locked'))
      .catch(() => setStatus('locked'))
  }, [])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setStatus('locked')
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#0096DC] border-t-transparent animate-spin" />
      </div>
    )
  }

  return status === 'unlocked'
    ? <Dashboard onLogout={handleLogout} />
    : <PinGate onUnlock={() => setStatus('unlocked')} />
}
