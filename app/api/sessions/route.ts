import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// GET /api/sessions — list all sessions
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .select('*, participants!participants_session_id_fkey(count)')
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST /api/sessions — create new session (closes any active session first)
export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })

  // Close any currently active session
  await supabaseAdmin
    .from('sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('status', 'active')

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

// PATCH /api/sessions — close active session manually
export async function PATCH() {
  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('status', 'active')
    .select()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
