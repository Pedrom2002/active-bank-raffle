'use client'

import React, { useState, useEffect, useRef } from 'react'

const MAX_PIN_ATTEMPTS = 5

export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || locked || !pin) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (res.ok) {
        onUnlock()
        return
      }
      const a = attempts + 1
      setAttempts(a)
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current)
      setShake(true)
      shakeTimeoutRef.current = setTimeout(() => setShake(false), 400)
      if (a >= MAX_PIN_ATTEMPTS) {
        setLocked(true)
        setError('Muitas tentativas. Contacta o administrador.')
      } else {
        setError(`PIN incorrecto. ${MAX_PIN_ATTEMPTS - a} tentativa${MAX_PIN_ATTEMPTS - a === 1 ? '' : 's'} restante${MAX_PIN_ATTEMPTS - a === 1 ? '' : 's'}.`)
        setPin('')
      }
    } catch {
      setError('Erro de ligação. Tenta de novo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-[#E5E7EB] px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">Acesso Admin</h1>
            <p className="text-sm text-[#6B7280] mt-1.5">Introduz o PIN de acesso</p>
          </div>
          {error && <p role="alert" className="text-red-600 text-sm mb-4 text-center font-medium">{error}</p>}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              autoComplete="current-password"
              value={pin}
              onChange={e => setPin(e.target.value)}
              disabled={locked || submitting}
              placeholder="PIN"
              className="w-full bg-[#F7F8FA] border border-transparent rounded-xl px-4 py-3 text-center text-lg tracking-widest focus:outline-none focus:bg-white focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 disabled:opacity-50 transition"
            />
            <button
              type="submit"
              disabled={locked || submitting || !pin}
              className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40">
              {submitting ? 'A verificar…' : 'Entrar'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
