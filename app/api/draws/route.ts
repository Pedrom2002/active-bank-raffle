import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'
import { requireAdmin } from '@/lib/require-admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'

const createSchema = z.object({ label: z.string().min(1).max(100) })

// POST /api/draws — create a new draw for the active session (admin only)
export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid label.' }, { status: 400 })
  }

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: 'Nenhum jogo activo' }, { status: 404 })
  }

  // Enforce 30-second cooldown between draws to prevent rapid result manipulation
  const { data: lastDraw } = await supabaseAdmin
    .from('draws')
    .select('drawn_at')
    .eq('session_id', session.id)
    .order('drawn_at', { ascending: false })
    .limit(1)
    .single()

  if (lastDraw) {
    const secondsSinceLast = (Date.now() - new Date(lastDraw.drawn_at).getTime()) / 1000
    if (secondsSinceLast < 30) {
      return Response.json(
        { error: `Aguarda ${Math.ceil(30 - secondsSinceLast)}s antes do próximo sorteio.` },
        { status: 429 },
      )
    }
  }

  const { data: participants, error: partErr } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('session_id', session.id)

  if (partErr) {
    console.error('[draws] fetch participants error:', partErr.message)
    return Response.json({ error: 'Failed to fetch participants.' }, { status: 500 })
  }
  if (!participants || participants.length === 0) {
    return Response.json({ error: 'Nenhum participante inscrito' }, { status: 400 })
  }

  const winner = pickWinner(participants)

  const { data: draw, error: drawErr } = await supabaseAdmin
    .from('draws')
    .insert({ session_id: session.id, label: parsed.data.label.trim(), winner_id: winner.id })
    .select('*, participants!draws_winner_id_fkey(name, phone)')
    .single()

  if (drawErr) {
    console.error('[draws] insert error:', drawErr.message)
    return Response.json({ error: 'Failed to create draw.' }, { status: 500 })
  }

  audit({
    event: 'draw.created',
    sessionId: session.id,
    drawId: draw.id,
    label: parsed.data.label.trim(),
    winnerId: winner.id,
    totalParticipants: participants.length,
    ip,
  })

  return Response.json({
    draw,
    winner: { name: winner.name, phone: winner.phone },
    total_participants: participants.length,
    session_name: session.name,
  }, { status: 201 })
}

// GET /api/draws?session_id=X — list draws; phone only returned to authenticated admin
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const latest = req.nextUrl.searchParams.get('latest') === '1'

  if (!sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
    return Response.json({ error: 'Invalid session_id.' }, { status: 400 })
  }

  const isAdmin = await isAdminAuthenticated(req)
  const selectFields = isAdmin
    ? '*, participants!draws_winner_id_fkey(name, phone)'
    : '*, participants!draws_winner_id_fkey(name)'

  const query = supabaseAdmin
    .from('draws')
    .select(selectFields)
    .eq('session_id', sessionId)
    .order('drawn_at', { ascending: false })

  if (latest) {
    const { data, error } = await query.limit(1).single()
    if (error) return Response.json({ draw: null })
    return Response.json({ draw: data })
  }

  const { data, error } = await query
  if (error) {
    console.error('[draws] GET error:', error.message)
    return Response.json({ error: 'Failed to fetch draws.' }, { status: 500 })
  }
  return Response.json(data)
}
