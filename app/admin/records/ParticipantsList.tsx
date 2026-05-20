'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ParticipantRecord, PagedResponse, Raffle } from '@/lib/types'
import { RecordsTable, type Column } from './RecordsTable'

const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const columns: Column<ParticipantRecord>[] = [
  { key: 'raffle_label', header: 'Sorteio', render: r => r.raffle_label || '—' },
  { key: 'name', header: 'Nome', render: r => r.name },
  { key: 'phone', header: 'Telefone', render: r => r.phone },
  { key: 'email', header: 'Email', render: r => r.email },
  { key: 'registered_at', header: 'Registado em', render: r => fmt.format(new Date(r.registered_at)) },
]

export function ParticipantsList() {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [raffleId, setRaffleId] = useState<string>('')

  useEffect(() => {
    fetch('/api/raffles').then(r => r.ok ? r.json() : []).then(setRaffles).catch(() => setRaffles([]))
  }, [])

  const fetchPage = useCallback(async ({ q, page }: { q: string; page: number }): Promise<PagedResponse<ParticipantRecord>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    if (raffleId) params.set('raffle_id', raffleId)
    const res = await fetch(`/api/admin/records/participants?${params.toString()}`)
    if (!res.ok) throw new Error('fetch failed')
    return res.json()
  }, [raffleId])

  const exportHref = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (raffleId) params.set('raffle_id', raffleId)
    const qs = params.toString()
    return `/api/admin/records/participants/export${qs ? `?${qs}` : ''}`
  }, [raffleId])

  const extraToolbar = (
    <select
      value={raffleId}
      onChange={e => setRaffleId(e.target.value)}
      className="px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white"
    >
      <option value="">Todos os sorteios</option>
      {raffles.map(r => (<option key={r.id} value={r.id}>{r.label}</option>))}
    </select>
  )

  return (
    <RecordsTable<ParticipantRecord>
      key={raffleId || 'all'}
      columns={columns}
      fetchPage={fetchPage}
      exportHref={exportHref}
      extraToolbar={extraToolbar}
      rowKey={r => r.id}
    />
  )
}
