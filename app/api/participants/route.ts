import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { validateToken } from '@/lib/tokens'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[0-9\s\-]{7,20}$/, 'Invalid phone number'),
  token: z.string().min(1),
  session_id: z.string().uuid(),
})

const uuidRe = /^[0-9a-f-]{36}$/i

// GET /api/participants?session_id=xxx — list participants (phone visible to admin only)
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId || !uuidRe.test(sessionId)) {
    return Response.json({ error: 'Invalid session_id.' }, { status: 400 })
  }

  const isAdmin = await isAdminAuthenticated(req)
  const selectFields = isAdmin ? '*' : 'id, name, registered_at'

  const { data, error } = await supabaseAdmin
    .from('participants')
    .select(selectFields)
    .eq('session_id', sessionId)
    .order('registered_at', { ascending: false })

  if (error) {
    console.error('[participants] GET error:', error.message)
    return Response.json({ error: 'Failed to fetch participants.' }, { status: 500 })
  }
  return Response.json(data)
}

// POST /api/participants — register participant
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // 5 registrations per 10 minutes per IP
  const allowed = await checkRateLimit(`register:${ip}`, 5, 600)
  if (!allowed) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'participants.register', ip })
    return Response.json(
      { error: 'Demasiadas inscrições. Tenta de novo mais tarde.' },
      { status: 429 },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Dados inválidos. Verifica o formulário.' }, { status: 400 })
  }

  const { name, phone, token, session_id } = parsed.data

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, name, status')
    .eq('id', session_id)
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: 'Session not found.' }, { status: 404 })
  }
  if (session.status !== 'active') {
    return Response.json({ error: 'O sorteio deste jogo já encerrou.' }, { status: 410 })
  }

  if (!validateToken(session_id, token)) {
    return Response.json(
      { error: 'QR code expirado. Escaneia o código mais recente no ecrã.' },
      { status: 422 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('participants')
    .insert({ session_id, name: name.trim(), phone: phone.trim() })
    .select('id, name, registered_at, session_id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'Já estás inscrito neste jogo!' }, { status: 409 })
    }
    console.error('[participants] POST error:', error.message)
    return Response.json({ error: 'Erro ao registar. Tenta de novo.' }, { status: 500 })
  }

  audit({ event: 'participant.registered', sessionId: session_id, participantId: data.id, ip })
  return Response.json({ ...data, session_name: session.name }, { status: 201 })
}

// DELETE /api/participants?id=<uuid> — GDPR right to erasure (admin only)
export async function DELETE(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const participantId = req.nextUrl.searchParams.get('id')

  if (!participantId || !uuidRe.test(participantId)) {
    return Response.json({ error: 'Invalid participant id.' }, { status: 400 })
  }

  // Fetch the participant first to get the session_id for the audit log
  const { data: participant } = await supabaseAdmin
    .from('participants')
    .select('id, session_id')
    .eq('id', participantId)
    .single()

  if (!participant) {
    return Response.json({ error: 'Participant not found.' }, { status: 404 })
  }

  // Atomic erasure: nulls draw/session winner references before deleting (P15 GDPR)
  const { error } = await supabaseAdmin.rpc('delete_participant_data', {
    p_participant_id: participantId,
  })

  if (error) {
    console.error('[participants] DELETE error:', error.message)
    return Response.json({ error: 'Failed to delete participant data.' }, { status: 500 })
  }

  audit({
    event: 'participant.deleted',
    participantId,
    sessionId: participant.session_id,
    ip,
  })
  return Response.json({ ok: true })
}
