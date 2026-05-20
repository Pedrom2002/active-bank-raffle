'use client'

import { useCallback } from 'react'
import type { WinnerRecord, PagedResponse } from '@/lib/types'
import { RecordsTable, type Column } from './RecordsTable'

const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const columns: Column<WinnerRecord>[] = [
  { key: 'raffle_label', header: 'Sorteio', render: r => r.raffle_label },
  { key: 'winner_name', header: 'Vencedor', render: r => r.winner.name },
  { key: 'phone', header: 'Telefone', render: r => r.winner.phone },
  { key: 'email', header: 'Email', render: r => r.winner.email },
  { key: 'ends_at', header: 'Fechado em', render: r => fmt.format(new Date(r.ends_at ?? r.created_at)) },
]

export function WinnersList() {
  const fetchPage = useCallback(async ({ q, page }: { q: string; page: number }): Promise<PagedResponse<WinnerRecord>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    const res = await fetch(`/api/admin/records/winners?${params.toString()}`)
    if (!res.ok) throw new Error('fetch failed')
    return res.json()
  }, [])

  const exportHref = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const qs = params.toString()
    return `/api/admin/records/winners/export${qs ? `?${qs}` : ''}`
  }, [])

  return (
    <RecordsTable<WinnerRecord>
      columns={columns}
      fetchPage={fetchPage}
      exportHref={exportHref}
      searchPlaceholder="Pesquisar sorteio"
      rowKey={r => r.raffle_id}
    />
  )
}
