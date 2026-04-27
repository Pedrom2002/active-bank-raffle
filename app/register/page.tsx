'use client'

import { useSearchParams } from 'next/navigation'
import { useState, FormEvent, Suspense } from 'react'

type State = 'idle' | 'loading' | 'success' | 'error'

function RegisterForm() {
  const params = useSearchParams()
  const token = params.get('token') ?? ''
  const sessionId = params.get('session_id') ?? ''

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [state, setState] = useState<State>('idle')
  const [message, setMessage] = useState('')
  const [sessionName, setSessionName] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setState('loading')

    const res = await fetch('/api/participants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, token, session_id: sessionId }),
    })

    const data = await res.json()

    if (res.ok) {
      setSessionName(data.session_name)
      setState('success')
    } else {
      setMessage(data.error ?? 'Erro inesperado.')
      setState('error')
    }
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#0096DC]/10 flex items-center justify-center mb-6">
            <svg className="w-8 h-8 text-[#0096DC]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-semibold text-[#0A0A0A] tracking-tight mb-2">Inscrição confirmada</h1>
          <p className="text-[#6B7280] mb-1">Sorteio</p>
          <p className="text-lg font-medium text-[#0A0A0A] mb-8">{sessionName}</p>
          <p className="text-sm text-[#6B7280] max-w-xs">
            Acompanha o ecrã na Fan Zone. Caso sejas o vencedor, será contactado pela equipa ActivoBank.
          </p>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm animate-fade-in-up">
          <h1 className="text-3xl font-semibold tracking-tight text-[#0A0A0A] mb-2">
            Participar no sorteio
          </h1>
          <p className="text-[#6B7280] mb-8 text-sm leading-relaxed">
            Preenche os teus dados para entrares no sorteio da Fan Zone ActivoBank.
          </p>

          {state === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 mb-6 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-[#6B7280] mb-1.5">
                Nome
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O teu nome"
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-[#0A0A0A] placeholder:text-gray-400 focus:outline-none focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-xs font-medium text-[#6B7280] mb-1.5">
                Telemóvel
              </label>
              <input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 9XX XXX XXX"
                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-[#0A0A0A] placeholder:text-gray-400 focus:outline-none focus:border-[#0096DC] focus:ring-2 focus:ring-[#0096DC]/20 transition"
              />
            </div>

            <button
              type="submit"
              disabled={state === 'loading'}
              className="mt-2 bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-base py-3.5 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {state === 'loading' ? 'A inscrever…' : 'Entrar no sorteio'}
            </button>
          </form>

          <p className="text-xs text-[#6B7280] mt-6 leading-relaxed">
            Os dados serão usados apenas para contacto em caso de prémio. Tratamento conforme RGPD.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}

function Header() {
  return (
    <header className="border-b border-[#E5E7EB] px-6 py-4">
      <ActiveBankLogo />
    </header>
  )
}

function Footer() {
  return (
    <footer className="border-t border-[#E5E7EB] px-6 py-4 text-center">
      <p className="text-xs text-[#6B7280]">
        ActivoBank · Fan Zone Mundial 2026
      </p>
    </footer>
  )
}

function ActiveBankLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-full bg-[#0096DC] flex items-center justify-center">
        <span className="text-white font-bold text-xs tracking-tight">A</span>
      </div>
      <span className="text-base font-semibold tracking-tight text-[#0A0A0A]">
        ActivoBank
      </span>
    </div>
  )
}
