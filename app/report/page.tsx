'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type Entry = {
  name: string
  phone: string
  email: string
  entered_at: string
}

const TEST_PHONES = new Set(['930123456', '9306123456'])

export default function ReportPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [rawCount, setRawCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [generatedAt] = useState(() => new Date())

  useEffect(() => {
    fetch('/api/report/lounge/data', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        const raw: Entry[] = d.entries

        // Remove test entries
        const filtered = raw.filter(e => !TEST_PHONES.has(e.phone.replace(/\s/g, '')))

        setRawCount(filtered.length)

        // Deduplicate by email (case-insensitive), keep earliest entry
        const seen = new Map<string, Entry>()
        for (const e of filtered) {
          const key = e.email.toLowerCase().trim()
          if (!seen.has(key)) seen.set(key, e)
        }

        // Sort by name
        const deduped = [...seen.values()].sort((a, b) =>
          a.name.localeCompare(b.name, 'pt')
        )

        setEntries(deduped)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  useEffect(() => {
    if (!loading && !error && entries.length > 0) {
      setTimeout(() => window.print(), 600)
    }
  }, [loading, error, entries.length])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-[#6B7280] text-sm">
      A preparar relatório…
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-600 text-sm">
      Erro ao carregar dados.
    </div>
  )

  const days = new Set(entries.map(e => {
    const d = new Date(new Date(e.entered_at).getTime() + 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  })).size

  return (
    <div className="bg-white font-sans text-[#0A0A0A]">
      <div className="max-w-4xl mx-auto px-10 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-10 pb-6 border-b-2 border-[#0096DC]">
          <div>
            <Image src="/logo_activobank.svg" alt="ActivoBank" width={160} height={26} className="mb-4" />
            <h1 className="text-2xl font-bold text-[#0A0A0A]">Relatório de Leads — ActivoBank Lounge</h1>
            <p className="text-sm text-[#6B7280] mt-1">FIFA World Cup 2026 · GoalFest · Lisboa</p>
          </div>
          <div className="text-right text-xs text-[#6B7280] mt-1">
            <p className="uppercase tracking-wider font-semibold">Documento Confidencial</p>
            <p className="mt-1">Gerado em {generatedAt.toLocaleString('pt-PT', {
              timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit',
              year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}</p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="border border-[#E5E7EB] rounded-xl p-5 text-center">
            <span className="block text-4xl font-bold text-[#0096DC]">{entries.length}</span>
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-2 block">Leads Únicos</span>
          </div>
          <div className="border border-[#E5E7EB] rounded-xl p-5 text-center">
            <span className="block text-4xl font-bold text-[#0096DC]">{rawCount}</span>
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-2 block">Total Registos</span>
          </div>
          <div className="border border-[#E5E7EB] rounded-xl p-5 text-center">
            <span className="block text-4xl font-bold text-[#0096DC]">{days}</span>
            <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-2 block">Dias de Evento</span>
          </div>
        </div>

        {/* Leads table */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#0096DC', color: 'white' }}>
              <th className="text-left font-semibold px-3 py-2.5" style={{ width: 36 }}>#</th>
              <th className="text-left font-semibold px-3 py-2.5">Nome</th>
              <th className="text-left font-semibold px-3 py-2.5">Telefone</th>
              <th className="text-left font-semibold px-3 py-2.5">Email</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#ffffff' : '#F7F8FA' }}>
                <td className="px-3 py-2 text-[#9CA3AF] tabular-nums">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{e.name}</td>
                <td className="px-3 py-2 text-[#6B7280] tabular-nums">{e.phone}</td>
                <td className="px-3 py-2 text-[#6B7280]">{e.email}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-[#E5E7EB] flex items-center justify-between">
          <Image src="/logo_activobank.svg" alt="ActivoBank" width={90} height={15} />
          <p className="text-xs text-[#6B7280]">Documento gerado automaticamente · Uso interno · Confidencial</p>
        </div>

      </div>
    </div>
  )
}
