import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ActivoBank Lounge',
  description: 'Estatísticas do stand ActivoBank no Mundial 2026',
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children
}
