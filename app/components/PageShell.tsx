export function PageHeader() {
  return (
    <header className="border-b border-[#E5E7EB] px-6 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />
    </header>
  )
}

export function PageFooter() {
  return (
    <footer className="border-t border-[#E5E7EB] px-6 py-4 text-center">
      <p className="text-xs text-[#6B7280]">ActivoBank · Fan Zone Mundial 2026</p>
    </footer>
  )
}
