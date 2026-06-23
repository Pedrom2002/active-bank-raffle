'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type Entry = {
  name: string
  phone: string
  email: string
  entered_at: string
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function toDay(iso: string) {
  const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000)
  return d.toISOString().slice(0, 10)
}

export default function ReportPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [generatedAt] = useState(() => new Date())

  useEffect(() => {
    fetch('/api/report/lounge', { cache: 'no-store', credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setEntries(d.entries); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  // Group by day
  const byDay = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const day = toDay(e.entered_at)
    if (!acc[day]) acc[day] = []
    acc[day].push(e)
    return acc
  }, {})
  const days = Object.keys(byDay).sort()

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-[#6B7280]">
      A carregar relatório…
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center text-red-600">
      Erro ao carregar dados. Verifica sessão admin.
    </div>
  )

  return (
    <>
      <div className="min-h-screen bg-white font-sans text-[#0A0A0A]">

        {/* Print button */}
        <div className="no-print fixed top-4 right-4 z-50">
          <button
            onClick={() => window.print()}
            className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition-colors shadow-lg"
          >
            Exportar PDF
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-8 py-10">

          {/* Cover */}
          <div className="mb-10 pb-8 border-b-2 border-[#0096DC]">
            <div className="flex items-start justify-between mb-8">
              <Image src="/logo_activobank.svg" alt="ActivoBank" width={160} height={26} />
              <div className="text-right">
                <p className="text-xs text-[#6B7280] uppercase tracking-wider">Documento Confidencial</p>
                <p className="text-xs text-[#6B7280] mt-0.5">
                  Gerado em {generatedAt.toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <h1 className="text-3xl font-bold text-[#0A0A0A] mb-1">Relatório de Leads — ActivoBank Lounge</h1>
            <p className="text-[#6B7280] text-base mb-6">FIFA World Cup 2026 · GoalFest · Lisboa</p>

            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#F7F8FA] rounded-xl p-4 text-center">
                <span className="block text-3xl font-bold text-[#0096DC]">{entries.length}</span>
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-1 block">Total Leads Lounge</span>
              </div>
              <div className="bg-[#F7F8FA] rounded-xl p-4 text-center">
                <span className="block text-3xl font-bold text-[#0096DC]">{days.length}</span>
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-1 block">Dias de Evento</span>
              </div>
              <div className="bg-[#F7F8FA] rounded-xl p-4 text-center">
                <span className="block text-3xl font-bold text-[#0096DC]">
                  {days.length > 0 ? Math.round(entries.length / days.length) : 0}
                </span>
                <span className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mt-1 block">Média por Dia</span>
              </div>
            </div>
          </div>

          {/* Per-day tables */}
          {days.map(day => (
            <div key={day} className="day-section mb-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-[#0A0A0A] capitalize">{fmtDay(`${day}T12:00:00Z`)}</h2>
                <span className="text-sm font-semibold text-[#0096DC] bg-[#0096DC]/10 px-3 py-1 rounded-full">
                  {byDay[day].length} leads
                </span>
              </div>

              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-[#0096DC] text-white">
                    <th className="text-left font-semibold px-3 py-2 rounded-tl-lg">#</th>
                    <th className="text-left font-semibold px-3 py-2">Nome</th>
                    <th className="text-left font-semibold px-3 py-2">Telefone</th>
                    <th className="text-left font-semibold px-3 py-2">Email</th>
                    <th className="text-left font-semibold px-3 py-2 rounded-tr-lg">Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {byDay[day].map((e, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F7F8FA]'}>
                      <td className="px-3 py-2 text-[#6B7280] tabular-nums">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{e.name}</td>
                      <td className="px-3 py-2 text-[#6B7280] tabular-nums">{e.phone}</td>
                      <td className="px-3 py-2 text-[#6B7280]">{e.email}</td>
                      <td className="px-3 py-2 text-[#6B7280] tabular-nums whitespace-nowrap">
                        {new Date(e.entered_at).toLocaleTimeString('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {/* Footer */}
          <div className="mt-10 pt-6 border-t border-[#E5E7EB] flex items-center justify-between">
            <Image src="/logo_activobank.svg" alt="ActivoBank" width={100} height={16} />
            <p className="text-xs text-[#6B7280]">
              Documento gerado automaticamente · Uso interno · Confidencial
            </p>
          </div>

        </div>
      </div>
    </>
  )
}
