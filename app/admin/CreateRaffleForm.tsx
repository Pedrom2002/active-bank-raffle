'use client'

import { useState, FormEvent } from 'react'
import type { Toast } from '@/lib/types'

const LABEL_PRESETS = ['Golo', 'Final de Jogo']
const DURATION_PRESETS = [
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '5 min', seconds: 300 },
]

interface Props {
  onCreated: () => void
  onToast: (kind: Toast['kind'], text: string) => void
}

export function CreateRaffleForm({ onCreated, onToast }: Props) {
  const [show, setShow] = useState(false)
  const [label, setLabel] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [durationSec, setDurationSec] = useState(120)

  function dismiss() {
    setShow(false)
    setLabel('')
    setCustomLabel('')
    setDurationSec(120)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const finalLabel = label || customLabel.trim()
    if (!finalLabel) return
    const duration_sec = durationSec
    if (!isFinite(duration_sec) || duration_sec < 10 || duration_sec > 3600) {
      onToast('error', 'Duração inválida.')
      return
    }
    try {
      const res = await fetch('/api/raffles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: finalLabel, duration_sec }),
      })
      if (res.ok) {
        onToast('success', `Sorteio "${finalLabel}" ativado`)
        dismiss()
        onCreated()
      } else {
        const d = await res.json()
        onToast('error', d.error ?? 'Erro ao criar sorteio')
      }
    } catch {
      onToast('error', 'Erro de ligação. Tenta de novo.')
    }
  }

  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
      <h2 className="text-base font-semibold text-[#0A0A0A] mb-4">Ativar sorteio</h2>
      {!show ? (
        <button onClick={() => setShow(true)}
          className="w-full border-2 border-dashed border-[#E5E7EB] hover:border-[#0096DC] rounded-xl py-4 text-sm font-medium text-[#6B7280] hover:text-[#0096DC] transition-colors">
          + Novo sorteio
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-medium text-[#6B7280] mb-2">Seleciona o momento</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {LABEL_PRESETS.map(p => (
                <button key={p} type="button" onClick={() => { setLabel(p); setCustomLabel('') }}
                  className={`py-2.5 px-2 rounded-xl border text-sm font-medium transition-all ${label === p ? 'border-[#0096DC] bg-[#0096DC]/5 text-[#0096DC]' : 'border-[#E5E7EB] text-[#0A0A0A] hover:border-[#0096DC]'}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Ou personalizado</label>
            <input value={customLabel} onChange={e => { setCustomLabel(e.target.value); setLabel('') }}
              placeholder="Ex: Primeiro canto…"
              className="w-full bg-[#F7F8FA] border border-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition" />
          </div>
          <div>
            <p className="text-xs font-medium text-[#6B7280] mb-2">Duração</p>
            <div className="flex gap-2 flex-wrap">
              {DURATION_PRESETS.map(d => (
                <button key={d.seconds} type="button" onClick={() => setDurationSec(d.seconds)}
                  className={`py-2 px-4 rounded-xl border text-sm font-medium transition-all ${durationSec === d.seconds ? 'border-[#0096DC] bg-[#0096DC]/5 text-[#0096DC]' : 'border-[#E5E7EB] text-[#0A0A0A] hover:border-[#0096DC]'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!label && !customLabel.trim()}
              className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40">
              Ativar
            </button>
            <button type="button" onClick={dismiss}
              className="text-sm text-[#6B7280] hover:text-[#0A0A0A] px-4 py-2.5 rounded-xl hover:bg-[#F7F8FA] transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
