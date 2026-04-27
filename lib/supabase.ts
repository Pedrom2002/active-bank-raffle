import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client-side (anon key, respects RLS)
export const supabase = createClient(url, anonKey)

// Server-side (service role, bypasses RLS — only use in API routes)
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

export type Session = {
  id: string
  name: string
  status: 'active' | 'closed'
  created_at: string
  closed_at: string | null
  winner_id: string | null
}

export type Participant = {
  id: string
  session_id: string
  name: string
  phone: string
  registered_at: string
}

export type Draw = {
  id: string
  session_id: string
  label: string
  winner_id: string
  drawn_at: string
  participants?: {
    name: string
    phone: string
  }
}
