'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Image from 'next/image'
import type { Raffle, RaffleQR, Winner } from '@/lib/types'

export default function ScreenPage() {
  const [activeRaffles, setActiveRaffles] = useState<Raffle[]>([])
  const [qrMap, setQrMap] = useState<Record<string, RaffleQR>>({})
  const [winner, setWinner] = useState<Winner | null>(null)
  // Tracks winner_id per raffle from the previous poll so we can detect the
  // null → non-null transition without triggering on pre-existing winners.
  const prevWinnerIds = useRef<Map<string, string | null>>(new Map())
  const isFirstPoll = useRef(true)
  const lastReplayRaffleId = useRef<string | null>(null)
  const winnerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showWinner = useCallback((w: Winner) => {
    if (winnerTimeoutRef.current) clearTimeout(winnerTimeoutRef.current)
    setWinner(w)
    winnerTimeoutRef.current = setTimeout(() => setWinner(null), 30_000)
  }, [])

  const fetchRaffles = useCallback(async () => {
    try {
      const res = await fetch('/api/raffles')
      if (!res.ok) return
      const all: Raffle[] = await res.json()
      setActiveRaffles(all.filter(r => r.status === 'active'))

      if (isFirstPoll.current) {
        isFirstPoll.current = false
        // Snapshot current winner_ids — only future transitions trigger the overlay.
        all.forEach(r => prevWinnerIds.current.set(r.id, r.winner_id ?? null))
        return
      }

      // Show overlay when a raffle's winner_id transitions from null → non-null.
      const newlyWon = all.find(r => {
        const prev = prevWinnerIds.current.get(r.id)
        return r.winner_id && (prev === null || prev === undefined)
      })
      all.forEach(r => prevWinnerIds.current.set(r.id, r.winner_id ?? null))

      if (newlyWon) {
        const detailRes = await fetch(`/api/raffles/${newlyWon.id}`)
        if (detailRes.ok) {
          const detail = await detailRes.json()
          if (detail.raffle_participants) {
            showWinner({ raffle_id: newlyWon.id, label: newlyWon.label, ...detail.raffle_participants })
          }
        }
      }
    } catch {
      // Silently retry on next poll — screen must never crash
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

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
    async function pollReplay() {
      try {
        const res = await fetch('/api/screen/replay', { cache: 'no-store' })
        if (!res.ok) return
        const { replay } = await res.json()
        if (!replay) return
        if (lastReplayRaffleId.current === replay.raffle_id) return
        lastReplayRaffleId.current = replay.raffle_id
        showWinner(replay)
      } catch { /* silent */ }
    }
    pollReplay()
    const iv = setInterval(pollReplay, 3000)
    return () => clearInterval(iv)
  }, [showWinner])

  useEffect(() => {
    activeRafflesRef.current = activeRaffles

    // Only fetch QRs for raffles that don't have one yet.
    const newRaffles = activeRaffles.filter(r => !loadedQRIds.current.has(r.id))
    if (newRaffles.length > 0) {
      newRaffles.forEach(r => loadedQRIds.current.add(r.id))
      fetchQRs(newRaffles)
    }

    // Remove closed raffles from the loaded-ids set and from the QR map, so a
    // stale (already-expired) entry can't drive the refresh scheduler below.
    const activeIds = new Set(activeRaffles.map(r => r.id))
    loadedQRIds.current = new Set([...loadedQRIds.current].filter(id => activeIds.has(id)))
    setQrMap(prev => {
      const next: Record<string, RaffleQR> = {}
      for (const id of Object.keys(prev)) {
        if (activeIds.has(id)) next[id] = prev[id]
      }
      return Object.keys(next).length === Object.keys(prev).length ? prev : next
    })
  }, [activeRaffles, fetchQRs])

  // Refresh QR codes just after the soonest token's 120 s window rolls over.
  // Tokens expire at a fixed wall-clock instant (expires_at), NOT relative to
  // when they were fetched, so a blind fixed-interval refresh can leave a stale,
  // already-expired token on screen. Scheduling off expires_at guarantees the
  // displayed token is always within its valid window; the server's 30 s grace
  // bridges the brief handoff while the new QR is fetched and rendered.
  useEffect(() => {
    const expiries = Object.values(qrMap).map(q => q.expires_at).filter(Boolean)
    if (expiries.length === 0) return
    const soonest = Math.min(...expiries)
    // Fire ~1.5 s into the next window so we fetch a token for the new window.
    const delay = Math.max(2000, soonest - Date.now() + 1500)
    const t = setTimeout(() => {
      const raffles = activeRafflesRef.current
      if (raffles.length > 0) fetchQRs(raffles)
    }, delay)
    return () => clearTimeout(t)
  }, [qrMap, fetchQRs])

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
          <p className="text-2xl opacity-80 tabular-nums">{maskPhone(winner.phone)}</p>
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

  const single = activeRaffles.length === 1

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <ScreenHeader />
      <main
        id="main-content"
        className={
          single
            ? 'flex-1 p-6 flex items-center justify-center w-full'
            : 'flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 content-start max-w-7xl mx-auto w-full'
        }
      >
        {activeRaffles.map(raffle => {
          const qr = qrMap[raffle.id]
          const endsAt = qr?.ends_at ?? (new Date(raffle.starts_at).getTime() + raffle.duration_sec * 1000)
          return (
            <RaffleCard key={raffle.id} raffle={raffle} qr={qr} endsAt={endsAt} single={single} />
          )
        })}
      </main>
      <ScreenFooter />
    </div>
  )
}

// Isolated card component — each instance has its own countdown ticker,
// so a single setInterval drives only one card, not the entire page.
function RaffleCard({ raffle, qr, endsAt, single = false }: { raffle: Raffle; qr: RaffleQR | undefined; endsAt: number; single?: boolean }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))

  useEffect(() => {
    const iv = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)))
    }, 1000)
    return () => clearInterval(iv)
  }, [endsAt])

  // Single raffle scales the QR with the viewport (whichever of width/height is
  // the limiting dimension); the multi-card grid keeps a fixed, compact size.
  const qrSizeClass = single ? '' : 'w-56 h-56 sm:w-72 sm:h-72'
  const qrSizeStyle = single ? { width: 'min(55vh, 80vw)', height: 'min(55vh, 80vw)' } : undefined

  return (
    <div className={`bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm flex flex-col items-center text-center ${single ? 'w-auto max-w-full' : ''}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse" />
        <span className="text-xs font-medium text-[#0096DC] uppercase tracking-widest">Sorteio ativo</span>
      </div>
      <h2 className={`font-semibold tracking-tight text-[#0A0A0A] mb-5 ${single ? 'text-4xl sm:text-5xl' : 'text-3xl'}`}>{raffle.label}</h2>
      <div className="bg-[#F7F8FA] rounded-xl p-4 mb-4">
        {qr?.qr_data_url
          ? <Image src={qr.qr_data_url} alt="QR Code para participar no sorteio" width={288} height={288} unoptimized className={qrSizeClass} style={qrSizeStyle} />
          : <div className={`bg-[#E5E7EB] rounded-lg animate-pulse ${qrSizeClass}`} style={qrSizeStyle} />
        }
      </div>
      <p className={`font-semibold tabular-nums text-[#0096DC] ${single ? 'text-6xl sm:text-7xl' : 'text-5xl'}`}>{remaining}s</p>
      <p className="text-xs text-[#6B7280] mt-1 uppercase tracking-wider">Tempo restante</p>
    </div>
  )
}

// Masks a phone for public display, revealing only the last 4 digits
// (e.g. "+351912345678" → "•••• 5678"). The full number stays admin-only.
function maskPhone(phone: string | null | undefined): string {
  const digits = (phone ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return `•••• ${digits.slice(-4)}`
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
