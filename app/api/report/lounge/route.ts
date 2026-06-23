import { supabaseAdmin } from '@/lib/supabase'

const EVENT_START = '2026-06-11T00:00:00Z'
const LOUNGE_RAFFLE_ID = 'f16d1ca9-3624-4758-aca6-f35f58b12c66'

function escapeCSV(v: string) {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

export async function GET() {
  const [loungeRes, raffleRes] = await Promise.all([
    supabaseAdmin
      .from('lounge_entrants')
      .select('name, phone, email, entered_at')
      .gte('entered_at', EVENT_START)
      .order('entered_at', { ascending: true }),
    supabaseAdmin
      .from('raffle_participants')
      .select('name, phone, email, registered_at')
      .eq('raffle_id', LOUNGE_RAFFLE_ID)
      .order('registered_at', { ascending: true }),
  ])

  if (loungeRes.error || raffleRes.error) {
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const all = [
    ...(loungeRes.data ?? []).map(r => ({ name: r.name, phone: r.phone, email: r.email, entered_at: r.entered_at })),
    ...(raffleRes.data ?? []).map(r => ({ name: r.name, phone: r.phone, email: r.email, entered_at: r.registered_at })),
  ].sort((a, b) => new Date(a.entered_at).getTime() - new Date(b.entered_at).getTime())

  const header = 'Nome,Telefone,Email,Data\r\n'
  const rows = all.map(r => {
    const dt = new Date(r.entered_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    return [r.name, r.phone, r.email, dt].map(escapeCSV).join(',')
  }).join('\r\n')

  const csv = '﻿' + header + rows // BOM for Excel

  const date = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="activobank-lounge-leads-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
