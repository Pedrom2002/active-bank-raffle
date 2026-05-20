import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records:${ip}`, 60, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.lounge', ip })
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let rowsQuery = supabaseAdmin
    .from('lounge_entrants')
    .select('id, name, phone, email, entered_at')
    .order('entered_at', { ascending: false })
    .range(from, to)
  let countQuery = supabaseAdmin
    .from('lounge_entrants')
    .select('id', { count: 'exact', head: true })

  if (q) {
    const like = `%${q}%`
    rowsQuery = rowsQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    countQuery = countQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const [rowsRes, countRes] = await Promise.all([
    rowsQuery as unknown as Promise<{ data: { id: string; name: string; phone: string; email: string; entered_at: string }[] | null; error: { message: string } | null }>,
    countQuery as unknown as Promise<{ data: null; count: number | null; error: { message: string } | null }>,
  ])

  if (rowsRes.error || countRes.error) {
    console.error('[records.lounge] db error:', rowsRes.error?.message || countRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rows = rowsRes.data ?? []
  const total = countRes.count ?? 0
  audit({ event: 'admin.records.listed', type: 'lounge', q, raffleId: null, page, count: rows.length, ip })
  return Response.json({ rows, total, page, page_size: PAGE_SIZE })
}
