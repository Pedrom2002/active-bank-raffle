import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { getClientIp } from '@/lib/request-ip'

const schema = z.object({
  raffle_id: z.string().uuid(),
  label: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'raffle_id and label required' }, { status: 400 })

  const { raffle_id, label } = parsed.data

  const { data: raffle, error } = await supabaseAdmin
    .from('raffles')
    .select('id, winner_id, raffle_participants!fk_raffle_winner(name, phone)')
    .eq('id', raffle_id)
    .single()

  if (error || !raffle) return Response.json({ error: 'Raffle not found' }, { status: 404 })
  if (!raffle.winner_id) return Response.json({ error: 'No winner drawn yet' }, { status: 400 })

  const winner = raffle.raffle_participants as unknown as { name: string; phone: string } | null
  if (!winner) return Response.json({ error: 'Winner data not found' }, { status: 404 })

  const { error: auditErr } = await supabaseAdmin
    .from('audit_log')
    .insert({
      event: 'winner.replay',
      payload: { raffle_id, label, winner_name: winner.name, winner_phone: winner.phone, ip, ts: new Date().toISOString() },
    })

  if (auditErr) {
    console.error('[replay] audit insert error:', auditErr.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  return Response.json({ ok: true })
}
