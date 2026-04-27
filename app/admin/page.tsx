'use client'

import { useState, useEffect, useCallback, FormEvent } from 'react'

type Session = {
  id: string
  name: string
  status: 'active' | 'closed'
  created_at: string
  winner_id: string | null
}

type Participant = {
  id: string
  name: string
  phone: string
  registered_at: string
}

type Winner = {
  name: string
  phone: string
}

type AdminState = 'pin' | 'dashboard'
type RaffleState = 'idle' | 'drawing' | 'done'

type DrawResult = {
  id: string
  label: string
  drawn_at: string
  participants: { name: string; phone: string } | null
}

const CORRECT_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '1234'
const MAX_PIN_ATTEMPTS = 5

// ─── PIN Gate ────────────────────────────────────────────────────────────────

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')

  function handleDigit(d: string) {
    if (locked || pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      if (next === CORRECT_PIN) {
        onUnlock()
      } else {
        const newAttempts = attempts + 1
        setAttempts(newAttempts)
        if (newAttempts >= MAX_PIN_ATTEMPTS) {
          setLocked(true)
          setError('Muitas tentativas. Contacta o administrador.')
        } else {
          setError(`PIN incorrecto. ${MAX_PIN_ATTEMPTS - newAttempts} tentativas restantes.`)
          setTimeout(() => setPin(''), 500)
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-[#E5E7EB] px-6 py-4">
        <ActiveBankLogo />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">Acesso Admin</h1>
            <p className="text-sm text-[#6B7280] mt-1">Introduz o PIN de 4 dígitos</p>
          </div>

          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-colors ${pin.length > i ? 'bg-[#0096DC]' : 'bg-[#E5E7EB]'}`}
              />
            ))}
          </div>

          {error && (
            <p className="text-red-600 text-sm mb-4 text-center">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button
                key={i}
                onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
                disabled={locked || d === ''}
                className="h-14 rounded-lg bg-[#F7F8FA] hover:bg-[#EDEFF2] active:bg-[#E5E7EB] text-xl font-medium text-[#0A0A0A] disabled:opacity-0 transition-colors"
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

function Dashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [raffleState, setRaffleState] = useState<RaffleState>('idle')
  const [winner, setWinner] = useState<Winner | null>(null)
  const [newGameName, setNewGameName] = useState('')
  const [showNewGame, setShowNewGame] = useState(false)
  const [draws, setDraws] = useState<DrawResult[]>([])
  const [drawWinner, setDrawWinner] = useState<{ name: string; phone: string; label: string } | null>(null)
  const [customLabel, setCustomLabel] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [drawLoading, setDrawLoading] = useState(false)

  const fetchSessions = useCallback(async () => {
    const res = await fetch('/api/sessions')
    if (res.ok) {
      const data: Session[] = await res.json()
      setSessions(data)
      const active = data.find(s => s.status === 'active') ?? null
      setActiveSession(active)
      if (active?.winner_id && raffleState === 'idle') {
        setRaffleState('done')
      }
    }
  }, [raffleState])

  const fetchParticipants = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/participants?session_id=${sessionId}`)
    if (res.ok) setParticipants(await res.json())
  }, [])

  const fetchDraws = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/draws?session_id=${sessionId}`)
    if (res.ok) setDraws(await res.json())
  }, [])

  useEffect(() => {
    fetchSessions()
    const iv = setInterval(fetchSessions, 5000)
    return () => clearInterval(iv)
  }, [fetchSessions])

  useEffect(() => {
    if (!activeSession) { setParticipants([]); setDraws([]); return }
    fetchParticipants(activeSession.id)
    fetchDraws(activeSession.id)
    const iv = setInterval(() => {
      fetchParticipants(activeSession.id)
      fetchDraws(activeSession.id)
    }, 4000)
    return () => clearInterval(iv)
  }, [activeSession?.id, fetchParticipants, fetchDraws])

  async function startNewGame(e: FormEvent) {
    e.preventDefault()
    if (!newGameName.trim()) return
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGameName }),
    })
    setNewGameName('')
    setShowNewGame(false)
    setWinner(null)
    setRaffleState('idle')
    fetchSessions()
  }

  async function runDraw(label: string) {
    if (drawLoading) return
    setDrawLoading(true)
    const res = await fetch('/api/draws', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    const data = await res.json()
    setDrawLoading(false)
    if (res.ok) {
      setDrawWinner({ ...data.winner, label: data.draw.label })
      if (activeSession) fetchDraws(activeSession.id)
    } else {
      alert(data.error)
    }
  }

  async function runRaffle() {
    if (raffleState !== 'idle') return
    setRaffleState('drawing')

    setTimeout(async () => {
      const res = await fetch('/api/raffle', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setWinner(data.winner)
        setRaffleState('done')
      } else {
        alert(data.error)
        setRaffleState('idle')
      }
    }, 3000)
  }

  function exportCSV() {
    if (!activeSession || participants.length === 0) return
    const rows = [
      ['Nome', 'Telemóvel', 'Data de Registo'],
      ...participants.map(p => [p.name, p.phone, new Date(p.registered_at).toLocaleString('pt-PT')]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeSession.name.replace(/\s+/g, '_')}_participantes.csv`
    a.click()
  }

  // ── Per-draw winner overlay ──
  if (drawWinner) {
    return (
      <div className="min-h-screen bg-[#0096DC] flex flex-col text-white">
        <header className="px-6 py-4">
          <ActiveBankLogo invert />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-8 animate-fade-in-up">
          <p className="text-sm font-medium tracking-[0.3em] uppercase opacity-80 mb-6">
            {cleanLabel(drawWinner.label)}
          </p>
          <h1 className="text-6xl font-semibold tracking-tight mb-3">{drawWinner.name}</h1>
          <p className="text-xl opacity-80 tabular-nums mb-12">{drawWinner.phone}</p>
          <button
            onClick={() => setDrawWinner(null)}
            className="bg-white text-[#0096DC] font-semibold px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Continuar jogo
          </button>
        </main>
      </div>
    )
  }

  // ── Drawing animation ──
  if (raffleState === 'drawing') {
    return <DrawingAnimation names={participants.map(p => p.name)} />
  }

  // ── Final winner ──
  if (raffleState === 'done' && winner) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-[#E5E7EB] px-6 py-4">
          <ActiveBankLogo />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center text-center px-8 animate-fade-in-up">
          <p className="text-sm font-medium tracking-[0.3em] uppercase text-[#0096DC] mb-6">
            Vencedor do sorteio
          </p>
          <h1 className="text-6xl font-semibold tracking-tight text-[#0A0A0A] mb-3">{winner.name}</h1>
          <p className="text-xl text-[#6B7280] tabular-nums mb-12">{winner.phone}</p>
          <button
            onClick={() => { setShowNewGame(true); setWinner(null); setRaffleState('idle') }}
            className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Iniciar novo jogo
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
        <ActiveBankLogo />
        <span className="text-xs text-[#6B7280] uppercase tracking-[0.2em]">Painel Admin</span>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-4">

        {/* Active session card */}
        {activeSession ? (
          <section className="bg-white border border-[#E5E7EB] rounded-xl p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0096DC] animate-pulse-dot" />
                  <span className="text-[10px] font-semibold text-[#0096DC] uppercase tracking-[0.2em]">
                    Jogo activo
                  </span>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">
                  {activeSession.name}
                </h2>
              </div>
              <div className="text-right">
                <div className="text-4xl font-semibold tracking-tight text-[#0A0A0A] tabular-nums">
                  {participants.length}
                </div>
                <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mt-0.5">
                  participantes
                </div>
              </div>
            </div>

            {participants.length > 0 && (
              <div className="border border-[#E5E7EB] rounded-lg overflow-hidden mb-5">
                <div className="max-h-48 overflow-y-auto divide-y divide-[#E5E7EB]">
                  {participants.map(p => (
                    <div key={p.id} className="flex justify-between px-4 py-2.5 text-sm">
                      <span className="font-medium text-[#0A0A0A]">{p.name}</span>
                      <span className="text-[#6B7280] tabular-nums">{p.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => runDraw('Golo')}
                  disabled={participants.length === 0 || drawLoading}
                  className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Golo
                </button>
                <button
                  onClick={() => runDraw('Final')}
                  disabled={participants.length === 0 || drawLoading}
                  className="bg-[#0A0A0A] hover:bg-black text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Final
                </button>
                <button
                  onClick={() => setShowCustomInput(v => !v)}
                  disabled={participants.length === 0 || drawLoading}
                  className="bg-white border border-[#0096DC] text-[#0096DC] hover:bg-[#0096DC]/5 font-semibold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Personalizado
                </button>
                <button
                  onClick={exportCSV}
                  disabled={participants.length === 0}
                  className="bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[#0A0A0A] font-semibold py-3 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Exportar CSV
                </button>
              </div>

              {showCustomInput && (
                <form
                  onSubmit={e => {
                    e.preventDefault()
                    if (!customLabel.trim()) return
                    runDraw(customLabel.trim())
                    setCustomLabel('')
                    setShowCustomInput(false)
                  }}
                  className="flex gap-2 pt-1"
                >
                  <input
                    autoFocus
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    placeholder="Nome do sorteio (ex: Melhor adepto)"
                    className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition"
                  />
                  <button
                    type="submit"
                    className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold px-5 rounded-lg transition-colors"
                  >
                    Sortear
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <section className="bg-white border border-dashed border-[#E5E7EB] rounded-xl p-10 text-center">
            <p className="text-[#6B7280] text-sm">Nenhum jogo activo</p>
          </section>
        )}

        {/* New game */}
        {showNewGame ? (
          <form
            onSubmit={startNewGame}
            className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex gap-2"
          >
            <input
              autoFocus
              value={newGameName}
              onChange={e => setNewGameName(e.target.value)}
              placeholder="Nome do jogo (ex: Portugal vs Brasil)"
              className="flex-1 bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition"
            />
            <button
              type="submit"
              className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold px-5 rounded-lg transition-colors"
            >
              Iniciar
            </button>
            <button
              type="button"
              onClick={() => setShowNewGame(false)}
              className="text-[#6B7280] hover:text-[#0A0A0A] px-3 transition-colors"
            >
              Cancelar
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowNewGame(true)}
            className="w-full bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-base py-3.5 rounded-xl transition-colors"
          >
            Iniciar novo jogo
          </button>
        )}

        {/* Draws */}
        {draws.length > 0 && (
          <section className="bg-white border border-[#E5E7EB] rounded-xl p-6">
            <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.2em] mb-4">
              Sorteios desta sessão
            </h3>
            <div className="divide-y divide-[#E5E7EB]">
              {draws.map(d => (
                <div key={d.id} className="grid grid-cols-3 items-center py-2.5 text-sm">
                  <span className="font-medium text-[#0A0A0A]">{cleanLabel(d.label)}</span>
                  <span className="font-medium text-[#0096DC] text-center">
                    {d.participants?.name ?? '—'}
                  </span>
                  <span className="text-[#6B7280] text-xs text-right tabular-nums">
                    {new Date(d.drawn_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* History */}
        {sessions.filter(s => s.status === 'closed').length > 0 && (
          <section className="bg-white border border-[#E5E7EB] rounded-xl p-6">
            <h3 className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-[0.2em] mb-4">
              Histórico
            </h3>
            <div className="divide-y divide-[#E5E7EB]">
              {sessions.filter(s => s.status === 'closed').map(s => (
                <div key={s.id} className="flex justify-between items-center py-2.5 text-sm">
                  <span className="font-medium text-[#0A0A0A]">{s.name}</span>
                  <span className="text-[#6B7280] text-xs tabular-nums">
                    {new Date(s.created_at).toLocaleDateString('pt-PT')}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ─── Drawing Animation ─────────

function DrawingAnimation({ names }: { names: string[] }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setCount(c => c + 1), 120)
    return () => clearInterval(iv)
  }, [])
  const displayed = names.length > 0 ? names[count % names.length] : '…'
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-[#E5E7EB] px-6 py-4">
        <ActiveBankLogo />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-8">
        <p className="text-sm font-medium tracking-[0.3em] uppercase text-[#0096DC] mb-6">
          A sortear
        </p>
        <div className="text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums min-w-64 truncate text-[#0A0A0A]">
          {displayed}
        </div>
        <div className="mt-10 flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse-dot" />
          <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
          <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </main>
    </div>
  )
}

// ─── Root ─────────────────────────────

export default function AdminPage() {
  const [state, setState] = useState<AdminState>('pin')
  return state === 'pin'
    ? <PinGate onUnlock={() => setState('dashboard')} />
    : <Dashboard />
}

function cleanLabel(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\s]+/u, '').trim()
}

function ActiveBankLogo({ invert = false }: { invert?: boolean }) {
  const text = invert ? 'text-white' : 'text-[#0A0A0A]'
  const dot = invert ? 'bg-white' : 'bg-[#0096DC]'
  const dotText = invert ? 'text-[#0096DC]' : 'text-white'
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
