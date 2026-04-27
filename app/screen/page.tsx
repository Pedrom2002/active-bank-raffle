'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

type QRData = {
  session_id: string
  session_name: string
  qr_data_url: string
  expires_at: number
}

type Winner = {
  name: string
  phone: string
}

export default function ScreenPage() {
  const [qr, setQr] = useState<QRData | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [count, setCount] = useState(0)
  const [winner, setWinner] = useState<Winner | null>(null)
  const [noSession, setNoSession] = useState(false)
  const [latestDraw, setLatestDraw] = useState<{ label: string; winner: { name: string; phone: string } } | null>(null)
  const [drawVisible, setDrawVisible] = useState(false)
  const lastDrawId = useRef<string | null>(null)

  const fetchQR = useCallback(async () => {
    const res = await fetch('/api/qr')
    if (!res.ok) { setNoSession(true); return }
    const data: QRData = await res.json()
    setQr(data)
    setNoSession(false)
  }, [])

  const fetchCount = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/participants?session_id=${sessionId}`)
    if (res.ok) {
      const data = await res.json()
      setCount(data.length)
    }
  }, [])

  const fetchWinner = useCallback(async () => {
    const res = await fetch('/api/raffle')
    if (res.ok) {
      const data = await res.json()
      if (data.winner) setWinner(data.winner)
    }
  }, [])

  const fetchLatestDraw = useCallback(async () => {
    if (!qr?.session_id) return
    const res = await fetch(`/api/draws?session_id=${qr.session_id}&latest=1`)
    if (!res.ok) return
    const data = await res.json()
    if (!data.draw) return
    if (data.draw.id === lastDrawId.current) return
    lastDrawId.current = data.draw.id
    setLatestDraw({
      label: data.draw.label,
      winner: data.draw.participants,
    })
    setDrawVisible(true)
    setTimeout(() => setDrawVisible(false), 10_000)
  }, [qr?.session_id])

  // Initial fetch
  useEffect(() => { fetchQR() }, [fetchQR])

  // Refresh QR when token is about to expire
  useEffect(() => {
    if (!qr) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((qr.expires_at - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 1) fetchQR()
    }, 1000)
    return () => clearInterval(interval)
  }, [qr, fetchQR])

  // Poll participant count every 5s
  useEffect(() => {
    if (!qr?.session_id) return
    fetchCount(qr.session_id)
    const interval = setInterval(() => fetchCount(qr.session_id), 5000)
    return () => clearInterval(interval)
  }, [qr?.session_id, fetchCount])

  // Poll for winner every 3s
  useEffect(() => {
    const interval = setInterval(fetchWinner, 3000)
    return () => clearInterval(interval)
  }, [fetchWinner])

  // Poll for latest draw every 3s
  useEffect(() => {
    if (!qr?.session_id) return
    fetchLatestDraw()
    const interval = setInterval(fetchLatestDraw, 3000)
    return () => clearInterval(interval)
  }, [qr?.session_id, fetchLatestDraw])

  // Winner screen
  if (winner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center text-white">
        <div className="text-center animate-bounce-in">
          <div className="text-8xl mb-6">🏆</div>
          <div className="text-3xl font-light mb-2 tracking-widest uppercase opacity-80">Vencedor</div>
          <div className="text-7xl font-black mb-4 tracking-tight">{winner.name}</div>
          <div className="text-2xl opacity-60">{winner.phone}</div>
        </div>
        <div className="absolute bottom-8 opacity-40">
          <ActiveBankLogo />
        </div>
      </div>
    )
  }

  // Draw overlay (mini-sorteio)
  if (drawVisible && latestDraw) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a6b1a] to-[#004AAD] flex flex-col items-center justify-center text-white text-center p-8">
        <div className="text-6xl mb-2">🎉</div>
        <p className="text-xl opacity-70 mb-1 uppercase tracking-widest">{latestDraw.label}</p>
        <p className="text-5xl font-black mb-2">{latestDraw.winner.name}</p>
        <p className="text-2xl opacity-70">{latestDraw.winner.phone}</p>
      </div>
    )
  }

  // No active session
  if (noSession) {
    return (
      <div className="min-h-screen bg-[#00205B] flex flex-col items-center justify-center text-white gap-6">
        <ActiveBankLogo />
        <p className="text-2xl opacity-60">Aguarda o início do próximo jogo…</p>
      </div>
    )
  }

  // QR screen
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center text-white p-8">
      {/* Header */}
      <div className="mb-6 text-center">
        <ActiveBankLogo />
        <h1 className="text-2xl font-bold mt-3 tracking-widest uppercase opacity-80">
          {qr?.session_name ?? 'A carregar…'}
        </h1>
      </div>

      {/* QR Code */}
      <div className="bg-white rounded-3xl p-4 shadow-2xl mb-6">
        {qr?.qr_data_url ? (
          <img src={qr.qr_data_url} alt="QR Code" className="w-72 h-72 sm:w-96 sm:h-96" />
        ) : (
          <div className="w-72 h-72 sm:w-96 sm:h-96 animate-pulse bg-gray-100 rounded-2xl" />
        )}
      </div>

      {/* CTA */}
      <p className="text-xl font-semibold mb-1">Escaneia para participar no sorteio!</p>
      <p className="text-sm opacity-60 mb-4">Aponta a câmara do telemóvel para o código QR</p>

      {/* Stats row */}
      <div className="flex gap-8 text-center">
        <div>
          <div className="text-4xl font-black">{count}</div>
          <div className="text-xs opacity-60 uppercase tracking-wider">Participantes</div>
        </div>
        <div className="w-px bg-white opacity-20" />
        <div>
          <div className="text-4xl font-black">{countdown}s</div>
          <div className="text-xs opacity-60 uppercase tracking-wider">Expira em</div>
        </div>
      </div>
    </div>
  )
}

function ActiveBankLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-[#E8B400] flex items-center justify-center font-black text-[#00205B] text-lg">
        AB
      </div>
      <span className="text-xl font-bold tracking-tight">Active Bank</span>
    </div>
  )
}
