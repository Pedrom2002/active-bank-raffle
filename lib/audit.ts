import { after } from 'next/server'
import { supabaseAdmin } from './supabase'

type AuditEvent =
  | { event: 'admin.login.success'; ip: string }
  | { event: 'admin.login.failure'; ip: string; attemptsRemaining: number }
  | { event: 'admin.logout'; ip: string }
  | { event: 'raffle.created'; raffleId: string; label: string; durationSec: number; ip: string }
  | { event: 'raffle.closed'; raffleId: string; ip: string }
  | { event: 'raffle.winner.selected'; raffleId: string; winnerId: string; totalParticipants: number; ip: string }
  | { event: 'participant.registered'; raffleId: string; participantId: string; ip: string }
  | { event: 'participant.deleted'; participantId: string; raffleId: string; ip: string }
  | { event: 'lounge.entry'; entrantId: string; ip: string }
  | { event: 'rate_limit.exceeded'; endpoint: string; ip: string }

export function audit(data: AuditEvent): void {
  const entry = { ts: new Date().toISOString(), ...data }
  console.log(JSON.stringify(entry))
  // after() keeps the Vercel function alive until the DB insert completes,
  // preventing the runtime from being killed before the promise resolves.
  after(async () => {
    const { error } = await supabaseAdmin
      .from('audit_log')
      .insert({ event: data.event, payload: entry })
    if (error) console.error('[audit] persist failed:', error.message)
  })
}
