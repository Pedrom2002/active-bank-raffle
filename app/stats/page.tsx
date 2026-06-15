'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'

type DayStat = {
  date: string
  raffles: number
  participants: number
  lounge: number
}

type Stats = {
  totalParticipants: number
  totalLounge: number
  byDay: DayStat[]
}

const DAY_LABELS: Record<string, string> = {
  '2026-06-11': '11 Jun',
  '2026-06-12': '12 Jun',
  '2026-06-13': '13 Jun',
  '2026-06-14': '14 Jun',
  '2026-06-15': '15 Jun',
  '2026-06-16': '16 Jun',
  '2026-06-17': '17 Jun',
  '2026-06-18': '18 Jun',
}

function fmtDate(iso: string): string {
  return DAY_LABELS[iso] ?? new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' })
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 sm:p-8 flex flex-col items-center text-center">
      <span className="text-6xl sm:text-7xl font-bold tabular-nums text-[#0096DC] tracking-tight">
        {value.toLocaleString('pt-PT')}
      </span>
      <span className="mt-3 text-sm font-semibold text-[#0A0A0A] uppercase tracking-wider">{label}</span>
      {sub && <span className="mt-1 text-xs text-[#6B7280]">{sub}</span>}
    </div>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' })
      if (!res.ok) { setError(true); return }
      setStats(await res.json())
      setLastUpdated(new Date())
      setError(false)
    } catch {
      setError(true)
    }
  }, [])

  useEffect(() => {
    load()

    // Schedule next load at midnight Lisbon time (UTC+1)
    function msUntilMidnight() {
      const now = new Date()
      const lisbon = new Date(now.getTime() + 60 * 60 * 1000)
      const next = new Date(lisbon)
      next.setUTCHours(23, 0, 0, 0) // 23:00 UTC = 00:00 Lisbon
      if (next <= lisbon) next.setUTCDate(next.getUTCDate() + 1)
      return next.getTime() - now.getTime()
    }

    let timer: ReturnType<typeof setTimeout>
    function scheduleNext() {
      timer = setTimeout(() => { load(); scheduleNext() }, msUntilMidnight())
    }
    scheduleNext()
    return () => clearTimeout(timer)
  }, [load])

  // Filter to only days with any activity
  const activeDays = (stats?.byDay ?? []).filter(d => d.raffles > 0 || d.participants > 0 || d.lounge > 0)

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <header className="bg-white border-b border-[#E5E7EB] px-6 sm:px-10 py-4 flex items-center justify-between">
        <Image src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
        <span className="text-xs text-[#6B7280] uppercase tracking-[0.2em]">Fan Zone · Mundial 2026</span>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            Erro ao carregar dados. A tentar de novo…
          </div>
        )}

        {/* Totals */}
        <section>
          <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-4 px-1">Total acumulado</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Participantes nos sorteios"
              value={stats?.totalParticipants ?? 0}
              sub="inscrições em todos os sorteios"
            />
            <StatCard
              label="Registos no Lounge"
              value={stats?.totalLounge ?? 0}
              sub="entradas na Fan Zone"
            />
          </div>
        </section>

        {/* Per-day breakdown */}
        {activeDays.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-4 px-1">Por dia de jogo</h2>
            <div className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[#F7F8FA]">
                  <tr>
                    <th className="text-left font-semibold text-[#6B7280] px-5 py-3 uppercase tracking-wider text-xs">Dia</th>
                    <th className="text-right font-semibold text-[#6B7280] px-5 py-3 uppercase tracking-wider text-xs">Sorteios</th>
                    <th className="text-right font-semibold text-[#6B7280] px-5 py-3 uppercase tracking-wider text-xs">Participantes</th>
                    <th className="text-right font-semibold text-[#6B7280] px-5 py-3 uppercase tracking-wider text-xs">Lounge</th>
                  </tr>
                </thead>
                <tbody>
                  {activeDays.map((d, i) => (
                    <tr key={d.date} className={`border-t border-[#E5E7EB] ${i % 2 === 0 ? '' : 'bg-[#F7F8FA]/50'}`}>
                      <td className="px-5 py-3.5 font-semibold text-[#0A0A0A]">{fmtDate(d.date)}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums text-[#6B7280]">{d.raffles}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-[#0096DC]">{d.participants.toLocaleString('pt-PT')}</td>
                      <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-[#0A0A0A]">{d.lounge.toLocaleString('pt-PT')}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  <tr className="border-t-2 border-[#E5E7EB] bg-[#F7F8FA]">
                    <td className="px-5 py-3.5 font-bold text-[#0A0A0A] text-xs uppercase tracking-wider">Total</td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-bold text-[#0A0A0A]">
                      {activeDays.reduce((s, d) => s + d.raffles, 0)}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-bold text-[#0096DC]">
                      {(stats?.totalParticipants ?? 0).toLocaleString('pt-PT')}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums font-bold text-[#0A0A0A]">
                      {(stats?.totalLounge ?? 0).toLocaleString('pt-PT')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Last updated */}
        <div className="flex items-center justify-center gap-2 text-xs text-[#6B7280]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0096DC] animate-pulse" />
          {lastUpdated
            ? `Atualizado às ${fmtTime(lastUpdated)}`
            : 'A carregar…'}
        </div>
      </main>

      <footer className="border-t border-[#E5E7EB] px-6 py-4 text-center">
        <p className="text-xs text-[#6B7280]">Sorteio promovido pelo ActivoBank · Participação gratuita</p>
      </footer>
    </div>
  )
}
