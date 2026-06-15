import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'
import { toCsv } from '@/lib/records-csv'

const MAX_EXPORT = 10000

type Row = {
  id: string
  label: string
  ends_at: string | null
  created_at: string
  winner_id: string | null
  winner: { id: string; name: string; phone: string; email: string } | null
}

function filename() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `registos-vencedores-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records-export:${ip}`, 10, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.winners.export', ip })
    return Response.json({ error: 'Too many exports.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null

  const EVENT_START = '2026-06-11T00:00:00Z'
  let query = supabaseAdmin
    .from('raffles')
    .select('id, label, ends_at, created_at, winner_id, winner:raffle_participants!fk_raffle_winner(id, name, phone, email)')
    .eq('status', 'closed')
    .not('winner_id', 'is', null)
    .gte('created_at', EVENT_START)
    .order('ends_at', { ascending: false, nullsFirst: false })
    .limit(MAX_EXPORT)

  if (q) {
    const safe = q.replace(/[,()]/g, ' ').trim()
    query = query.or(`label.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[records.winners.export] db error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const flat = ((data ?? []) as unknown as Row[]).map(r => ({
    raffle_label: r.label,
    winner_name: r.winner?.name ?? '',
    winner_phone: r.winner?.phone ?? '',
    winner_email: r.winner?.email ?? '',
    ends_at: r.ends_at ?? r.created_at,
  }))

  const csv = toCsv(
    ['raffle_label', 'winner_name', 'winner_phone', 'winner_email', 'ends_at'],
    flat as unknown as Parameters<typeof toCsv>[1],
  )
  audit({ event: 'admin.records.exported', type: 'winners', q, raffleId: null, count: flat.length, ip })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
