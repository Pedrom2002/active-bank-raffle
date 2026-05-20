'use client'

import { useState } from 'react'
import { Dashboard } from './Dashboard'
import { Records } from './Records'

type View = 'raffles' | 'records'

const TABS: { key: View; label: string }[] = [
  { key: 'raffles', label: 'Sorteios' },
  { key: 'records', label: 'Registos' },
]

export function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<View>('raffles')

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />

          <nav className="flex gap-1" aria-label="Secções do admin">
            {TABS.map(t => {
              const active = t.key === view
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${active ? 'bg-[#0096DC] text-white' : 'text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#F7F8FA]'}`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {view === 'raffles' ? <Dashboard onLogout={onLogout} /> : <Records />}
      </main>
    </div>
  )
}
