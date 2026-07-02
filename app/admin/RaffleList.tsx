import type { Raffle, RaffleParticipant as Participant } from '@/lib/types'

interface Props {
  activeRaffles: Raffle[]
  closedWithoutWinner: Raffle[]
  closedWithWinner: Raffle[]
  archivedRaffles: Raffle[]
  participants: Record<string, Participant[]>
  winners: Record<string, { name: string; phone: string }>
  drawingId: string | null
  redrawingId: string | null
  showArchive: boolean
  onToggleArchive: () => void
  onDraw: (id: string, label: string) => void
  onRedraw: (id: string, label: string) => void
  onClose: (id: string) => void
  onReplay: (id: string, label: string) => void
  onArchive: (id: string) => void
  onUnarchive: (id: string) => void
}

export function RaffleList({
  activeRaffles, closedWithoutWinner, closedWithWinner, archivedRaffles,
  participants, winners, drawingId, redrawingId, showArchive,
  onToggleArchive, onDraw, onRedraw, onClose, onReplay, onArchive, onUnarchive,
}: Props) {
  const isEmpty =
    activeRaffles.length === 0 &&
    closedWithoutWinner.length === 0 &&
    closedWithWinner.length === 0 &&
    archivedRaffles.length === 0

  return (
    <>
      {activeRaffles.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider px-1">Ativos</h2>
          {activeRaffles.map(r => {
            const parts = participants[r.id] ?? []
            return (
              <div key={r.id} className="bg-white border border-[#0096DC]/30 rounded-2xl p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0096DC] animate-pulse flex-shrink-0" />
                    <h3 className="text-lg font-semibold text-[#0A0A0A]">{r.label}</h3>
                  </div>
                  <span className="text-2xl font-semibold tabular-nums text-[#0096DC]">{parts.length}</span>
                </div>
                <p className="text-xs text-[#6B7280] mb-4">
                  {parts.length === 0 ? 'Sem inscritos ainda' : `${parts.length} inscrito${parts.length === 1 ? '' : 's'}`}
                </p>
                {parts.length > 0 && (
                  <div className="border-t border-[#E5E7EB] max-h-40 overflow-y-auto mb-4">
                    <ul className="divide-y divide-[#E5E7EB]">
                      {parts.map(p => (
                        <li key={p.id} className="px-1 py-2 flex items-center justify-between text-sm">
                          <span className="font-medium text-[#0A0A0A]">{p.name}</span>
                          <span className="text-xs text-[#6B7280] tabular-nums">{p.phone}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => onDraw(r.id, r.label)}
                    disabled={drawingId === r.id || parts.length === 0}
                    className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 whitespace-nowrap"
                    title={parts.length === 0 ? 'Sem inscritos para sortear' : ''}
                  >
                    {drawingId === r.id ? 'A sortear…' : 'Sortear vencedor'}
                  </button>
                  <button onClick={() => onClose(r.id)}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#0A0A0A] transition-colors">
                    Encerrar sem vencedor
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {closedWithoutWinner.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider px-1">Encerrados — sem vencedor</h2>
          {closedWithoutWinner.map(r => {
            const parts = participants[r.id]
            return (
              <div key={r.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-[#0A0A0A]">{r.label}</h3>
                  <p className="text-xs text-[#6B7280] mt-0.5">{parts ? `${parts.length} inscritos` : '…'}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => onDraw(r.id, r.label)} disabled={drawingId === r.id}
                    className="bg-[#0096DC] hover:bg-[#0064B4] text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors disabled:opacity-60 whitespace-nowrap">
                    {drawingId === r.id ? 'A sortear…' : 'Sortear vencedor'}
                  </button>
                  <button onClick={() => onArchive(r.id)}
                    className="text-sm px-3 py-2.5 rounded-xl bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                    Arquivar
                  </button>
                </div>
              </div>
            )
          })}
        </section>
      )}

      {closedWithWinner.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider px-1">Concluídos</h2>
          {closedWithWinner.map(r => {
            const w = winners[r.id]
            return (
            <div key={r.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#0A0A0A]">{r.label}</h3>
                <p className="text-xs mt-0.5 truncate">
                  {w
                    ? <span className="text-[#0A0A0A]">🏆 <span className="font-medium">{w.name}</span> <span className="text-[#6B7280] tabular-nums">{w.phone}</span></span>
                    : <span className="text-[#6B7280]">Vencedor sorteado</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => onRedraw(r.id, r.label)} disabled={redrawingId === r.id}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                  title="Marcar o vencedor como ausente e sortear outro">
                  {redrawingId === r.id ? 'A sortear…' : 'Ausente — sortear novamente'}
                </button>
                <button onClick={() => onReplay(r.id, r.label)}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#0096DC]/10 hover:bg-[#0096DC]/20 text-[#0096DC] transition-colors flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 1 0 4-4V1L3.5 3 6 5V4a3 3 0 1 1-3 3H2a4 4 0 0 1 0-1Z" fill="currentColor"/></svg>
                  Mostrar no ecrã
                </button>
                <button onClick={() => onArchive(r.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                  Arquivar
                </button>
              </div>
            </div>
            )
          })}
        </section>
      )}

      {archivedRaffles.length > 0 && (
        <section className="bg-white border border-[#E5E7EB] rounded-2xl overflow-hidden">
          <button
            onClick={onToggleArchive}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F7F8FA] transition-colors"
          >
            <span className="text-sm font-semibold text-[#6B7280]">Arquivo ({archivedRaffles.length})</span>
            <span className={`text-[#6B7280] transition-transform text-xs ${showArchive ? 'rotate-180' : ''}`}>▼</span>
          </button>
          {showArchive && (
            <ul className="divide-y divide-[#E5E7EB] border-t border-[#E5E7EB]">
              {archivedRaffles.map(r => (
                <li key={r.id} className="px-5 py-3 flex items-center justify-between text-sm gap-3">
                  <div>
                    <span className="font-medium text-[#0A0A0A]">{r.label}</span>
                    {r.winner_id && <span className="ml-2 text-xs text-[#6B7280]">✓ vencedor sorteado</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[11px] text-[#6B7280] tabular-nums whitespace-nowrap">
                      {r.ends_at ? new Date(r.ends_at).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                    {r.winner_id && (
                      <button onClick={() => onReplay(r.id, r.label)}
                        className="text-xs text-[#0096DC] hover:text-[#0064B4] transition-colors">
                        Mostrar no ecrã
                      </button>
                    )}
                    <button onClick={() => onUnarchive(r.id)}
                      className="text-xs text-[#6B7280] hover:text-[#0A0A0A] transition-colors">
                      Restaurar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isEmpty && (
        <section className="bg-white border border-[#E5E7EB] rounded-2xl p-10 text-center">
          <p className="text-[#6B7280] text-sm">Nenhum sorteio criado ainda. Usa o botão acima para ativar o primeiro.</p>
        </section>
      )}
    </>
  )
}
