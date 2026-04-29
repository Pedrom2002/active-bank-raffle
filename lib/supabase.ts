import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from './env'

let _supabase: SupabaseClient | null = null
let _supabaseAdmin: SupabaseClient | null = null

function getClients() {
  if (!_supabase || !_supabaseAdmin) {
    const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = getEnv()
    _supabase = createClient(url, anonKey)
    _supabaseAdmin = createClient(url, serviceKey, { auth: { persistSession: false } })
  }
  return { supabase: _supabase!, supabaseAdmin: _supabaseAdmin! }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClients().supabase as unknown as Record<string, unknown>)[prop as string]
  },
})

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getClients().supabaseAdmin as unknown as Record<string, unknown>)[prop as string]
  },
})

export type Raffle = {
  id: string
  label: string
  status: 'active' | 'closed'
  duration_sec: number
  starts_at: string
  ends_at: string | null
  winner_id: string | null
  created_at: string
}

export type RaffleParticipant = {
  id: string
  raffle_id: string
  name: string
  phone: string
  email: string
  registered_at: string
}

export type LoungeEntrant = {
  id: string
  name: string
  phone: string
  email: string
  entered_at: string
}
