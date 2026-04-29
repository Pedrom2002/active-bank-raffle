import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

const createSchema = z.object({ name: z.string().min(1).max(100) })

// GET /api/sessions — list all sessions (admin only)
export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*, participants!participants_session_id_fkey(count)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[sessions] GET error:', error.message)
    return Response.json({ error: 'Failed to fetch sessions.' }, { status: 500 })
  }
  return Response.json(data)
}

// POST /api/sessions — create new session (closes any active session first, atomically)
export async function POST(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid session name.' }, { status: 400 })
  }

  // Atomic: close active + create new in a single Postgres transaction (P14 — race condition fix)
  const { data, error } = await supabaseAdmin
    .rpc('create_session', { p_name: parsed.data.name.trim() })

  if (error) {
    console.error('[sessions] POST error:', error.message)
    return Response.json({ error: 'Failed to create session.' }, { status: 500 })
  }

  audit({ event: 'session.created', sessionId: data.id, sessionName: data.name, ip })
  return Response.json(data, { status: 201 })
}

// PATCH /api/sessions — close active session manually
export async function PATCH(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('status', 'active')
    .select()

  if (error) {
    console.error('[sessions] PATCH error:', error.message)
    return Response.json({ error: 'Failed to close session.' }, { status: 500 })
  }

  if (data && data.length > 0) {
    audit({ event: 'session.closed', sessionId: data[0].id, method: 'manual', ip })
  }
  return Response.json(data)
}
