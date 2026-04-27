'use client'

import { useState, useEffect, useCallback, useMemo, useRef, FormEvent } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

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

type DrawResult = {
  id: string
  label: string
  drawn_at: string
  participants: { name: string; phone: string } | null
}

type QRData = {
  session_id: string
  session_name: string
  qr_data_url: string
  expires_at: number
  register_url: string
}

type Toast = {
  id: number
  kind: 'success' | 'info' | 'error'
  text: string
}

type DrawPreset = {
  label: string
  emoji: string
  hint: string
}

const DRAW_PRESETS: DrawPreset[] = [
  { label: '⚽ Golo',       emoji: '⚽', hint: 'Após um golo' },
  { label: '⏸ Intervalo',   emoji: '⏸', hint: 'Pausa do jogo' },
  { label: '🎯 Penalty',    emoji: '🎯', hint: 'Pontapé de penalty' },
  { label: '🟨 Cartão',     emoji: '🟨', hint: 'Cartão amarelo/vermelho' },
  { label: '🏆 Final',      emoji: '🏆', hint: 'Fim do jogo' },
  { label: '🎁 Especial',   emoji: '🎁', hint: 'Sorteio especial' },
]

const MILESTONES = [10, 25, 50, 100, 250, 500, 1000]
const CORRECT_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN ?? '1234'
const MAX_PIN_ATTEMPTS = 5

// ═══════════════════════════════════════════════════════════════════════════
// PIN Gate
// ═══════════════════════════════════════════════════════════════════════════

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const handleDigit = useCallback((d: string) => {
    if (locked || pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) {
      if (next === CORRECT_PIN) {
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
          setError(`PIN incorrecto. ${MAX_PIN_ATTEMPTS - newAttempts} tentativa${MAX_PIN_ATTEMPTS - newAttempts === 1 ? '' : 's'} restante${MAX_PIN_ATTEMPTS - newAttempts === 1 ? '' : 's'}.`)
          setTimeout(() => setPin(''), 500)
        }
      }
    }
  }, [locked, pin, attempts, onUnlock])

  // Keyboard support for PIN
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
        <ActiveBankLogo />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className={`w-full max-w-xs ${shake ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">Acesso Admin</h1>
            <p className="text-sm text-[#6B7280] mt-1.5">Introduz o PIN de 4 dígitos</p>
          </div>

          <div className="flex justify-center gap-3 mb-7" aria-label="PIN status">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${pin.length > i ? 'bg-[#0096DC] scale-110' : 'bg-[#E5E7EB]'}`}
              />
            ))}
          </div>

          {error && (
            <p role="alert" className="text-red-600 text-sm mb-4 text-center font-medium">{error}</p>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
              <button
                key={i}
                onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
                disabled={locked || d === ''}
                aria-label={d === '⌫' ? 'Apagar' : d ? `Tecla ${d}` : ''}
                className="h-14 rounded-xl bg-[#F7F8FA] hover:bg-[#EDEFF2] active:bg-[#E5E7EB] active:scale-95 text-xl font-medium text-[#0A0A0A] disabled:opacity-0 transition-all focus-visible:outline-2 focus-visible:outline-[#0096DC] focus-visible:outline-offset-2"
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

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════════════════

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [draws, setDraws] = useState<DrawResult[]>([])
  const [qr, setQr] = useState<QRData | null>(null)
  const [drawWinner, setDrawWinner] = useState<{ name: string; phone: string; label: string } | null>(null)
  const [drawing, setDrawing] = useState<{ label: string } | null>(null)
  const [showNewGame, setShowNewGame] = useState(false)
  const [newGameName, setNewGameName] = useState('')
  const [customLabel, setCustomLabel] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmEnd, setConfirmEnd] = useState(false)

  const milestonesShown = useRef<Set<number>>(new Set())
  const lastParticipantId = useRef<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ─── Toast helper ─────────────────────────────────────────
  const pushToast = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, kind, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000)
  }, [])

  // ─── Data fetching ────────────────────────────────────────
  const fetchSessions = useCallback(async () => {
    const res = await fetch('/api/sessions')
    if (res.ok) {
      const data: Session[] = await res.json()
      setSessions(data)
      setActiveSession(data.find(s => s.status === 'active') ?? null)
    }
  }, [])

  const fetchParticipants = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/participants?session_id=${sessionId}`)
    if (res.ok) {
      const data: Participant[] = await res.json()

      // Detect new registrations for toast + milestones
      if (lastParticipantId.current && data.length > 0 && data[0].id !== lastParticipantId.current) {
        const idx = data.findIndex(p => p.id === lastParticipantId.current)
        const fresh = idx === -1 ? [data[0]] : data.slice(0, idx)
        if (fresh.length > 0) {
          pushToast('info', `${fresh[0].name} inscreveu-se${fresh.length > 1 ? ` (+${fresh.length - 1})` : ''}`)
        }
      }
      if (data.length > 0) lastParticipantId.current = data[0].id

      // Milestones
      for (const m of MILESTONES) {
        if (data.length >= m && !milestonesShown.current.has(m)) {
          milestonesShown.current.add(m)
          if (lastParticipantId.current) pushToast('success', `🎉 ${m} inscritos!`)
        }
      }

      setParticipants(data)
    }
  }, [pushToast])

  const fetchDraws = useCallback(async (sessionId: string) => {
    const res = await fetch(`/api/draws?session_id=${sessionId}`)
    if (res.ok) setDraws(await res.json())
  }, [])

  const fetchQR = useCallback(async () => {
    const res = await fetch('/api/qr')
    if (res.ok) setQr(await res.json())
    else setQr(null)
  }, [])

  // ─── Polling ──────────────────────────────────────────────
  useEffect(() => {
    fetchSessions()
    const iv = setInterval(fetchSessions, 5000)
    return () => clearInterval(iv)
  }, [fetchSessions])

  useEffect(() => {
    if (!activeSession) {
      setParticipants([])
      setDraws([])
      setQr(null)
      milestonesShown.current.clear()
      lastParticipantId.current = null
      return
    }
    fetchParticipants(activeSession.id)
    fetchDraws(activeSession.id)
    fetchQR()
    const iv = setInterval(() => {
      fetchParticipants(activeSession.id)
      fetchDraws(activeSession.id)
    }, 4000)
    const qrIv = setInterval(fetchQR, 60_000) // QR refresh every minute
    return () => { clearInterval(iv); clearInterval(qrIv) }
  }, [activeSession?.id, fetchParticipants, fetchDraws, fetchQR])

  // ─── Actions ──────────────────────────────────────────────
  async function startNewGame(e: FormEvent) {
    e.preventDefault()
    if (!newGameName.trim()) return
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newGameName }),
    })
    if (res.ok) {
      pushToast('success', `Jogo iniciado: ${newGameName}`)
      setNewGameName('')
      setShowNewGame(false)
      milestonesShown.current.clear()
      lastParticipantId.current = null
      fetchSessions()
    } else {
      pushToast('error', 'Erro ao iniciar jogo.')
    }
  }

  const runDraw = useCallback(async (label: string) => {
    if (drawing) return
    if (!activeSession) return
    if (participants.length === 0) {
      pushToast('error', 'Sem participantes inscritos.')
      return
    }
    setDrawing({ label })
    // Show animation for ~2.5s before calling API
    setTimeout(async () => {
      const res = await fetch('/api/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      })
      const data = await res.json()
      setDrawing(null)
      if (res.ok) {
        setDrawWinner({ ...data.winner, label: data.draw.label })
        pushToast('success', `Vencedor: ${data.winner.name}`)
        fetchDraws(activeSession.id)
      } else {
        pushToast('error', data.error ?? 'Erro no sorteio.')
      }
    }, 2500)
  }, [drawing, activeSession, participants.length, pushToast, fetchDraws])

  function endSession() {
    if (!activeSession) return
    if (!confirmEnd) {
      setConfirmEnd(true)
      setTimeout(() => setConfirmEnd(false), 3000)
      return
    }
    fetch('/api/sessions', { method: 'PATCH' }).then(() => {
      pushToast('info', 'Jogo encerrado.')
      setConfirmEnd(false)
      fetchSessions()
    })
  }

  function copyRegisterLink() {
    if (!qr?.register_url) return
    navigator.clipboard.writeText(qr.register_url)
    pushToast('info', 'Link copiado.')
  }

  function exportCSV() {
    if (!activeSession || participants.length === 0) return
    const rows = [
      ['Nome', 'Telemóvel', 'Data de Registo'],
      ...participants.map(p => [
        `"${p.name.replace(/"/g, '""')}"`,
        p.phone,
        new Date(p.registered_at).toLocaleString('pt-PT'),
      ]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeSession.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('info', 'CSV exportado.')
  }

  // ─── Keyboard shortcuts ───────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '?') { e.preventDefault(); setShowShortcuts(s => !s) }
      else if (e.key === '/') { e.preventDefault(); searchInputRef.current?.focus() }
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setShowNewGame(true) }
      else if (e.key === 'Escape') { setShowShortcuts(false); setShowNewGame(false) }
      else if (activeSession && e.key >= '1' && e.key <= '6' && !drawing) {
        const idx = parseInt(e.key) - 1
        if (DRAW_PRESETS[idx]) runDraw(DRAW_PRESETS[idx].label)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [activeSession, drawing, runDraw])

  // ─── Derived state ────────────────────────────────────────
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants
    const q = searchQuery.toLowerCase()
    return participants.filter(p =>
      p.name.toLowerCase().includes(q) || p.phone.includes(q)
    )
  }, [participants, searchQuery])

  const lastRegistration = participants[0]?.registered_at ?? null

  const activityFeed = useMemo(() => {
    const events: Array<{ id: string; kind: 'register' | 'draw'; ts: string; text: string; sub?: string }> = []
    participants.slice(0, 8).forEach(p => events.push({
      id: `p-${p.id}`, kind: 'register', ts: p.registered_at,
      text: p.name, sub: 'inscreveu-se',
    }))
    draws.slice(0, 5).forEach(d => events.push({
      id: `d-${d.id}`, kind: 'draw', ts: d.drawn_at,
      text: d.participants?.name ?? '—', sub: `venceu ${cleanLabel(d.label)}`,
    }))
    return events.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 10)
  }, [participants, draws])

  // ═════════════════════════════════════════════════════════
  // Per-draw winner overlay (shown to staff after draw)
  // ═════════════════════════════════════════════════════════
  if (drawWinner) {
    return <WinnerOverlay winner={drawWinner} onContinue={() => setDrawWinner(null)} />
  }

  // ═════════════════════════════════════════════════════════
  // Drawing animation
  // ═════════════════════════════════════════════════════════
  if (drawing) {
    return <DrawingAnimation names={participants.map(p => p.name)} label={drawing.label} />
  }

  // ═════════════════════════════════════════════════════════
  // Main dashboard
  // ═════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      {/* ─── Header ──────────────────────────────────────── */}
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-20 backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <ActiveBankLogo />
            {activeSession && (
              <>
                <span className="hidden sm:block w-px h-6 bg-[#E5E7EB]" />
                <div className="hidden sm:flex items-center gap-2 min-w-0">
                  <LiveDot />
                  <span className="font-medium text-[#0A0A0A] truncate" title={activeSession.name}>
                    {activeSession.name}
                  </span>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {activeSession && (
              <SessionUptime startedAt={activeSession.created_at} />
            )}
            <button
              onClick={() => setShowShortcuts(true)}
              className="hidden sm:flex w-9 h-9 rounded-lg hover:bg-[#F7F8FA] items-center justify-center text-[#6B7280] hover:text-[#0A0A0A] transition-colors focus-visible:outline-2 focus-visible:outline-[#0096DC]"
              aria-label="Atalhos de teclado"
              title="Atalhos (?)"
            >
              <KeyboardIcon />
            </button>
            <button
              onClick={onLogout}
              className="text-xs sm:text-sm text-[#6B7280] hover:text-[#0A0A0A] px-2 sm:px-3 py-1.5 rounded-lg hover:bg-[#F7F8FA] transition-colors focus-visible:outline-2 focus-visible:outline-[#0096DC]"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ─── No active session state ────────────────── */}
        {!activeSession && (
          <EmptyDashboard
            onStart={() => setShowNewGame(true)}
            sessions={sessions}
          />
        )}

        {activeSession && (
          <>
            {/* ─── Stats row ───────────────────────────── */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-label="Métricas do jogo">
              <StatCard
                label="Inscritos"
                value={participants.length.toString()}
                accent
                icon={<UsersIcon />}
              />
              <StatCard
                label="Sorteios"
                value={draws.length.toString()}
                icon={<TrophyIcon />}
              />
              <StatCard
                label="Activo há"
                value={<UptimeValue startedAt={activeSession.created_at} />}
                icon={<ClockIcon />}
              />
              <StatCard
                label="Última inscrição"
                value={lastRegistration ? <RelativeTime ts={lastRegistration} /> : '—'}
                icon={<PulseIcon />}
              />
            </section>

            {/* ─── Main grid ───────────────────────────── */}
            <div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-6">

              {/* ── Left column ─────────────────────── */}
              <div className="space-y-6 min-w-0">

                {/* Quick draw */}
                <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A]">Sorteio rápido</h2>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        Escolhe um momento ou cria um sorteio personalizado
                      </p>
                    </div>
                    <span className="hidden sm:inline-block text-[10px] font-mono text-[#6B7280] bg-[#F7F8FA] px-2 py-1 rounded">
                      1–6
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {DRAW_PRESETS.map((p, i) => (
                      <button
                        key={p.label}
                        onClick={() => runDraw(p.label)}
                        disabled={participants.length === 0}
                        title={p.hint}
                        className="group relative bg-white border border-[#E5E7EB] hover:border-[#0096DC] hover:bg-[#0096DC]/[0.03] active:scale-[0.98] text-[#0A0A0A] font-medium py-3.5 px-3 rounded-xl transition-all text-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-[#E5E7EB] disabled:hover:bg-white disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-[#0096DC] focus-visible:outline-offset-2"
                      >
                        <span className="block text-2xl mb-1" aria-hidden>{p.emoji}</span>
                        <span className="block">{cleanLabel(p.label)}</span>
                        <span className="absolute top-1.5 right-1.5 text-[10px] font-mono text-[#6B7280] opacity-0 group-hover:opacity-100 transition-opacity">
                          {i + 1}
                        </span>
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={e => {
                      e.preventDefault()
                      if (!customLabel.trim()) return
                      runDraw(customLabel.trim())
                      setCustomLabel('')
                    }}
                    className="mt-3 flex gap-2"
                  >
                    <input
                      value={customLabel}
                      onChange={e => setCustomLabel(e.target.value)}
                      placeholder="Sorteio personalizado…"
                      disabled={participants.length === 0}
                      className="flex-1 bg-[#F7F8FA] border border-transparent rounded-xl px-4 py-2.5 text-sm placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition disabled:opacity-50"
                    />
                    <button
                      type="submit"
                      disabled={!customLabel.trim() || participants.length === 0}
                      className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold px-5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0096DC]"
                    >
                      Sortear
                    </button>
                  </form>

                  {participants.length === 0 && (
                    <p className="text-xs text-[#6B7280] mt-3 flex items-center gap-1.5">
                      <InfoIcon />
                      Aguarda os primeiros inscritos para poderes sortear.
                    </p>
                  )}
                </section>

                {/* Participants */}
                <section className="bg-white border border-[#E5E7EB] rounded-2xl">
                  <header className="flex items-center justify-between gap-3 p-5 sm:p-6 pb-4">
                    <div>
                      <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A]">Participantes</h2>
                      <p className="text-xs text-[#6B7280] mt-0.5">
                        {participants.length === 0
                          ? 'Ainda sem inscritos'
                          : `${participants.length} ${participants.length === 1 ? 'inscrito' : 'inscritos'}`}
                        {searchQuery && ` · ${filteredParticipants.length} encontrados`}
                      </p>
                    </div>
                    <button
                      onClick={exportCSV}
                      disabled={participants.length === 0}
                      className="text-xs font-medium text-[#0096DC] hover:text-[#0064B4] px-3 py-1.5 rounded-lg hover:bg-[#0096DC]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      <DownloadIcon />
                      Exportar CSV
                    </button>
                  </header>

                  <div className="px-5 sm:px-6 pb-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                        <SearchIcon />
                      </span>
                      <input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Pesquisar por nome ou telemóvel…"
                        className="w-full bg-[#F7F8FA] border border-transparent rounded-xl pl-10 pr-9 py-2.5 text-sm placeholder:text-[#6B7280] focus:outline-none focus:bg-white focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#E5E7EB]"
                          aria-label="Limpar pesquisa"
                        >
                          ×
                        </button>
                      )}
                      <span className="hidden sm:inline-block absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#6B7280] bg-white border border-[#E5E7EB] rounded px-1.5 py-0.5 pointer-events-none data-[hide=true]:opacity-0"
                        data-hide={!!searchQuery}
                      >
                        /
                      </span>
                    </div>
                  </div>

                  {filteredParticipants.length > 0 ? (
                    <div className="border-t border-[#E5E7EB] max-h-[420px] overflow-y-auto">
                      <ul className="divide-y divide-[#E5E7EB]">
                        {filteredParticipants.map(p => (
                          <li key={p.id} className="px-5 sm:px-6 py-3 flex items-center justify-between gap-3 hover:bg-[#F7F8FA] transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[#0A0A0A] text-sm truncate">{p.name}</p>
                              <p className="text-xs text-[#6B7280] tabular-nums truncate">{p.phone}</p>
                            </div>
                            <span className="text-[11px] text-[#6B7280] tabular-nums whitespace-nowrap">
                              <RelativeTime ts={p.registered_at} short />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : participants.length > 0 && searchQuery ? (
                    <div className="border-t border-[#E5E7EB] py-10 px-6 text-center">
                      <p className="text-sm text-[#6B7280]">Nenhum resultado para “{searchQuery}”</p>
                    </div>
                  ) : (
                    <div className="border-t border-[#E5E7EB] py-12 px-6 text-center">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[#0096DC]/10 flex items-center justify-center text-[#0096DC]">
                        <UsersIcon />
                      </div>
                      <p className="text-sm font-medium text-[#0A0A0A]">À espera dos primeiros inscritos</p>
                      <p className="text-xs text-[#6B7280] mt-1">Os participantes aparecem aqui em tempo real.</p>
                    </div>
                  )}
                </section>
              </div>

              {/* ── Right column / sidebar ────────── */}
              <div className="space-y-6 min-w-0">
                {/* QR preview */}
                <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A]">Inscrição</h2>
                    <a
                      href="/screen"
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-[#0096DC] hover:text-[#0064B4] flex items-center gap-1"
                    >
                      Abrir TV
                      <ExternalIcon />
                    </a>
                  </div>

                  <div className="bg-[#F7F8FA] rounded-xl p-4 flex flex-col items-center">
                    {qr?.qr_data_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qr.qr_data_url} alt="QR de inscrição" className="w-40 h-40 rounded-lg" />
                    ) : (
                      <div className="w-40 h-40 bg-[#E5E7EB] rounded-lg animate-pulse" />
                    )}
                    <p className="text-[11px] text-[#6B7280] mt-3 tracking-wider uppercase">QR rotativo · 2 min</p>
                  </div>

                  <button
                    onClick={copyRegisterLink}
                    disabled={!qr?.register_url}
                    className="mt-3 w-full bg-white border border-[#E5E7EB] hover:border-[#0096DC] hover:bg-[#0096DC]/5 text-[#0A0A0A] font-medium text-sm py-2.5 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-[#0096DC]"
                  >
                    <LinkIcon />
                    Copiar link de inscrição
                  </button>
                </section>

                {/* Activity feed */}
                <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A]">Actividade</h2>
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#6B7280] uppercase tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0096DC] animate-pulse-dot" />
                      Ao vivo
                    </span>
                  </div>

                  {activityFeed.length === 0 ? (
                    <p className="text-sm text-[#6B7280] py-4 text-center">Sem actividade ainda.</p>
                  ) : (
                    <ul className="space-y-3" aria-live="polite">
                      {activityFeed.map(e => (
                        <li key={e.id} className="flex items-start gap-3">
                          <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                            e.kind === 'draw' ? 'bg-[#0096DC] text-white' : 'bg-[#0096DC]/10 text-[#0096DC]'
                          }`}>
                            {e.kind === 'draw' ? <TrophyIconSm /> : <UserPlusIconSm />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-[#0A0A0A] truncate">
                              <span className="font-medium">{e.text}</span>
                              {' '}
                              <span className="text-[#6B7280]">{e.sub}</span>
                            </p>
                            <p className="text-[11px] text-[#6B7280] tabular-nums mt-0.5">
                              <RelativeTime ts={e.ts} />
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Draws timeline */}
                {draws.length > 0 && (
                  <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
                    <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A] mb-4">Sorteios desta sessão</h2>
                    <ol className="relative space-y-3 before:absolute before:left-[7px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-[#E5E7EB]">
                      {draws.map((d, i) => (
                        <li key={d.id} className="relative pl-7">
                          <span className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                            i === 0 ? 'bg-[#0096DC]' : 'bg-[#E5E7EB]'
                          }`} />
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-xs font-medium text-[#6B7280] uppercase tracking-wider">
                              {cleanLabel(d.label)}
                            </span>
                            <span className="text-[11px] text-[#6B7280] tabular-nums">
                              {new Date(d.drawn_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-[#0A0A0A] mt-0.5 truncate">
                            {d.participants?.name ?? '—'}
                          </p>
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            </div>

            {/* End session button (only after at least one draw) */}
            {draws.length > 0 && (
              <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#0A0A0A]">Encerrar este jogo</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">Fecha a sessão e prepara para o próximo. Os inscritos não passam para o jogo seguinte.</p>
                </div>
                <button
                  onClick={endSession}
                  className={`text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors ${
                    confirmEnd
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#0A0A0A]'
                  }`}
                >
                  {confirmEnd ? 'Confirmar fecho' : 'Encerrar jogo'}
                </button>
              </section>
            )}
          </>
        )}

        {/* ─── New game form ──────────────────────────── */}
        {showNewGame && (
          <NewGameModal
            value={newGameName}
            onChange={setNewGameName}
            onSubmit={startNewGame}
            onCancel={() => { setShowNewGame(false); setNewGameName('') }}
          />
        )}

        {/* ─── Closed sessions history ───────────────── */}
        {sessions.filter(s => s.status === 'closed').length > 0 && (
          <section className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6">
            <h2 className="text-base font-semibold tracking-tight text-[#0A0A0A] mb-4">Histórico</h2>
            <ul className="divide-y divide-[#E5E7EB]">
              {sessions.filter(s => s.status === 'closed').slice(0, 8).map(s => (
                <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                  <span className="font-medium text-[#0A0A0A] truncate">{s.name}</span>
                  <span className="text-[11px] text-[#6B7280] tabular-nums whitespace-nowrap">
                    {new Date(s.created_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ─── Floating new-game button when active ─── */}
        {activeSession && !showNewGame && (
          <button
            onClick={() => setShowNewGame(true)}
            className="fixed bottom-6 right-6 z-30 bg-[#0A0A0A] hover:bg-black text-white font-medium text-sm px-5 py-3 rounded-full shadow-lg shadow-black/10 hover:shadow-xl transition-all hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0096DC]"
          >
            + Novo jogo
          </button>
        )}
      </main>

      {/* ─── Toasts ──────────────────────────────────── */}
      <ToastContainer toasts={toasts} />

      {/* ─── Shortcuts modal ─────────────────────────── */}
      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function EmptyDashboard({ onStart, sessions }: { onStart: () => void; sessions: Session[] }) {
  const closed = sessions.filter(s => s.status === 'closed').length
  return (
    <section className="bg-white border border-[#E5E7EB] rounded-2xl p-10 sm:p-14 text-center">
      <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#0096DC]/10 flex items-center justify-center text-[#0096DC]">
        <PlayIcon />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-[#0A0A0A]">Pronto para começar</h2>
      <p className="text-sm text-[#6B7280] mt-2 max-w-sm mx-auto">
        {closed > 0
          ? `Ainda não há jogo activo. Já fizeste ${closed} ${closed === 1 ? 'jogo' : 'jogos'} hoje.`
          : 'Inicia um novo jogo para começar a receber inscrições.'}
      </p>
      <button
        onClick={onStart}
        className="mt-6 bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0096DC]"
      >
        Iniciar novo jogo
      </button>
    </section>
  )
}

function StatCard({ label, value, icon, accent }: { label: string; value: React.ReactNode; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`relative rounded-2xl p-4 sm:p-5 border ${accent ? 'bg-[#0096DC] border-[#0096DC] text-white' : 'bg-white border-[#E5E7EB] text-[#0A0A0A]'}`}>
      <div className="flex items-start justify-between mb-2">
        <span className={`text-[11px] font-medium uppercase tracking-wider ${accent ? 'text-white/80' : 'text-[#6B7280]'}`}>
          {label}
        </span>
        <span className={`${accent ? 'text-white/80' : 'text-[#6B7280]'}`}>{icon}</span>
      </div>
      <div className="text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums leading-none">
        {value}
      </div>
    </div>
  )
}

function NewGameModal({
  value, onChange, onSubmit, onCancel,
}: { value: string; onChange: (v: string) => void; onSubmit: (e: FormEvent) => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onCancel}>
      <form
        onSubmit={onSubmit}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in-up"
      >
        <h2 className="text-xl font-semibold tracking-tight text-[#0A0A0A] mb-1">Novo jogo</h2>
        <p className="text-sm text-[#6B7280] mb-5">A sessão actual será encerrada e os inscritos não passam para o novo jogo.</p>
        <input
          autoFocus
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Ex: Portugal vs Brasil"
          className="w-full bg-[#F7F8FA] border border-transparent rounded-xl px-4 py-3 text-base focus:outline-none focus:bg-white focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition"
        />
        <div className="flex gap-2 mt-5 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-sm font-medium text-[#6B7280] hover:text-[#0A0A0A] px-4 py-2.5 rounded-lg hover:bg-[#F7F8FA] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-sm px-5 py-2.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Iniciar jogo
          </button>
        </div>
      </form>
    </div>
  )
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts: Array<[string, string]> = [
    ['?', 'Mostrar/esconder atalhos'],
    ['/', 'Pesquisar participantes'],
    ['N', 'Novo jogo'],
    ['1 – 6', 'Sortear preset'],
    ['Esc', 'Fechar diálogo'],
  ]
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in-up">
        <h2 className="text-lg font-semibold tracking-tight text-[#0A0A0A] mb-4">Atalhos de teclado</h2>
        <ul className="space-y-2.5">
          {shortcuts.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[#6B7280]">{label}</span>
              <kbd className="font-mono text-xs bg-[#F7F8FA] border border-[#E5E7EB] rounded px-2 py-1 text-[#0A0A0A]">{k}</kbd>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="mt-5 w-full bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#0A0A0A] font-medium text-sm py-2.5 rounded-lg transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  )
}

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg shadow-black/5 max-w-sm animate-fade-in-up ${
            t.kind === 'success' ? 'bg-[#0096DC] text-white' :
            t.kind === 'error'   ? 'bg-red-600 text-white' :
                                   'bg-white border border-[#E5E7EB] text-[#0A0A0A]'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}

function WinnerOverlay({ winner, onContinue }: { winner: { name: string; phone: string; label: string }; onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-[#0096DC] flex flex-col text-white">
      <header className="px-6 py-4">
        <ActiveBankLogo invert />
      </header>
      <main className="flex-1 flex flex-col items-center justify-center text-center px-8 animate-fade-in-up">
        <p className="text-sm font-medium tracking-[0.3em] uppercase opacity-80 mb-6">
          {cleanLabel(winner.label)}
        </p>
        <div className="text-7xl mb-6" aria-hidden>🏆</div>
        <h1 className="text-6xl font-semibold tracking-tight mb-3">{winner.name}</h1>
        <p className="text-xl opacity-80 tabular-nums mb-12">{winner.phone}</p>
        <button
          onClick={onContinue}
          className="bg-white text-[#0096DC] font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors active:scale-95"
          autoFocus
        >
          Continuar
        </button>
      </main>
    </div>
  )
}

function DrawingAnimation({ names, label }: { names: string[]; label: string }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setCount(c => c + 1), 80)
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
          {cleanLabel(label)}
        </p>
        <div className="text-5xl sm:text-6xl font-semibold tracking-tight tabular-nums min-w-64 truncate text-[#0A0A0A]">
          {displayed}
        </div>
        <div className="mt-10 flex gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse-dot" />
          <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
          <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
        </div>
        <p className="text-xs text-[#6B7280] mt-8 uppercase tracking-wider">A sortear…</p>
      </main>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Time / live components
// ═══════════════════════════════════════════════════════════════════════════

function SessionUptime({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  const diff = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  const hh = String(Math.floor(diff / 3600)).padStart(2, '0')
  const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0')
  const ss = String(diff % 60).padStart(2, '0')
  return (
    <span className="font-mono text-sm tabular-nums text-[#6B7280] bg-[#F7F8FA] px-2.5 py-1 rounded-md">
      {hh}:{mm}:{ss}
    </span>
  )
}

function UptimeValue({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [])
  const diff = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000))
  if (diff < 60) return <>{diff}s</>
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (h === 0) return <>{m}m</>
  return <>{h}h {String(m).padStart(2, '0')}m</>
}

function RelativeTime({ ts, short }: { ts: string; short?: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(iv)
  }, [])
  const diff = Math.max(0, Math.floor((now - new Date(ts).getTime()) / 1000))
  if (diff < 5) return <>agora</>
  if (diff < 60) return <>{short ? `${diff}s` : `há ${diff}s`}</>
  if (diff < 3600) {
    const m = Math.floor(diff / 60)
    return <>{short ? `${m}m` : `há ${m} min`}</>
  }
  if (diff < 86400) {
    const h = Math.floor(diff / 3600)
    return <>{short ? `${h}h` : `há ${h}h`}</>
  }
  const d = Math.floor(diff / 86400)
  return <>{short ? `${d}d` : `há ${d} dias`}</>
}

function LiveDot() {
  return (
    <span className="relative flex w-2 h-2" aria-label="Sessão ao vivo">
      <span className="absolute inset-0 rounded-full bg-[#0096DC] animate-ping opacity-50" />
      <span className="relative w-2 h-2 rounded-full bg-[#0096DC]" />
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers / icons
// ═══════════════════════════════════════════════════════════════════════════

function cleanLabel(label: string): string {
  return label.replace(/^[\p{Extended_Pictographic}\s]+/u, '').trim() || label
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

// — Icons (inline SVG, 16px default) —
const iconCls = 'w-4 h-4'
function UsersIcon()      { return <svg className={iconCls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-2a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zm-12 0a3 3 0 100-6 3 3 0 000 6z"/></svg> }
function TrophyIcon()     { return <svg className={iconCls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4-4h8m-9-9V5a2 2 0 012-2h6a2 2 0 012 2v3m-10 0a4 4 0 008 0M5 8H3v3a3 3 0 003 3m13-6h2v3a3 3 0 01-3 3"/></svg> }
function ClockIcon()      { return <svg className={iconCls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2"/></svg> }
function PulseIcon()      { return <svg className={iconCls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l2-6 4 12 2-6h6"/></svg> }
function SearchIcon()     { return <svg className={iconCls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4-4"/></svg> }
function DownloadIcon()   { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg> }
function LinkIcon()       { return <svg className={iconCls} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 13a5 5 0 007.07 0l3-3a5 5 0 00-7.07-7.07l-1 1m-3 3a5 5 0 00-7.07 0l-3 3a5 5 0 007.07 7.07l1-1"/></svg> }
function ExternalIcon()   { return <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 4h6v6m0-6L10 14m-6 6h6v-6"/></svg> }
function KeyboardIcon()   { return <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="2"/><path strokeLinecap="round" d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h12"/></svg> }
function InfoIcon()       { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 8h.01M12 12v4"/></svg> }
function PlayIcon()       { return <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> }
function TrophyIconSm()   { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M7 5h10v3a5 5 0 11-10 0V5z"/></svg> }
function UserPlusIconSm() { return <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm11-2v6m-3-3h6"/></svg> }

// ═══════════════════════════════════════════════════════════════════════════
// Root
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false)
  return unlocked
    ? <Dashboard onLogout={() => setUnlocked(false)} />
    : <PinGate onUnlock={() => setUnlocked(true)} />
}
