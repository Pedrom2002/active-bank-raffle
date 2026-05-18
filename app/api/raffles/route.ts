import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const createRaffleSchema = z.object({
  label: z.string().min(1).max(100),
  duration_sec: z.number().int().min(10).max(3600).default(120),
})

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[raffles] GET error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  // winner_id is a UUID reference (not PII) and is needed by the screen
  // to detect when to show the winner overlay.
  return Response.json(data)
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
