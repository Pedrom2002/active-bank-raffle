import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

// POST /api/raffle — run the final draw for the active session (admin only)
export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, name, winner_id')
    .eq('status', 'active')
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: 'Nenhum jogo activo' }, { status: 404 })
  }

  if (session.winner_id) {
    return Response.json({ error: 'Este jogo já tem vencedor' }, { status: 409 })
  }

  const { data: participants, error: partErr } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('session_id', session.id)

  if (partErr) {
    console.error('[raffle] fetch participants error:', partErr.message)
    return Response.json({ error: 'Failed to fetch participants.' }, { status: 500 })
  }
  if (!participants || participants.length === 0) {
    return Response.json({ error: 'Nenhum participante inscrito' }, { status: 400 })
  }

  const winner = pickWinner(participants)

  const { error: updateErr } = await supabaseAdmin
    .from('sessions')
    .update({ winner_id: winner.id })
    .eq('id', session.id)

  if (updateErr) {
    console.error('[raffle] update error:', updateErr.message)
    return Response.json({ error: 'Failed to record winner.' }, { status: 500 })
  }

  audit({
    event: 'raffle.winner.selected',
    sessionId: session.id,
    winnerId: winner.id,
    totalParticipants: participants.length,
    ip,
  })

  return Response.json({
    winner: { name: winner.name, phone: winner.phone },
    total_participants: participants.length,
    session_name: session.name,
  })
}

// GET /api/raffle — get winner of active session (public, phone stripped)
export async function GET() {
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, winner_id')
    .eq('status', 'active')
    .single()

  if (!session?.winner_id) return Response.json({ winner: null })

  const { data: winner } = await supabaseAdmin
    .from('participants')
    .select('name')
    .eq('id', session.winner_id)
    .single()

  return Response.json({ winner: winner ?? null })
}
