import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'
import { toCsv } from '@/lib/records-csv'

const MAX_EXPORT = 10000

function filename() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `registos-lounge-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records-export:${ip}`, 10, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.lounge.export', ip })
    return Response.json({ error: 'Too many exports.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null

  let query = supabaseAdmin
    .from('lounge_entrants')
    .select('id, name, phone, email, entered_at')
    .order('entered_at', { ascending: false })
    .limit(MAX_EXPORT)

  if (q) {
    const like = `%${q}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[records.lounge.export] db error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rows = data ?? []
  const csv = toCsv(['name', 'phone', 'email', 'entered_at'] as const, rows as Parameters<typeof toCsv>[1])
  audit({ event: 'admin.records.exported', type: 'lounge', q, raffleId: null, count: rows.length, ip })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
