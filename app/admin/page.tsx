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
    <div className="min-h-screen bg-[#00205B] flex flex-col items-center justify-center p-6">
      <ActiveBankLogo />
      <div className="mt-8 bg-white rounded-2xl p-8 w-full max-w-xs shadow-2xl text-center">
        <h2 className="text-lg font-bold text-[#00205B] mb-6">Acesso Admin</h2>
        <div className="flex justify-center gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded-full border-2 ${pin.length > i ? 'bg-[#004AAD] border-[#004AAD]' : 'border-gray-300'}`}
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
              className="h-14 rounded-xl bg-gray-100 hover:bg-gray-200 text-xl font-bold text-gray-800 disabled:opacity-0 transition-colors"
            >
              {d}
            </button>
          ))}
        </div>
      </div>
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

  useEffect(() => {
    fetchSessions()
    const iv = setInterval(fetchSessions, 5000)
    return () => clearInterval(iv)
  }, [fetchSessions])

  useEffect(() => {
    if (!activeSession) { setParticipants([]); return }
    fetchParticipants(activeSession.id)
    const iv = setInterval(() => fetchParticipants(activeSession.id), 4000)
    return () => clearInterval(iv)
  }, [activeSession?.id, fetchParticipants])

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

  async function runRaffle() {
    if (raffleState !== 'idle') return
    setRaffleState('drawing')

    // Animate for 3s then call API
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

  // ── Drawing animation ──
  if (raffleState === 'drawing') {
    return <DrawingAnimation names={participants.map(p => p.name)} />
  }

  // ── Winner ──
  if (raffleState === 'done' && winner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center text-white text-center p-8">
        <div className="text-8xl mb-4">🏆</div>
        <p className="text-xl opacity-70 mb-1 uppercase tracking-widest">Vencedor</p>
        <p className="text-5xl font-black mb-2">{winner.name}</p>
        <p className="text-2xl opacity-70 mb-8">{winner.phone}</p>
        <button
          onClick={() => { setShowNewGame(true); setWinner(null); setRaffleState('idle') }}
          className="bg-[#E8B400] text-[#00205B] font-black px-8 py-3 rounded-xl text-lg hover:bg-[#f5c800] transition-colors"
        >
          Iniciar Novo Jogo
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-[#00205B] text-white px-6 py-4 flex items-center justify-between">
        <ActiveBankLogo />
        <span className="text-sm opacity-60">Painel Admin</span>
      </header>

      <div className="max-w-2xl mx-auto p-6 space-y-4">

        {/* Active session card */}
        {activeSession ? (
          <div className="bg-white rounded-2xl shadow p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-green-600 uppercase tracking-wider">Jogo Activo</span>
                </div>
                <h2 className="text-2xl font-black text-[#00205B]">{activeSession.name}</h2>
              </div>
              <div className="text-right">
                <div className="text-4xl font-black text-[#004AAD]">{participants.length}</div>
                <div className="text-xs text-gray-500">participantes</div>
              </div>
            </div>

            {/* Participants list */}
            {participants.length > 0 && (
              <div className="border rounded-xl overflow-hidden mb-4">
                <div className="max-h-48 overflow-y-auto divide-y">
                  {participants.map(p => (
                    <div key={p.id} className="flex justify-between px-4 py-2 text-sm">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-500">{p.phone}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              <button
                onClick={runRaffle}
                disabled={participants.length === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-lg py-3 rounded-xl transition-colors disabled:opacity-40"
              >
                🎰 SORTEAR AGORA
              </button>
              <button
                onClick={exportCSV}
                disabled={participants.length === 0}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-40"
              >
                CSV
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow p-5 text-center text-gray-400">
            Nenhum jogo activo
          </div>
        )}

        {/* New game button / form */}
        {showNewGame ? (
          <form onSubmit={startNewGame} className="bg-white rounded-2xl shadow p-5 flex gap-2">
            <input
              autoFocus
              value={newGameName}
              onChange={e => setNewGameName(e.target.value)}
              placeholder="Nome do jogo (ex: Portugal vs Brasil)"
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#004AAD]"
            />
            <button type="submit" className="bg-[#004AAD] text-white font-bold px-4 rounded-xl hover:bg-[#00205B] transition-colors">
              Iniciar
            </button>
            <button type="button" onClick={() => setShowNewGame(false)} className="text-gray-400 px-2">
              ✕
            </button>
          </form>
        ) : (
          <button
            onClick={() => setShowNewGame(true)}
            className="w-full bg-[#004AAD] hover:bg-[#00205B] text-white font-black text-lg py-3 rounded-2xl transition-colors"
          >
            + Iniciar Novo Jogo
          </button>
        )}

        {/* Session history */}
        {sessions.filter(s => s.status === 'closed').length > 0 && (
          <div className="bg-white rounded-2xl shadow p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Histórico</h3>
            <div className="space-y-2">
              {sessions.filter(s => s.status === 'closed').map(s => (
                <div key={s.id} className="flex justify-between items-center py-1 text-sm">
                  <span className="font-medium text-gray-700">{s.name}</span>
                  <span className="text-gray-400">{new Date(s.created_at).toLocaleDateString('pt-PT')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Drawing Animation (separate component to avoid conditional hook) ─────────

function DrawingAnimation({ names }: { names: string[] }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setCount(c => c + 1), 120)
    return () => clearInterval(iv)
  }, [])
  const displayed = names.length > 0 ? names[count % names.length] : '…'
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center text-white text-center p-8">
      <div className="text-6xl mb-4 animate-spin">🎰</div>
      <div className="text-5xl font-black mb-2 tabular-nums min-w-64 truncate">{displayed}</div>
      <p className="opacity-60">A sortear…</p>
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [state, setState] = useState<AdminState>('pin')
  return state === 'pin'
    ? <PinGate onUnlock={() => setState('dashboard')} />
    : <Dashboard />
}

function ActiveBankLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-9 h-9 rounded-full bg-[#E8B400] flex items-center justify-center font-black text-[#00205B]">
        AB
      </div>
      <span className="font-bold tracking-tight text-white">Active Bank</span>
    </div>
  )
}
