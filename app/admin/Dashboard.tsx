'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Raffle, RaffleParticipant as Participant, Toast } from '@/lib/types'
import { usePolling } from '@/lib/hooks'
import { CreateRaffleForm } from './CreateRaffleForm'
import { RaffleList } from './RaffleList'

const ARCHIVE_KEY = 'admin_archived_raffles'

function loadArchived(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVE_KEY) ?? '[]')) } catch { return new Set() }
}
function saveArchived(ids: Set<string>) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify([...ids]))
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({})
  const [winners, setWinners] = useState<Record<string, { name: string; phone: string }>>({})
  const [drawingId, setDrawingId] = useState<string | null>(null)
  const [redrawingId, setRedrawingId] = useState<string | null>(null)
  // Tracks the winner_id we last fetched details for, per raffle, so a redraw
  // (winner_id changes) re-fetches the name while unchanged winners don't.
  const fetchedWinnerIds = useRef(new Map<string, string>())
  const [archived, setArchived] = useState<Set<string>>(new Set())
  const [showArchive, setShowArchive] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastTimeouts = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  useEffect(() => { setArchived(loadArchived()) }, [])

  useEffect(() => {
    const timeouts = toastTimeouts.current
    return () => { timeouts.forEach(tid => clearTimeout(tid)) }
  }, [])

  const archive = useCallback((id: string) => {
    setArchived(prev => { const next = new Set(prev); next.add(id); saveArchived(next); return next })
  }, [])

  const unarchive = useCallback((id: string) => {
    setArchived(prev => { const next = new Set(prev); next.delete(id); saveArchived(next); return next })
  }, [])

  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, kind, text }])
    const tid = setTimeout(() => {
      setToasts(t => t.filter(x => x.id !== id))
      toastTimeouts.current.delete(id)
    }, 4000)
    toastTimeouts.current.set(id, tid)
  }, [])

  const fetchParticipants = useCallback(async (activeIds: string[]) => {
    if (activeIds.length === 0) return
    try {
      const results = await Promise.all(
        activeIds.map(async id => {
          const res = await fetch(`/api/raffles/${id}/participants`)
          if (!res.ok) return [id, []] as const
          const data: Participant[] = await res.json()
          return [id, data] as const
        })
      )
      setParticipants(prev => ({ ...prev, ...Object.fromEntries(results) }))
    } catch { /* retry on next poll */ }
  }, [])

  const fetchWinners = useCallback(async (wonRaffles: Raffle[]) => {
    // Only fetch raffles whose current winner_id we haven't resolved yet.
    const stale = wonRaffles.filter(r => r.winner_id && fetchedWinnerIds.current.get(r.id) !== r.winner_id)
    if (stale.length === 0) return
    try {
      const results = await Promise.all(
        stale.map(async r => {
          const res = await fetch(`/api/raffles/${r.id}`)
          if (!res.ok) return null
          const detail = await res.json()
          const w = detail.raffle_participants as { name: string; phone: string } | null
          if (!w) return null
          fetchedWinnerIds.current.set(r.id, r.winner_id!)
          return [r.id, { name: w.name, phone: w.phone }] as const
        })
      )
      const entries = results.filter((e): e is NonNullable<typeof e> => e !== null)
      if (entries.length > 0) setWinners(prev => ({ ...prev, ...Object.fromEntries(entries) }))
    } catch { /* retry on next poll */ }
  }, [])

  const fetchRaffles = useCallback(async () => {
    try {
      const res = await fetch('/api/raffles')
      if (res.ok) {
        const data: Raffle[] = await res.json()
        setRaffles(data)
        fetchParticipants(data.filter(r => r.status === 'active').map(r => r.id))
        fetchWinners(data.filter(r => r.status === 'closed' && r.winner_id))
      }
    } catch { /* retry on next poll */ }
  }, [fetchParticipants, fetchWinners])

  usePolling(fetchRaffles, 4000)

  async function closeRaffle(id: string) {
    try {
      const res = await fetch(`/api/raffles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      })
      if (res.ok) { pushToast('info', 'Sorteio encerrado'); fetchRaffles() }
      else pushToast('error', 'Erro ao encerrar')
    } catch {
      pushToast('error', 'Erro de ligação. Tenta de novo.')
    }
  }

  async function drawWinner(id: string, raffleLabel: string) {
    setDrawingId(id)
    try {
      // Close the raffle first if it is still active
      if (raffles.find(r => r.id === id)?.status === 'active') {
        const closeRes = await fetch(`/api/raffles/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'close' }),
        })
        if (!closeRes.ok) {
          pushToast('error', 'Erro ao encerrar sorteio')
          return
        }
      }

      const res = await fetch(`/api/raffles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'draw' }),
      })
      if (res.ok) {
        const d = await res.json()
        pushToast('success', `Vencedor de "${raffleLabel}": ${d.winner.name}`)
        fetchRaffles()
      } else {
        const d = await res.json()
        pushToast('error', d.error ?? 'Erro no sorteio')
      }
    } catch {
      pushToast('error', 'Erro de ligação. Tenta de novo.')
    } finally {
      setDrawingId(null)
    }
  }

  async function redrawWinner(id: string, label: string) {
    if (!confirm(`Marcar o vencedor de "${label}" como ausente e sortear novamente?`)) return
    setRedrawingId(id)
    try {
      const res = await fetch(`/api/raffles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'redraw' }),
      })
      if (res.ok) {
        const d = await res.json()
        pushToast('success', `Novo vencedor de "${label}": ${d.winner.name}`)
        fetchRaffles()
      } else {
        const d = await res.json().catch(() => ({}))
        pushToast('error', d.error ?? 'Erro ao sortear novamente')
      }
    } catch {
      pushToast('error', 'Erro de ligação. Tenta de novo.')
    } finally {
      setRedrawingId(null)
    }
  }

  async function replayWinner(id: string, label: string) {
    try {
      const res = await fetch('/api/admin/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raffle_id: id, label }),
      })
      if (res.ok) pushToast('info', `Vencedor de "${label}" enviado para o ecrã`)
      else pushToast('error', 'Erro ao enviar para o ecrã')
    } catch {
      pushToast('error', 'Erro de ligação.')
    }
  }

  const activeRaffles = raffles.filter(r => r.status === 'active')
  const closedRaffles = raffles.filter(r => r.status === 'closed')
  const visibleClosed = closedRaffles.filter(r => !archived.has(r.id))
  const archivedRaffles = closedRaffles.filter(r => archived.has(r.id))

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <CreateRaffleForm onCreated={fetchRaffles} onToast={pushToast} />
        <RaffleList
          activeRaffles={activeRaffles}
          closedWithoutWinner={visibleClosed.filter(r => !r.winner_id)}
          closedWithWinner={visibleClosed.filter(r => !!r.winner_id)}
          archivedRaffles={archivedRaffles}
          participants={participants}
          winners={winners}
          drawingId={drawingId}
          redrawingId={redrawingId}
          showArchive={showArchive}
          onToggleArchive={() => setShowArchive(v => !v)}
          onDraw={drawWinner}
          onRedraw={redrawWinner}
          onClose={closeRaffle}
          onReplay={replayWinner}
          onArchive={archive}
          onUnarchive={unarchive}
        />
      </main>

      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-sm ${t.kind === 'success' ? 'bg-[#0096DC] text-white' : t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-white border border-[#E5E7EB] text-[#0A0A0A]'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}
