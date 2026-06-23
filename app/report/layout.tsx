import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ActivoBank Lounge — Relatório GoalFest',
}

export default function ReportLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          .day-section { page-break-inside: avoid; }
        }
        @page { margin: 16mm 14mm; size: A4 portrait; }
      `}</style>
      {children}
    </>
  )
}
