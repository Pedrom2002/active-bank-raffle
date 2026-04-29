import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'
import { requireAdmin } from '@/lib/require-admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'

const uuidRe = /^[0-9a-f-]{36}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const isAdmin = await isAdminAuthenticated(req)

  const { data, error } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at, raffle_participants!raffles_winner_id_fkey(name)')
    .eq('id', id)
    .single()
  if (error) return Response.json({ error: error.message }, { status: 404 })

  if (!isAdmin && data.raffle_participants) {
    // Strip PII from winner for non-admin
    const winner = data.raffle_participants as unknown as { name: string }
    return Response.json({ ...data, raffle_participants: winner ? { name: winner.name } : null })
  }

  return Response.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const body = await req.json().catch(() => null)
  const parsed = z.object({ action: z.enum(['close', 'draw']) }).safeParse(body)
  if (!parsed.success) return Response.json({ error: 'action must be close or draw' }, { status: 400 })

  const { action } = parsed.data

  if (action === 'close') {
    const { data, error } = await supabaseAdmin
      .from('raffles')
      .update({ status: 'closed', ends_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    audit({ event: 'raffle.closed', raffleId: id, ip })
    return Response.json(data)
  }

  // action === 'draw'
  const { data: raffle, error: raffleErr } = await supabaseAdmin
    .from('raffles')
    .select('id, status')
    .eq('id', id)
    .single()
  if (raffleErr || !raffle) return Response.json({ error: 'Raffle not found' }, { status: 404 })
  if (raffle.status !== 'closed') {
    return Response.json({ error: 'Close the raffle before drawing a winner' }, { status: 400 })
  }

  const { data: participants, error: partErr } = await supabaseAdmin
    .from('raffle_participants')
    .select('id, raffle_id, name, registered_at')
    .eq('raffle_id', id)
  if (partErr) return Response.json({ error: partErr.message }, { status: 500 })
  if (!participants || participants.length === 0) {
    return Response.json({ error: 'No participants in this raffle' }, { status: 400 })
  }

  const winner = pickWinner(participants)
  const { data, error } = await supabaseAdmin
    .from('raffles')
    .update({ winner_id: winner.id })
    .eq('id', id)
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
    .single()
  if (error) return Response.json({ error: error.message }, { status: 500 })

  audit({ event: 'raffle.winner.selected', raffleId: id, winnerId: winner.id, totalParticipants: participants.length, ip })
  return Response.json({ raffle: data, winner })
}
