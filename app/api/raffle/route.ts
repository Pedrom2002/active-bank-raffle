import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'

// POST /api/raffle — run the draw for the active session
export async function POST() {
  // Get active session
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

  // Get all participants for this session
  const { data: participants, error: partErr } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('session_id', session.id)

  if (partErr) return Response.json({ error: partErr.message }, { status: 500 })
  if (!participants || participants.length === 0) {
    return Response.json({ error: 'Nenhum participante inscrito' }, { status: 400 })
  }

  const winner = pickWinner(participants)

  // Save winner to session
  const { error: updateErr } = await supabaseAdmin
    .from('sessions')
    .update({ winner_id: winner.id })
    .eq('id', session.id)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  return Response.json({
    winner,
    total_participants: participants.length,
    session_name: session.name,
  })
}

// GET /api/raffle — get winner of active session (if drawn)
export async function GET() {
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, name, winner_id, participants!sessions_winner_id_fkey(*)')
    .eq('status', 'active')
    .single()

  if (!session) return Response.json({ winner: null })

  return Response.json({ winner: session.winner_id ? (session as any).participants : null })
}
