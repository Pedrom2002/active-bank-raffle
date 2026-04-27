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

  useEffect(() => { fetchQR() }, [fetchQR])

  useEffect(() => {
    if (!qr) return
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((qr.expires_at - Date.now()) / 1000))
      setCountdown(remaining)
      if (remaining <= 1) fetchQR()
    }, 1000)
    return () => clearInterval(interval)
  }, [qr, fetchQR])

  useEffect(() => {
    if (!qr?.session_id) return
    fetchCount(qr.session_id)
    const interval = setInterval(() => fetchCount(qr.session_id), 5000)
    return () => clearInterval(interval)
  }, [qr?.session_id, fetchCount])

  useEffect(() => {
    const interval = setInterval(fetchWinner, 3000)
    return () => clearInterval(interval)
  }, [fetchWinner])

  useEffect(() => {
    if (!qr?.session_id) return
    fetchLatestDraw()
    const interval = setInterval(fetchLatestDraw, 3000)
    return () => clearInterval(interval)
  }, [qr?.session_id, fetchLatestDraw])

  // ── Final winner ──
  if (winner) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ScreenHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-8 text-center animate-fade-in-up">
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-[#0096DC] mb-6">
            Vencedor do sorteio
          </p>
          <h1 className="text-7xl sm:text-8xl font-semibold tracking-tight text-[#0A0A0A] mb-4">
            {winner.name}
          </h1>
          <p className="text-2xl text-[#6B7280] tabular-nums">{winner.phone}</p>
          <div className="mt-12 h-1 w-24 bg-[#0096DC] rounded-full" />
        </main>
        <ScreenFooter />
      </div>
    )
  }

  // ── Per-draw overlay ──
  if (drawVisible && latestDraw) {
    return (
      <div className="min-h-screen bg-[#0096DC] flex flex-col">
        <header className="px-8 py-6">
          <ActiveBankLogo invert />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center px-8 text-center text-white animate-fade-in-up">
          <p className="text-sm font-medium tracking-[0.3em] uppercase opacity-80 mb-6">
            {latestDraw.label}
          </p>
          <h1 className="text-7xl sm:text-8xl font-semibold tracking-tight mb-4">
            {latestDraw.winner.name}
          </h1>
          <p className="text-2xl opacity-80 tabular-nums">{latestDraw.winner.phone}</p>
        </main>
        <footer className="px-8 py-4 text-center text-white/60 text-xs">
          Fan Zone · Mundial 2026
        </footer>
      </div>
    )
  }

  // ── No active session ──
  if (noSession) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ScreenHeader />
        <main className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-2 h-2 rounded-full bg-[#0096DC] mb-6 animate-pulse-dot" />
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A] mb-2">
            Aguardar próximo jogo
          </h1>
          <p className="text-[#6B7280]">A equipa ActivoBank irá iniciar a sessão em breve.</p>
        </main>
        <ScreenFooter />
      </div>
    )
  }

  // ── QR / participation screen ──
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ScreenHeader />

      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 px-8 py-10 max-w-7xl mx-auto w-full">
        {/* Left: Title + CTA */}
        <div className="flex-1 text-center lg:text-left max-w-xl">
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-[#0096DC] mb-4">
            Sorteio Fan Zone
          </p>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight text-[#0A0A0A] leading-[1.05] mb-4">
            {qr?.session_name ?? 'A carregar…'}
          </h1>
          <p className="text-xl text-[#6B7280] mb-10 leading-relaxed">
            Aponta a câmara do telemóvel para o código QR e participa no sorteio.
          </p>

          <div className="grid grid-cols-2 gap-6 max-w-sm mx-auto lg:mx-0">
            <Stat label="Participantes" value={count.toString()} />
            <Stat label="Expira em" value={`${countdown}s`} />
          </div>
        </div>

        {/* Right: QR */}
        <div className="flex-shrink-0">
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
            {qr?.qr_data_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.qr_data_url} alt="QR Code" className="w-80 h-80 sm:w-[420px] sm:h-[420px]" />
            ) : (
              <div className="w-80 h-80 sm:w-[420px] sm:h-[420px] animate-pulse bg-gray-100 rounded-xl" />
            )}
          </div>
        </div>
      </main>

      <ScreenFooter />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-5xl font-semibold tracking-tight text-[#0A0A0A] tabular-nums">
        {value}
      </div>
      <div className="text-xs text-[#6B7280] uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  )
}

function ScreenHeader() {
  return (
    <header className="border-b border-[#E5E7EB] px-8 py-5 flex items-center justify-between">
      <ActiveBankLogo />
      <span className="text-xs text-[#6B7280] uppercase tracking-[0.2em]">
        Fan Zone · Mundial 2026
      </span>
    </header>
  )
}

function ScreenFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] px-8 py-4 text-center">
      <p className="text-xs text-[#6B7280]">
        Sorteio promovido pelo ActivoBank · Participação gratuita
      </p>
    </footer>
  )
}

function ActiveBankLogo({ invert = false }: { invert?: boolean }) {
  const text = invert ? 'text-white' : 'text-[#0A0A0A]'
  const dot = invert ? 'bg-white' : 'bg-[#0096DC]'
  const dotText = invert ? 'text-[#0096DC]' : 'text-white'
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-full ${dot} flex items-center justify-center`}>
        <span className={`${dotText} font-bold text-sm`}>A</span>
      </div>
      <span className={`text-lg font-semibold tracking-tight ${text}`}>
        ActivoBank
      </span>
    </div>
  )
}
