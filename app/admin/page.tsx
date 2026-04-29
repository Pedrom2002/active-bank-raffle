'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'

type Raffle = {
  id: string
  label: string
  status: 'active' | 'closed'
  duration_sec: number
  starts_at: string
  ends_at: string | null
  winner_id: string | null
}

type Participant = {
  id: string
  raffle_id: string
  name: string
  phone: string
  email: string
  registered_at: string
}

type Toast = { id: number; kind: 'success' | 'info' | 'error'; text: string }

const MAX_PIN_ATTEMPTS = 5
const PRESETS = ['Golo', 'Intervalo', 'Penalty', 'Cartão', 'Final', 'Especial']

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const submitPin = useCallback(async (p: string) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p }),
      })
      if (res.ok) {
        onUnlock()
        return
      }
      const a = attempts + 1
      setAttempts(a)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      if (a >= MAX_PIN_ATTEMPTS) {
        setLocked(true)
        setError('Muitas tentativas. Contacta o administrador.')
      } else {
        setError(`PIN incorrecto. ${MAX_PIN_ATTEMPTS - a} tentativa${MAX_PIN_ATTEMPTS - a === 1 ? '' : 's'} restante${MAX_PIN_ATTEMPTS - a === 1 ? '' : 's'}.`)
        setTimeout(() => setPin(''), 500)
      }
    } finally {
      setSubmitting(false)
    }
  }, [submitting, attempts, onUnlock])

  const handleDigit = useCallback((d: string) => {
    if (locked || pin.length >= 4 || submitting) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      submitPin(next)
    }
  }, [locked, pin, submitting, submitPin])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleDigit])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-[#E5E7EB] px-6 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">Acesso Admin</h1>
            <p className="text-sm text-[#6B7280] mt-1.5">Introduz o PIN de 4 dígitos</p>
          </div>
          <div className="flex justify-center gap-3 mb-7">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${pin.length > i ? 'bg-[#0096DC] scale-110' : 'bg-[#E5E7EB]'}`} />
            ))}
          </div>
          {error && <p role="alert" className="text-red-600 text-sm mb-4 text-center font-medium">{error}</p>}
          <div className="grid grid-cols-3 gap-2.5">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button key={i}
                onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
                disabled={locked || d === '' || submitting}
                className="h-14 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFF2] active:bg-[#E5E7EB] active:scale-95 text-xl font-medium text-[#0A0A0A] disabled:opacity-0 transition-all">
                {d}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [participants, setParticipants] = useState<Record<string, Participant[]>>({})
  const [showCreate, setShowCreate] = useState(false)
  const [label, setLabel] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [durationMin, setDurationMin] = useState('2')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [drawingId, setDrawingId] = useState<string | null>(null)

  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, kind, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  const fetchRaffles = useCallback(async () => {
    const res = await fetch('/api/raffles')
    if (res.ok) setRaffles(await res.json())
  }, [])

  const fetchParticipants = useCallback(async (raffleId: string) => {
    const res = await fetch(`/api/raffles/${raffleId}/participants`)
    if (res.ok) {
      const data: Participant[] = await res.json()
      setParticipants(p => ({ ...p, [raffleId]: data }))
    }
  }, [])

  useEffect(() => {
    fetchRaffles()
    const iv = setInterval(fetchRaffles, 4000)
    return () => clearInterval(iv)
  }, [fetchRaffles])

  useEffect(() => {
    const active = raffles.filter(r => r.status === 'active')
    active.forEach(r => fetchParticipants(r.id))
    if (active.length === 0) return
    const iv = setInterval(() => active.forEach(r => fetchParticipants(r.id)), 4000)
    return () => clearInterval(iv)
  }, [raffles, fetchParticipants])

  async function createRaffle(e: FormEvent) {
    e.preventDefault()
    const finalLabel = label || customLabel.trim()
    if (!finalLabel) return
    const duration_sec = Math.round(parseFloat(durationMin) * 60)
    const res = await fetch('/api/raffles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: finalLabel, duration_sec }),
    })
    if (res.ok) {
      pushToast('success', `Sorteio "${finalLabel}" ativado`)
      setLabel('')
      setCustomLabel('')
      setShowCreate(false)
      fetchRaffles()
    } else {
      const d = await res.json()
      pushToast('error', d.error ?? 'Erro ao criar sorteio')
    }
  }

  async function closeRaffle(id: string) {
    const res = await fetch(`/api/raffles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    })
    if (res.ok) { pushToast('info', 'Sorteio encerrado'); fetchRaffles() }
    else pushToast('error', 'Erro ao encerrar')
  }

  async function drawWinner(id: string, raffleLabel: string) {
    setDrawingId(id)
    const res = await fetch(`/api/raffles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'draw' }),
    })
    setDrawingId(null)
    if (res.ok) {
      const d = await res.json()
      pushToast('success', `Vencedor de "${raffleLabel}": ${d.winner.name}`)
      fetchRaffles()
    } else {
      const d = await res.json()
      pushToast('error', d.error ?? 'Erro no sorteio')
    }
  }

  const activeRaffles = raffles.filter(r => r.status === 'active')
  const closedRaffles = raffles.filter(r => r.status === 'closed')

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
          <h2 className="text-base font-semibold text-[#0A0A0A] mb-4">Ativar sorteio</h2>
          {!showCreate ? (
            <button onClick={() => setShowCreate(true)}
              className="w-full border-2 border-dashed border-[#E5E7EB] hover:border-[#0096DC] rounded-xl py-4 text-sm font-medium text-[#6B7280] hover:text-[#0096DC] transition-colors">
              + Novo sorteio
            </button>
          ) : (
            <form onSubmit={createRaffle} className="space-y-4">
              <div>
                <p className="text-xs font-medium text-[#6B7280] mb-2">Seleciona o momento</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {PRESETS.map(p => (
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
                <label className="block text-xs font-medium text-[#6B7280] mb-1.5">Duração (minutos)</label>
                <input type="number" min="0.5" max="60" step="0.5" value={durationMin}
                  onChange={e => setDurationMin(e.target.value)}
                  className="w-32 bg-[#F7F8FA] border border-transparent rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:bg-white focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={!label && !customLabel.trim()}
                  className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40">
                  Ativar
                </button>
                <button type="button" onClick={() => { setShowCreate(false); setLabel(''); setCustomLabel('') }}
                  className="text-sm text-[#6B7280] hover:text-[#0A0A0A] px-4 py-2.5 rounded-xl hover:bg-[#F7F8FA] transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </section>

        {activeRaffles.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider px-1">Ativos</h2>
            {activeRaffles.map(r => {
              const parts = participants[r.id] ?? []
              return (
                <div key={r.id} className="bg-white border border-[#0096DC]/30 rounded-2xl p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse flex-shrink-0" />
                      <h3 className="text-lg font-semibold text-[#0A0A0A]">{r.label}</h3>
                    </div>
                    <span className="text-2xl font-semibold tabular-nums text-[#0096DC]">{parts.length}</span>
                  </div>
                  <p className="text-xs text-[#6B7280] mb-4">
                    {parts.length === 0 ? 'Sem inscritos ainda' : `${parts.length} inscrito${parts.length === 1 ? '' : 's'}`}
                  </p>
                  {parts.length > 0 && (
                    <div className="border-t border-[#E5E7EB] max-h-40 overflow-y-auto mb-4">
                      <ul className="divide-y divide-[#E5E7EB]">
                        {parts.slice(0, 20).map(p => (
                          <li key={p.id} className="px-1 py-2 flex items-center justify-between text-sm">
                            <span className="font-medium text-[#0A0A0A]">{p.name}</span>
                            <span className="text-xs text-[#6B7280] tabular-nums">{p.phone}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button onClick={() => closeRaffle(r.id)}
                    className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#0A0A0A] transition-colors">
                    Encerrar sorteio
                  </button>
                </div>
              )
            })}
          </section>
        )}

        {closedRaffles.filter(r => !r.winner_id).length > 0 && (
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider px-1">Encerrados — sem vencedor</h2>
            {closedRaffles.filter(r => !r.winner_id).map(r => {
              const parts = participants[r.id]
              return (
                <div key={r.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-[#0A0A0A]">{r.label}</h3>
                    <p className="text-xs text-[#6B7280] mt-0.5">{parts ? `${parts.length} inscritos` : '…'}</p>
                  </div>
                  <button onClick={() => drawWinner(r.id, r.label)} disabled={drawingId === r.id}
                    className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap">
                    {drawingId === r.id ? 'A sortear…' : 'Sortear vencedor'}
                  </button>
                </div>
              )
            })}
          </section>
        )}

        {closedRaffles.filter(r => r.winner_id).length > 0 && (
          <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#0A0A0A] mb-4">Histórico</h2>
            <ul className="divide-y divide-[#E5E7EB]">
              {closedRaffles.filter(r => r.winner_id).map(r => (
                <li key={r.id} className="py-3 flex items-center justify-between text-sm gap-3">
                  <span className="font-medium text-[#0A0A0A]">{r.label}</span>
                  <span className="text-[11px] text-[#6B7280] tabular-nums whitespace-nowrap">
                    {r.ends_at ? new Date(r.ends_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeRaffles.length === 0 && raffles.length === 0 && (
          <section className="bg-white border border-[#E5E7EB] rounded-2xl p-10 text-center">
            <p className="text-[#6B7280] text-sm">Nenhum sorteio criado ainda. Usa o botão acima para ativar o primeiro.</p>
          </section>
        )}
      </main>

      <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-sm ${t.kind === 'success' ? 'bg-[#0096DC] text-white' : t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-white border border-[#E5E7EB] text-[#0A0A0A]'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function AdminPage() {
  const [status, setStatus] = useState<'checking' | 'locked' | 'unlocked'>('checking')

  useEffect(() => {
    fetch('/api/admin/me')
      .then(r => setStatus(r.ok ? 'unlocked' : 'locked'))
      .catch(() => setStatus('locked'))
  }, [])

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    setStatus('locked')
  }

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 rounded-full border-2 border-[#0096DC] border-t-transparent animate-spin" />
      </div>
    )
  }

  return status === 'unlocked'
    ? <Dashboard onLogout={handleLogout} />
    : <PinGate onUnlock={() => setStatus('unlocked')} />
}
