'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Raffle = {
  id: string
  label: string
  status: 'active' | 'closed'
  duration_sec: number
  starts_at: string
  ends_at: string | null
  winner_id: string | null
  created_at: string
}

type Winner = {
  id: string
  name: string
  phone: string
}

type Toast = {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}

const MAX_PIN_ATTEMPTS = 5
const POLL_INTERVAL_MS = 5000

// ─── Logo ────────────────────────────────────────────────────────────────────

function ActiveBankLogo({ invert = false }: { invert?: boolean }) {
  const text    = invert ? 'text-white'      : 'text-[#0A0A0A]'
  const dot     = invert ? 'bg-white'        : 'bg-[#0096DC]'
  const dotText = invert ? 'text-[#0096DC]'  : 'text-white'
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-full ${dot} flex items-center justify-center`}>
        <span className={`${dotText} font-bold text-xs`}>A</span>
      </div>
      <span className={`text-base font-semibold tracking-tight ${text}`}>
        ActivoBank
      </span>
    </div>
  )
}

// ─── Toasts ──────────────────────────────────────────────────────────────────

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const addToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now()
    setToasts(t => [...t, { id, kind, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])
  return { toasts, addToast }
}

function ToastList({ toasts }: { toasts: Toast[] }) {
  const bg: Record<Toast['kind'], string> = {
    success: 'bg-green-600',
    error:   'bg-red-600',
    info:    'bg-[#004AAD]',
  }
  return (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className={`${bg[t.kind]} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}

// ─── PIN Gate ────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin]           = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked]     = useState(false)
  const [error, setError]       = useState('')
  const [shake, setShake]       = useState(false)

  const handleDigit = useCallback(async (d: string) => {
    if (locked || pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: next }),
      })
      if (res.ok) {
        onUnlock()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        setShake(true)
        setTimeout(() => setShake(false), 400)
        if (newAttempts >= MAX_PIN_ATTEMPTS) {
          setLocked(true)
          setError('Muitas tentativas. Contacta o administrador.')
        } else {
          const left = MAX_PIN_ATTEMPTS - newAttempts
          setError(`PIN incorrecto. ${left} tentativa${left === 1 ? '' : 's'} restante${left === 1 ? '' : 's'}.`)
          setTimeout(() => setPin(''), 500)
        }
      }
    }
  }, [locked, pin, attempts, onUnlock])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') handleDigit(e.key)
      else if (e.key === 'Backspace') setPin(p => p.slice(0, -1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleDigit])

  return (
    <div className="min-h-screen bg-[#00205B] flex flex-col items-center justify-center p-6">
      <ActiveBankLogo invert />
      <div className={`mt-8 bg-white rounded-2xl p-8 w-full max-w-xs shadow-2xl text-center transition-transform ${shake ? 'animate-[shake_0.4s_ease]' : ''}`}>
        <h2 className="text-lg font-bold text-[#00205B] mb-6">Acesso Admin</h2>
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 transition-colors ${pin.length > i ? 'bg-[#004AAD] border-[#004AAD]' : 'border-gray-300'}`}
            />
          ))}
        </div>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="grid grid-cols-3 gap-3">
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
            <button
              key={i}
              onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
              disabled={locked || d === ''}
              className="h-14 rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 text-xl font-bold text-gray-800 disabled:opacity-0 transition-all"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Raffle Card ─────────────────────────────────────────────────────────────

function RaffleCard({
  raffle,
  onClose,
  onDraw,
}: {
  raffle: Raffle
  onClose: (id: string) => void
  onDraw: (id: string) => void
}) {
  const isActive  = raffle.status === 'active'
  const hasWinner = raffle.winner_id !== null

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="font-semibold text-[#0A0A0A] truncate">{raffle.label}</p>
        <p className="text-xs text-[#6B7280] mt-0.5">
          {isActive ? 'A decorrer' : hasWinner ? 'Vencedor sorteado' : 'Encerrado'}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        {isActive && (
          <button
            onClick={() => onClose(raffle.id)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] transition-colors"
          >
            Fechar
          </button>
        )}
        {!isActive && !hasWinner && (
          <button
            onClick={() => onDraw(raffle.id)}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-[#004AAD] hover:bg-[#003A8C] text-white transition-colors"
          >
            Sortear
          </button>
        )}
        {hasWinner && (
          <span className="px-3 py-1.5 text-sm font-medium rounded-lg bg-green-50 text-green-700">
            Arquivado
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

const PRESETS = ['Golo', 'Final de Jogo'] as const

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [raffles, setRaffles]         = useState<Raffle[]>([])
  const [customLabel, setCustomLabel] = useState('')
  const [showCustom, setShowCustom]   = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [loading, setLoading]         = useState(false)
  const { toasts, addToast }          = useToasts()

  const fetchRaffles = useCallback(async () => {
    const res = await fetch('/api/raffles')
    if (res.ok) {
      const data: Raffle[] = await res.json()
      setRaffles(data)
    }
  }, [])

  useEffect(() => {
    fetchRaffles()
    const id = setInterval(fetchRaffles, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [fetchRaffles])

  async function createRaffle(label: string) {
    if (!label.trim()) return
    setLoading(true)
    const res = await fetch('/api/raffles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: label.trim(), duration_sec: 120 }),
    })
    setLoading(false)
    if (res.ok) {
      addToast('success', `Sorteio "${label.trim()}" criado.`)
      setCustomLabel('')
      setShowCustom(false)
      fetchRaffles()
    } else {
      addToast('error', 'Erro ao criar sorteio.')
    }
  }

  async function closeRaffle(id: string) {
    const res = await fetch(`/api/raffles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    })
    if (res.ok) {
      addToast('info', 'Sorteio fechado.')
      fetchRaffles()
    } else {
      addToast('error', 'Erro ao fechar sorteio.')
    }
  }

  async function drawWinner(id: string) {
    const res = await fetch(`/api/raffles/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'draw' }),
    })
    if (res.ok) {
      const data = await res.json()
      const winner: Winner = data.winner
      addToast('success', `Vencedor: ${winner.name} (${winner.phone})`)
      fetchRaffles()
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string }
      addToast('error', err.error ?? 'Erro ao sortear vencedor.')
    }
  }

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    onLogout()
  }

  function handleCustomSubmit(e: FormEvent) {
    e.preventDefault()
    createRaffle(customLabel)
  }

  const active   = raffles.filter(r => r.status === 'active')
  const closed   = raffles.filter(r => r.status === 'closed' && !r.winner_id)
  const archived = raffles.filter(r => r.winner_id !== null)

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
        <ActiveBankLogo />
        <button
          onClick={logout}
          className="text-sm text-[#6B7280] hover:text-[#0A0A0A] transition-colors"
        >
          Sair
        </button>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">
            Criar Sorteio
          </h2>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(label => (
              <button
                key={label}
                onClick={() => createRaffle(label)}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-[#004AAD] hover:bg-[#003A8C] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setShowCustom(v => !v)}
              className="px-4 py-2 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] text-sm font-medium transition-colors"
            >
              Personalizado
            </button>
          </div>

          {showCustom && (
            <form onSubmit={handleCustomSubmit} className="mt-3 flex gap-2">
              <input
                type="text"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                placeholder="Nome do sorteio..."
                className="flex-1 border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#004AAD]"
                autoFocus
              />
              <button
                type="submit"
                disabled={!customLabel.trim() || loading}
                className="px-4 py-2 rounded-lg bg-[#004AAD] hover:bg-[#003A8C] text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Criar
              </button>
            </form>
          )}
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#6B7280] mb-3">
            Ativos ({active.length + closed.length})
          </h2>
          {active.length === 0 && closed.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">Nenhum sorteio ativo.</p>
          ) : (
            <div className="space-y-2">
              {[...active, ...closed].map(r => (
                <RaffleCard key={r.id} raffle={r} onClose={closeRaffle} onDraw={drawWinner} />
              ))}
            </div>
          )}
        </section>

        {archived.length > 0 && (
          <section>
            <button
              onClick={() => setArchiveOpen(v => !v)}
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#6B7280] hover:text-[#374151] transition-colors"
            >
              <span>{archiveOpen ? '▾' : '▸'}</span>
              Arquivo ({archived.length})
            </button>
            {archiveOpen && (
              <div className="mt-3 space-y-2">
                {archived.map(r => (
                  <RaffleCard key={r.id} raffle={r} onClose={closeRaffle} onDraw={drawWinner} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <ToastList toasts={toasts} />
    </div>
  )
}

// ─── Root ────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false)
  return unlocked
    ? <Dashboard onLogout={() => setUnlocked(false)} />
    : <PinGate onUnlock={() => setUnlocked(true)} />
}
