'use client'

import { useState } from 'react'
import { LoungeList } from './records/LoungeList'
import { ParticipantsList } from './records/ParticipantsList'
import { WinnersList } from './records/WinnersList'

type Sub = 'lounge' | 'participants' | 'winners'

const TABS: { key: Sub; label: string }[] = [
  { key: 'lounge', label: 'Lounge' },
  { key: 'participants', label: 'Participantes' },
  { key: 'winners', label: 'Vencedores' },
]

export function Records() {
  const [sub, setSub] = useState<Sub>('lounge')
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-[#E5E7EB]" aria-label="Sub-secções de registos">
        {TABS.map(t => {
          const active = t.key === sub
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-[#0096DC] text-[#0096DC]' : 'border-transparent text-[#6B7280] hover:text-[#0A0A0A]'}`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {sub === 'lounge' && <LoungeList />}
      {sub === 'participants' && <ParticipantsList />}
      {sub === 'winners' && <WinnersList />}
    </div>
  )
}
