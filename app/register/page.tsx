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
      <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="text-7xl mb-4">🎉</div>
        <h1 className="text-3xl font-black mb-2">Estás inscrito!</h1>
        <p className="text-lg opacity-80 mb-1">Sorteio: <strong>{sessionName}</strong></p>
        <p className="opacity-60 text-sm mt-4">Fica atento ao ecrã grande.<br />Boa sorte! 🍀</p>
        <div className="mt-10 opacity-40">
          <ActiveBankLogo />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <ActiveBankLogo />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h1 className="text-2xl font-black text-[#00205B] mb-1">Participar no sorteio</h1>
          <p className="text-sm text-gray-500 mb-6">Preenche os teus dados para entrar</p>

          {state === 'error' && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                Nome
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O teu nome"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004AAD]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">
                Telemóvel
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+351 9xx xxx xxx"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#004AAD]"
              />
            </div>

            <button
              type="submit"
              disabled={state === 'loading'}
              className="bg-[#E8B400] text-[#00205B] font-black text-lg py-3 rounded-xl hover:bg-[#f5c800] transition-colors disabled:opacity-60"
            >
              {state === 'loading' ? 'A inscrever…' : 'Entrar no Sorteio'}
            </button>
          </form>
        </div>

        <p className="text-center text-white text-xs opacity-40 mt-6">
          Os dados são usados apenas para contacto em caso de prémio.
        </p>
      </div>
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

function ActiveBankLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-full bg-[#E8B400] flex items-center justify-center font-black text-[#00205B] text-lg">
        AB
      </div>
      <span className="text-xl font-bold tracking-tight text-white">Active Bank</span>
    </div>
  )
}
