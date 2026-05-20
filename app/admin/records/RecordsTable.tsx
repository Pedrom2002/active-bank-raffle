'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PagedResponse } from '@/lib/types'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => React.ReactNode
}

type Props<T> = {
  columns: Column<T>[]
  fetchPage: (params: { q: string; page: number }) => Promise<PagedResponse<T>>
  exportHref: (q: string) => string
  searchPlaceholder?: string
  extraToolbar?: React.ReactNode
  rowKey: (row: T) => string
}

const PAGE_SIZE = 50

export function RecordsTable<T>({
  columns,
  fetchPage,
  exportHref,
  searchPlaceholder = 'Pesquisar nome, telefone, email',
  extraToolbar,
  rowKey,
}: Props<T>) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 300)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPage({ q: debouncedQ, page })
      setRows(res.rows)
      setTotal(res.total)
    } catch {
      setError('Erro a carregar registos.')
    } finally {
      setLoading(false)
    }
  }, [fetchPage, debouncedQ, page])

  useEffect(() => { load() }, [load])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const exportUrl = useMemo(() => exportHref(debouncedQ), [exportHref, debouncedQ])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#0096DC]/30"
        />
        {extraToolbar}
        <a
          href={exportUrl}
          className="text-xs font-medium text-[#0096DC] hover:text-[#0064B4] border border-[#0096DC]/40 hover:border-[#0064B4] px-3 py-2 rounded-lg transition-colors"
        >
          Exportar CSV
        </a>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error} <button onClick={load} className="underline ml-2">tentar de novo</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F8FA] text-[#6B7280]">
            <tr>
              {columns.map(c => (
                <th key={c.key} className="text-left font-medium px-3 py-2">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[#6B7280]">A carregar…</td></tr>
            )}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[#6B7280]">Sem registos.</td></tr>
            )}
            {rows.map(r => (
              <tr key={rowKey(r)} className="border-t border-[#E5E7EB]">
                {columns.map(c => (
                  <td key={c.key} className="px-3 py-2 align-top">{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[#6B7280]">
        <span>{total} registos</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40"
          >Anterior</button>
          <span>Página {page} / {lastPage}</span>
          <button
            disabled={page >= lastPage || loading}
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40"
          >Seguinte</button>
        </div>
      </div>
    </div>
  )
}
