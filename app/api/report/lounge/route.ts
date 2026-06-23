import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { NextRequest } from 'next/server'

const EVENT_START = '2026-06-11T00:00:00Z'
const LOUNGE_RAFFLE_ID = 'f16d1ca9-3624-4758-aca6-f35f58b12c66'

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const [loungeRes, raffleRes] = await Promise.all([
    supabaseAdmin
      .from('lounge_entrants')
      .select('name, phone, email, entered_at')
      .gte('entered_at', EVENT_START)
      .order('entered_at', { ascending: true }),
    supabaseAdmin
      .from('raffle_participants')
      .select('name, phone, email, registered_at')
      .eq('raffle_id', LOUNGE_RAFFLE_ID)
      .order('registered_at', { ascending: true }),
  ])

  if (loungeRes.error || raffleRes.error) {
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const direct = (loungeRes.data ?? []).map(r => ({
    name: r.name,
    phone: r.phone,
    email: r.email,
    entered_at: r.entered_at,
  }))

  const fromRaffle = (raffleRes.data ?? []).map(r => ({
    name: r.name,
    phone: r.phone,
    email: r.email,
    entered_at: r.registered_at,
  }))

  const all = [...direct, ...fromRaffle].sort(
    (a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime()
  )

  return Response.json({ total: all.length, entries: all }, { headers: { 'Cache-Control': 'no-store' } })
}
