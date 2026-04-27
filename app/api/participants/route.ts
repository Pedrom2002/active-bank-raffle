import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateToken } from '@/lib/tokens'

// GET /api/participants?session_id=xxx — list participants for a session
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('session_id', sessionId)
    .order('registered_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST /api/participants — register participant
export async function POST(req: NextRequest) {
  const { name, phone, token, session_id } = await req.json()

  if (!name?.trim() || !phone?.trim() || !token || !session_id) {
    return Response.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Verify session is active
  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, name, status')
    .eq('id', session_id)
    .single()

  if (sessionErr || !session) return Response.json({ error: 'Session not found' }, { status: 404 })
  if (session.status !== 'active') {
    return Response.json({ error: 'O sorteio deste jogo já encerrou.' }, { status: 410 })
  }

  // Validate QR token
  if (!validateToken(session_id, token)) {
    return Response.json({ error: 'QR code expirado. Escaneia o código mais recente no ecrã.' }, { status: 422 })
  }

  // Insert participant (unique constraint handles duplicates)
  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert({ session_id, name: name.trim(), phone: phone.trim() })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'Já estás inscrito neste jogo!' }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ...data, session_name: session.name }, { status: 201 })
}
