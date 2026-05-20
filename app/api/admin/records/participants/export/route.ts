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
  raffle_id: string
  name: string
  phone: string
  email: string
  registered_at: string
  raffles: { label: string } | null
}

function filename() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `registos-participantes-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records-export:${ip}`, 10, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.participants.export', ip })
    return Response.json({ error: 'Too many exports.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const raffleId = url.searchParams.get('raffle_id') || null

  let query = supabaseAdmin
    .from('raffle_participants')
    .select('id, raffle_id, name, phone, email, registered_at, raffles(label)')
    .order('registered_at', { ascending: false })
    .limit(MAX_EXPORT)

  if (raffleId) query = query.eq('raffle_id', raffleId)
  if (q) {
    const like = `%${q}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[records.participants.export] db error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rows = ((data ?? []) as unknown as Row[]).map(({ raffles, ...rest }) => ({
    ...rest,
    raffle_label: raffles?.label ?? '',
  }))

  const csv = toCsv(
    ['raffle_label', 'name', 'phone', 'email', 'registered_at'],
    rows as unknown as Parameters<typeof toCsv>[1],
  )
  audit({ event: 'admin.records.exported', type: 'participants', q, raffleId, count: rows.length, ip })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
