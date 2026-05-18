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

export function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({})
  const [drawingId, setDrawingId] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
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

  const fetchRaffles = useCallback(async () => {
    try {
      const res = await fetch('/api/raffles')
      if (res.ok) {
        setOffline(false)
        const data: Raffle[] = await res.json()
        setRaffles(data)
        fetchParticipants(data.filter(r => r.status === 'active').map(r => r.id))
      } else {
        setOffline(true)
      }
    } catch {
      setOffline(true)
    }
  }, [fetchParticipants])

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
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
          <div className="flex items-center gap-3">
            {offline && (
              <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-lg">
                Sem ligação
              </span>
            )}
            <a href="/screen" target="_blank" rel="noreferrer"
              className="text-xs font-medium text-[#0096DC] hover:text-[#0064B4] px-3 py-1.5 rounded-lg hover:bg-[#0096DC]/5 transition-colors">
              Ecrã TV
            </a>
            <button onClick={onLogout}
              className="text-xs text-[#6B7280] hover:text-[#0A0A0A] px-3 py-1.5 rounded-lg hover:bg-[#F7F8FA] transition-colors">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <CreateRaffleForm onCreated={fetchRaffles} onToast={pushToast} />
        <RaffleList
          activeRaffles={activeRaffles}
          closedWithoutWinner={visibleClosed.filter(r => !r.winner_id)}
          closedWithWinner={visibleClosed.filter(r => !!r.winner_id)}
          archivedRaffles={archivedRaffles}
          participants={participants}
          drawingId={drawingId}
          showArchive={showArchive}
          onToggleArchive={() => setShowArchive(v => !v)}
          onDraw={drawWinner}
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
