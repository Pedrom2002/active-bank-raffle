import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'

// POST /api/draws — create a new draw for the active session
// Body: { label: string }
export async function POST(req: NextRequest) {
  const { label } = await req.json()
  if (!label?.trim()) return Response.json({ error: 'label required' }, { status: 400 })

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: 'Nenhum jogo activo' }, { status: 404 })
  }

  const { data: participants, error: partErr } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('session_id', session.id)

  if (partErr) return Response.json({ error: partErr.message }, { status: 500 })
  if (!participants || participants.length === 0) {
    return Response.json({ error: 'Nenhum participante inscrito' }, { status: 400 })
  }

  const winner = pickWinner(participants)

  const { data: draw, error: drawErr } = await supabaseAdmin
    .from('draws')
    .insert({ session_id: session.id, label: label.trim(), winner_id: winner.id })
    .select('*, participants!draws_winner_id_fkey(name, phone)')
    .single()

  if (drawErr) return Response.json({ error: drawErr.message }, { status: 500 })

  return Response.json({
    draw,
    winner: { name: winner.name, phone: winner.phone },
    total_participants: participants.length,
    session_name: session.name,
  }, { status: 201 })
}

// GET /api/draws?session_id=X — list all draws for a session
// GET /api/draws?session_id=X&latest=1 — get only the latest draw
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const latest = req.nextUrl.searchParams.get('latest') === '1'

  if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 })

  const query = supabaseAdmin
    .from('draws')
    .select('*, participants!draws_winner_id_fkey(name, phone)')
    .eq('session_id', sessionId)
    .order('drawn_at', { ascending: false })

  if (latest) {
    const { data, error } = await query.limit(1).single()
    if (error) return Response.json({ draw: null })
    return Response.json({ draw: data })
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
