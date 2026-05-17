'use client'

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-2">Algo correu mal</h1>
      <p className="text-sm text-[#6B7280] mb-6 max-w-xs">
        {error.message ?? 'Ocorreu um erro inesperado. Tenta de novo.'}
      </p>
      <button
        onClick={reset}
        className="bg-[#0096DC] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#0064B4] transition-colors"
      >
        Tentar de novo
      </button>
    </div>
  )
}
