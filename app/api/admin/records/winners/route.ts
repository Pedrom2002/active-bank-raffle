import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const PAGE_SIZE = 50

type Row = {
  id: string
  label: string
  ends_at: string | null
  created_at: string
  winner_id: string | null
  winner: { id: string; name: string; phone: string; email: string } | null
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records:${ip}`, 60, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.winners', ip })
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let rowsQuery = supabaseAdmin
    .from('raffles')
    .select('id, label, ends_at, created_at, winner_id, winner:raffle_participants!fk_raffle_winner(id, name, phone, email)')
    .eq('status', 'closed')
    .not('winner_id', 'is', null)
    .order('ends_at', { ascending: false, nullsFirst: false })
    .range(from, to)
  const countQuery = supabaseAdmin
    .from('raffles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'closed')
    .not('winner_id', 'is', null)

  if (q) {
    rowsQuery = rowsQuery.or(`label.ilike.%${q}%`)
  }

  const [rowsRes, countRes] = await Promise.all([
    rowsQuery as unknown as Promise<{ data: Row[] | null; error: { message: string } | null }>,
    countQuery as unknown as Promise<{ count: number | null; error: { message: string } | null }>,
  ])
  if (rowsRes.error || countRes.error) {
    console.error('[records.winners] db error:', rowsRes.error?.message || countRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const raw = (rowsRes.data ?? []) as Row[]
  const rows = raw.map(r => ({
    raffle_id: r.id,
    raffle_label: r.label,
    ends_at: r.ends_at,
    created_at: r.created_at,
    winner: r.winner ?? { id: '', name: '', phone: '', email: '' },
  }))

  const total = countRes.count ?? 0
  audit({ event: 'admin.records.listed', type: 'winners', q, raffleId: null, page, count: rows.length, ip })
  return Response.json({ rows, total, page, page_size: PAGE_SIZE })
}
