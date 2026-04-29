import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

const createRaffleSchema = z.object({
  label: z.string().min(1).max(100),
  duration_sec: z.number().int().min(10).max(3600).default(120),
})

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status, duration_sec, starts_at, ends_at, winner_id, created_at')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
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

  if (error) return Response.json({ error: error.message }, { status: 500 })
  audit({ event: 'raffle.created', raffleId: data.id, label: data.label, durationSec: data.duration_sec, ip })
  return Response.json(data, { status: 201 })
}
