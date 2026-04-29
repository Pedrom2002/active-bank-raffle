import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { validateToken } from '@/lib/tokens'
import { checkRateLimit } from '@/lib/rate-limit'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const uuidRe = /^[0-9a-f-]{36}$/i

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number'),
  email: z.string().email().max(200),
  token: z.string().min(1),
  consent: z.boolean().refine((v) => v === true, 'Consent required'),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const isAdmin = await isAdminAuthenticated(req)
  const selectFields = isAdmin ? 'id, raffle_id, name, phone, email, registered_at' : 'id, raffle_id, name, registered_at'

  const { data, error } = await supabaseAdmin
    .from('raffle_participants')
    .select(selectFields)
    .eq('raffle_id', id)
    .order('registered_at', { ascending: false })
    .limit(20)
  if (error) {
    console.error('[participants] GET error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }
  return Response.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req)
  const allowed = await checkRateLimit(`register:${ip}`, 5, 600)
  if (!allowed) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'participants.register', ip })
    return Response.json({ error: 'Demasiadas inscrições. Tenta de novo mais tarde.' }, { status: 429 })
  }

  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const parsed = registerSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Dados inválidos. Verifica o formulário.' }, { status: 400 })
  }

  const { name, phone, email, token } = parsed.data

  const { data: raffle, error: raffleErr } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status')
    .eq('id', id)
    .single()

  if (raffleErr || !raffle) return Response.json({ error: 'Raffle not found' }, { status: 404 })
  if (raffle.status !== 'active') {
    return Response.json({ error: 'Este sorteio já encerrou.' }, { status: 410 })
  }

  if (!validateToken(id, token)) {
    return Response.json({ error: 'QR code expirado. Escaneia o código mais recente no ecrã.' }, { status: 422 })
  }

  const { data, error } = await supabaseAdmin
    .from('raffle_participants')
    .insert({ raffle_id: id, name: name.trim(), phone: phone.trim(), email: email.trim() })
    .select('id, raffle_id, name, registered_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      return Response.json({ error: 'Já estás inscrito neste sorteio!' }, { status: 409 })
    }
    console.error('[participants] POST error:', error.message)
    return Response.json({ error: 'Erro ao registar. Tenta de novo.' }, { status: 500 })
  }

  audit({ event: 'participant.registered', raffleId: id, participantId: data.id, ip })
  return Response.json({ ...data, raffle_label: raffle.label }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)

  const allowed = await checkRateLimit(`delete-participant:${ip}`, 20, 3600)
  if (!allowed) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'participants.delete', ip })
    return Response.json({ error: 'Too many deletion requests.' }, { status: 429 })
  }

  const { id: raffleId } = await params
  const participantId = req.nextUrl.searchParams.get('participant_id')

  if (!raffleId || !uuidRe.test(raffleId)) {
    return Response.json({ error: 'Invalid raffle id.' }, { status: 400 })
  }
  if (!participantId || !uuidRe.test(participantId)) {
    return Response.json({ error: 'Invalid participant_id.' }, { status: 400 })
  }

  // Verify participant belongs to this raffle before deleting (prevents IDOR)
  const { data: participant, error: lookupError } = await supabaseAdmin
    .from('raffle_participants')
    .select('id')
    .eq('id', participantId)
    .eq('raffle_id', raffleId)
    .single()

  if (lookupError || !participant) {
    return Response.json({ error: 'Participant not found in this raffle.' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.rpc('delete_raffle_participant_data', {
    p_participant_id: participantId,
  })

  if (error) {
    console.error('[participants] DELETE error:', error.message)
    return Response.json({ error: 'Failed to delete participant data.' }, { status: 500 })
  }

  audit({ event: 'participant.deleted', participantId, raffleId, ip })
  return Response.json({ ok: true })
}
