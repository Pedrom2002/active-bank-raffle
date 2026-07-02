import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'
import { requireAdmin } from '@/lib/require-admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const uuidRe = /^[0-9a-f-]{36}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const isAdmin = await isAdminAuthenticated(req)

  const { data, error } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at, raffle_participants!fk_raffle_winner(name, phone)')
    .eq('id', id)
    .single()
  if (error) {
    console.error('[raffles/id] GET error:', error.message)
    return Response.json({ error: 'Raffle not found.' }, { status: 404 })
  }

  if (!isAdmin && data.raffle_participants) {
    // Screen (non-admin) needs name + phone to announce the winner on TV.
    const winner = data.raffle_participants as unknown as { name: string; phone: string }
    return Response.json({ ...data, raffle_participants: winner ? { name: winner.name, phone: winner.phone } : null })
  }

  return Response.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const ip = getClientIp(req)
  const body = await req.json().catch(() => null)
  const parsed = z.object({ action: z.enum(['close', 'draw', 'redraw']) }).safeParse(body)
  if (!parsed.success) return Response.json({ error: 'action must be close, draw or redraw' }, { status: 400 })

  const { action } = parsed.data

  if (action === 'close') {
    const { data, error } = await supabaseAdmin
      .from('raffles')
      .update({ status: 'closed', ends_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
      .single()
    if (error) {
      console.error('[raffles/id] close error:', error.message)
      return Response.json({ error: 'Internal server error.' }, { status: 500 })
    }
    audit({ event: 'raffle.closed', raffleId: id, ip })
    return Response.json(data)
  }

  if (action === 'redraw') {
    // The RPC excludes the current (absent) winner and draws a new one from the
    // remaining participants of this raffle atomically (single transaction + row
    // lock), so concurrent redraws serialize and no exclusion is ever lost.
    const { data, error } = await supabaseAdmin.rpc('redraw_raffle_winner', { p_raffle_id: id })
    if (error) {
      if (error.message.includes('no_eligible_participants')) {
        return Response.json({ error: 'Não há mais participantes elegíveis neste sorteio.' }, { status: 409 })
      }
      if (error.message.includes('no_current_winner')) {
        return Response.json({ error: 'Este sorteio ainda não tem vencedor sorteado.' }, { status: 400 })
      }
      if (error.message.includes('raffle_not_found')) {
        return Response.json({ error: 'Raffle not found' }, { status: 404 })
      }
      console.error('[raffles/id] redraw error:', error.message)
      return Response.json({ error: 'Internal server error.' }, { status: 500 })
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row) return Response.json({ error: 'Internal server error.' }, { status: 500 })

    audit({ event: 'raffle.winner.redrawn', raffleId: id, winnerId: row.winner_id, excludedId: row.excluded_id, ip })
    return Response.json({ winner: { id: row.winner_id, name: row.winner_name, phone: row.winner_phone } })
  }

  // action === 'draw'
  const { data: raffle, error: raffleErr } = await supabaseAdmin
    .from('raffles')
    .select('id, status, winner_id')
    .eq('id', id)
    .single()
  if (raffleErr || !raffle) return Response.json({ error: 'Raffle not found' }, { status: 404 })
  if (raffle.status !== 'closed') {
    return Response.json({ error: 'Close the raffle before drawing a winner' }, { status: 400 })
  }
  if (raffle.winner_id) {
    return Response.json({ error: 'Winner already drawn. Cannot re-draw.' }, { status: 409 })
  }

  const { data: participants, error: partErr } = await supabaseAdmin
    .from('raffle_participants')
    .select('id, raffle_id, name, registered_at')
    .eq('raffle_id', id)
  if (partErr) {
    console.error('[raffles/id] draw participants error:', partErr.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }
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
  if (error) {
    console.error('[raffles/id] draw winner error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  audit({ event: 'raffle.winner.selected', raffleId: id, winnerId: winner.id, totalParticipants: participants.length, ip })
  return Response.json({ raffle: data, winner })
}
