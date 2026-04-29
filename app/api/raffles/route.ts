import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const createRaffleSchema = z.object({
  label: z.string().min(1).max(100),
  duration_sec: z.number().int().min(10).max(3600).default(120),
})

export async function GET(req: NextRequest) {
  const adminUser = await isAdminAuthenticated(req)

  const { data, error } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[raffles] GET error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  // Strip winner_id from public responses — only admins need it
  const response = adminUser
    ? data
    : data.map(({ winner_id: _w, ...r }) => r)

  return Response.json(response)
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  const body = await req.json().catch(() => null)
  const parsed = createRaffleSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'label required and duration_sec must be 10–3600' }, { status: 400 })
  }

  const { label, duration_sec } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('raffles')
    .insert({ label: label.trim(), duration_sec })
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
    .single()

  if (error) {
    console.error('[raffles] POST error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }
  audit({ event: 'raffle.created', raffleId: data.id, label: data.label, durationSec: data.duration_sec, ip })
  return Response.json(data, { status: 201 })
}
