import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const since = new Date(Date.now() - 20_000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('audit_log')
    .select('payload, created_at')
    .eq('event', 'winner.replay')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) return Response.json({ replay: null })

  const p = data.payload as { raffle_id: string; label: string; winner_name: string; winner_phone: string }
  return Response.json({
    replay: {
      raffle_id: p.raffle_id,
      label: p.label,
      name: p.winner_name,
      phone: p.winner_phone,
    },
  })
}
