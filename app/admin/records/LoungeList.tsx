'use client'

import { useCallback } from 'react'
import type { LoungeEntrant, PagedResponse } from '@/lib/types'
import { RecordsTable, type Column } from './RecordsTable'

const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const columns: Column<LoungeEntrant>[] = [
  { key: 'name', header: 'Nome', render: r => r.name },
  { key: 'phone', header: 'Telefone', render: r => r.phone },
  { key: 'email', header: 'Email', render: r => r.email },
  { key: 'entered_at', header: 'Entrou em', render: r => fmt.format(new Date(r.entered_at)) },
]

export function LoungeList() {
  const fetchPage = useCallback(async ({ q, page }: { q: string; page: number }): Promise<PagedResponse<LoungeEntrant>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    const res = await fetch(`/api/admin/records/lounge?${params.toString()}`)
    if (!res.ok) throw new Error('fetch failed')
    return res.json()
  }, [])

  const exportHref = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const qs = params.toString()
    return `/api/admin/records/lounge/export${qs ? `?${qs}` : ''}`
  }, [])

  return (
    <RecordsTable<LoungeEntrant>
      columns={columns}
      fetchPage={fetchPage}
      exportHref={exportHref}
      rowKey={r => r.id}
    />
  )
}
