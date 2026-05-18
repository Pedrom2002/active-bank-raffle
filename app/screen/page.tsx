'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import type { Raffle, RaffleQR, Winner } from '@/lib/types'

export default function ScreenPage() {
  const [activeRaffles, setActiveRaffles] = useState<Raffle[]>([])
  const [qrMap, setQrMap] = useState<Record<string, RaffleQR>>({})
  const [winner, setWinner] = useState<Winner | null>(null)
  // Raffle IDs whose winner overlay has already been triggered this session.
  const shownWinners = useRef<Set<string>>(new Set())
  // On the very first poll we seed shownWinners with all already-closed
  // raffles so stale winners from before the screen loaded are never shown.
  const isFirstPoll = useRef(true)

  const fetchRaffles = useCallback(async () => {
    try {
      const res = await fetch('/api/raffles')
      if (!res.ok) return
      const all: Raffle[] = await res.json()
      setActiveRaffles(all.filter(r => r.status === 'active'))

      if (isFirstPoll.current) {
        isFirstPoll.current = false
        all.filter(r => r.status === 'closed').forEach(r => shownWinners.current.add(r.id))
        return
      }

      // Show overlay only for a newly-closed raffle with a winner that we
      // have not displayed yet this session.
      const unseen = all.find(
        r => r.status === 'closed' && r.winner_id && !shownWinners.current.has(r.id)
      )
      if (unseen) {
        shownWinners.current.add(unseen.id)
        const detailRes = await fetch(`/api/raffles/${unseen.id}`)
        if (detailRes.ok) {
          const detail = await detailRes.json()
          if (detail.raffle_participants) {
            setWinner({ raffle_id: unseen.id, label: unseen.label, ...detail.raffle_participants })
            setTimeout(() => setWinner(null), 12_000)
          }
        }
      }
    } catch {
      // Silently retry on next poll — screen must never crash
    }
  }, [])

  // Ref keeps active raffles accessible in intervals without stale closure issues.
  const activeRafflesRef = useRef<Raffle[]>([])
  // Tracks which raffle IDs already have a QR loaded so we don't re-fetch on
  // every 3 s raffle-status poll (only fetch for genuinely new raffles).
  const loadedQRIds = useRef<Set<string>>(new Set())

  const fetchQRs = useCallback(async (raffles: Raffle[]) => {
    const entries = await Promise.all(
      raffles.map(async r => {
        try {
          // no-store ensures we always get a fresh token from the server,
          // bypassing browser and CDN caches that could serve an expired token.
          const res = await fetch(`/api/raffles/${r.id}/qr`, { cache: 'no-store' })
          if (!res.ok) return null
          const data: RaffleQR = await res.json()
          return [r.id, data] as const
        } catch {
          return null
        }
      })
    )
    setQrMap(prev => {
      const next = { ...prev }
      for (const entry of entries) {
        if (entry) next[entry[0]] = entry[1]
      }
      return next
    })
  }, [])

  useEffect(() => {
    fetchRaffles()
    const iv = setInterval(fetchRaffles, 3000)
    return () => clearInterval(iv)
  }, [fetchRaffles])

  useEffect(() => {
    activeRafflesRef.current = activeRaffles

    // Only fetch QRs for raffles that don't have one yet.
    const newRaffles = activeRaffles.filter(r => !loadedQRIds.current.has(r.id))
    if (newRaffles.length > 0) {
      newRaffles.forEach(r => loadedQRIds.current.add(r.id))
      fetchQRs(newRaffles)
    }

    // Remove closed raffles from the loaded-ids set.
    const activeIds = new Set(activeRaffles.map(r => r.id))
    loadedQRIds.current = new Set([...loadedQRIds.current].filter(id => activeIds.has(id)))
  }, [activeRaffles, fetchQRs])

  // Refresh ALL QR codes every 90 s so the displayed token is always from the
  // current 120 s window, well before the 30 s grace period can expire.
  useEffect(() => {
    const iv = setInterval(() => {
      const raffles = activeRafflesRef.current
      if (raffles.length > 0) fetchQRs(raffles)
    }, 90_000)
    return () => clearInterval(iv)
  }, [fetchQRs])

  if (winner) {
    return (
      <div className="min-h-screen bg-[#0096DC] flex flex-col text-white">
        <header className="px-8 py-5">
          <Image src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} className="brightness-0 invert" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-8">
          <p className="text-sm font-medium tracking-[0.3em] uppercase opacity-80 mb-4">{winner.label}</p>
          <div className="text-6xl mb-6" aria-hidden>🏆</div>
          <h1 className="text-7xl sm:text-8xl font-semibold tracking-tight mb-3">{winner.name}</h1>
          <p className="text-2xl opacity-80 tabular-nums">{winner.phone}</p>
        </main>
        <footer className="px-8 py-4 text-center text-white/60 text-xs">Fan Zone · Mundial 2026</footer>
      </div>
    )
  }

  if (activeRaffles.length === 0) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <ScreenHeader />
        <main id="main-content" className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-3 h-3 rounded-full bg-[#0096DC] mb-8 animate-pulse" />
          <h1 className="text-4xl font-semibold tracking-tight text-[#0A0A0A] mb-3">
            Os sorteios aparecem aqui
          </h1>
          <p className="text-[#6B7280] text-lg max-w-md">
            Quando um sorteio for ativado, o QR code aparece neste ecrã. Fique atento!
          </p>
        </main>
        <ScreenFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ScreenHeader />
      <main id="main-content" className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 content-start max-w-7xl mx-auto w-full">
        {activeRaffles.map(raffle => {
          const qr = qrMap[raffle.id]
          const endsAt = qr?.ends_at ?? (new Date(raffle.starts_at).getTime() + raffle.duration_sec * 1000)
          return (
            <RaffleCard key={raffle.id} raffle={raffle} qr={qr} endsAt={endsAt} />
          )
        })}
      </main>
      <ScreenFooter />
    </div>
  )
}

// Isolated card component — each instance has its own countdown ticker,
// so a single setInterval drives only one card, not the entire page.
function RaffleCard({ raffle, qr, endsAt }: { raffle: Raffle; qr: RaffleQR | undefined; endsAt: number }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))

  useEffect(() => {
    const iv = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(iv)
  }, [endsAt])

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse" />
        <span className="text-xs font-medium text-[#0096DC] uppercase tracking-widest">Sorteio ativo</span>
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-[#0A0A0A] mb-5">{raffle.label}</h2>
      <div className="bg-[#F7F8FA] rounded-xl p-4 mb-4">
        {qr?.qr_data_url
          ? <Image src={qr.qr_data_url} alt="QR Code para participar no sorteio" width={288} height={288} unoptimized className="w-56 h-56 sm:w-72 sm:h-72" />
          : <div className="w-56 h-56 sm:w-72 sm:h-72 bg-[#E5E7EB] rounded-lg animate-pulse" />
        }
      </div>
      <p className="text-5xl font-semibold tabular-nums text-[#0096DC]">{remaining}s</p>
      <p className="text-xs text-[#6B7280] mt-1 uppercase tracking-wider">Tempo restante</p>
    </div>
  )
}

function ScreenHeader() {
  return (
    <header className="border-b border-[#E5E7EB] px-8 py-5 flex items-center justify-between">
      <Image src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
      <span className="text-xs text-[#6B7280] uppercase tracking-[0.2em]">Fan Zone · Mundial 2026</span>
    </header>
  )
}

function ScreenFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] px-8 py-4 text-center">
      <p className="text-xs text-[#6B7280]">Sorteio promovido pelo ActivoBank · Participação gratuita</p>
    </footer>
  )
}
