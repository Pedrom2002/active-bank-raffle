import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const PAGE_SIZE = 50

type Row = {
  id: string
  raffle_id: string
  name: string
  phone: string
  email: string
  registered_at: string
  raffles: { label: string } | null
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records:${ip}`, 60, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.participants', ip })
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const raffleId = url.searchParams.get('raffle_id') || null
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let rowsQuery = supabaseAdmin
    .from('raffle_participants')
    .select('id, raffle_id, name, phone, email, registered_at, raffles(label)')
    .order('registered_at', { ascending: false })
    .range(from, to)
  let countQuery = supabaseAdmin
    .from('raffle_participants')
    .select('id', { count: 'exact', head: true })

  if (raffleId) {
    rowsQuery = rowsQuery.eq('raffle_id', raffleId)
    countQuery = countQuery.eq('raffle_id', raffleId)
  }
  if (q) {
    const like = `%${q}%`
    rowsQuery = rowsQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    countQuery = countQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const [rowsRes, countRes] = await Promise.all([
    rowsQuery as unknown as Promise<{ data: Row[] | null; error: { message: string } | null }>,
    countQuery as unknown as Promise<{ data: null; count: number | null; error: { message: string } | null }>,
  ])

  if (rowsRes.error || countRes.error) {
    console.error('[records.participants] db error:', rowsRes.error?.message || countRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rawRows = (rowsRes.data ?? []) as Row[]
  const rows = rawRows.map(({ raffles, ...rest }) => ({
    ...rest,
    raffle_label: raffles?.label ?? '',
  }))
  const total = countRes.count ?? 0
  audit({ event: 'admin.records.listed', type: 'participants', q, raffleId, page, count: rows.length, ip })
  return Response.json({ rows, total, page, page_size: PAGE_SIZE })
}
