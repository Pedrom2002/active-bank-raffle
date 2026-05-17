export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center text-center px-6">
      <p className="text-6xl font-black text-[#0096DC] mb-4">404</p>
      <h1 className="text-2xl font-semibold text-[#0A0A0A] mb-2">Página não encontrada</h1>
      <p className="text-sm text-[#6B7280] mb-6 max-w-xs">
        A página que procuras não existe ou foi removida.
      </p>
      <a
        href="/"
        className="bg-[#0096DC] text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-[#0064B4] transition-colors"
      >
        Voltar ao início
      </a>
    </div>
  )
}
