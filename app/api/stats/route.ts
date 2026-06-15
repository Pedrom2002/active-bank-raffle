import { supabaseAdmin } from '@/lib/supabase'

// Participants from this raffle were collected as lounge entries (pre-event
// registration before the raffle system was ready). They count toward lounge
// totals, not raffle participant totals.
const LOUNGE_RAFFLE_IDS = new Set([
  'f16d1ca9-3624-4758-aca6-f35f58b12c66',
])

type DayStat = {
  date: string
  raffles: number
  participants: number
  lounge: number
}

// Event started June 11 2026. Anything before is test data — exclude it.
const EVENT_START = '2026-06-11T00:00:00Z'

export async function GET() {
  const [rafflesRes, participantsRes, loungeRes] = await Promise.all([
    supabaseAdmin
      .from('raffles')
      .select('id, starts_at, status')
      .gte('starts_at', EVENT_START),
    supabaseAdmin
      .from('raffle_participants')
      .select('raffle_id, registered_at')
      .gte('registered_at', EVENT_START),
    supabaseAdmin
      .from('lounge_entrants')
      .select('entered_at')
      .gte('entered_at', EVENT_START),
  ])

  if (rafflesRes.error || participantsRes.error || loungeRes.error) {
    console.error('[stats] db error:', rafflesRes.error?.message ?? participantsRes.error?.message ?? loungeRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const raffles = rafflesRes.data ?? []
  const participants = participantsRes.data ?? []
  const lounge = loungeRes.data ?? []

  // Lounge-raffle participants count in BOTH columns: participants + lounge
  const loungeRaffleParticipants = participants.filter(p => LOUNGE_RAFFLE_IDS.has(p.raffle_id))
  const realRaffles = raffles // all raffles count toward sorteios column

  // Totals: lounge-raffle participants counted in both totals
  const totalParticipants = participants.length
  const totalLounge = lounge.length + loungeRaffleParticipants.length

  // Per-day breakdown (date in Europe/Lisbon = UTC+1)
  const dayMap = new Map<string, DayStat>()

  function toDay(iso: string): string {
    // UTC+1 (Lisbon summer time) — events are in Portugal
    const d = new Date(new Date(iso).getTime() + 60 * 60 * 1000)
    return d.toISOString().slice(0, 10)
  }

  // Count real raffles per day (by starts_at)
  for (const r of realRaffles) {
    const day = toDay(r.starts_at)
    const s = dayMap.get(day) ?? { date: day, raffles: 0, participants: 0, lounge: 0 }
    s.raffles++
    dayMap.set(day, s)
  }

  // Count all participants per day (lounge-raffle also counted here)
  for (const p of participants) {
    const day = toDay(p.registered_at)
    const s = dayMap.get(day) ?? { date: day, raffles: 0, participants: 0, lounge: 0 }
    s.participants++
    dayMap.set(day, s)
  }

  // Count lounge entries per day
  for (const l of lounge) {
    const day = toDay(l.entered_at)
    const s = dayMap.get(day) ?? { date: day, raffles: 0, participants: 0, lounge: 0 }
    s.lounge++
    dayMap.set(day, s)
  }

  // Count lounge-raffle participants toward lounge, by registered_at date
  for (const p of loungeRaffleParticipants) {
    const day = toDay(p.registered_at)
    const s = dayMap.get(day) ?? { date: day, raffles: 0, participants: 0, lounge: 0 }
    s.lounge++
    dayMap.set(day, s)
  }

  const byDay = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date))

  return Response.json(
    { totalParticipants, totalLounge, byDay },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
