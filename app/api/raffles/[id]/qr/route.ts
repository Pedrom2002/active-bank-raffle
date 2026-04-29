import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { currentToken } from '@/lib/tokens'
import { checkRateLimit } from '@/lib/rate-limit'
import { getEnv } from '@/lib/env'
import { getClientIp } from '@/lib/request-ip'
import QRCode from 'qrcode'

const uuidRe = /^[0-9a-f-]{36}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(req)
  const allowed = await checkRateLimit(`qr:${ip}`, 30, 60)
  if (!allowed) return Response.json({ error: 'Too many requests.' }, { status: 429 })

  const { id } = await params
  if (!uuidRe.test(id)) return Response.json({ error: 'Invalid id.' }, { status: 400 })

  const { data: raffle, error } = await supabaseAdmin
    .from('raffles')
    .select('id, label, status, duration_sec, starts_at')
    .eq('id', id)
    .single()

  if (error || !raffle) return Response.json({ error: 'Raffle not found' }, { status: 404 })
  if (raffle.status !== 'active') return Response.json({ error: 'Raffle is not active' }, { status: 410 })

  const { token, expiresAt } = currentToken(raffle.id)
  const registerUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/register#t=${token}&s=${raffle.id}`

  const qrDataUrl = await QRCode.toDataURL(registerUrl, {
    width: 600,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  const endsAt = new Date(raffle.starts_at).getTime() + raffle.duration_sec * 1000

  // register_url is intentionally omitted from the response — the token must not
  // appear in response bodies (logs, monitoring tools). The QR image encodes it.
  return Response.json({
    raffle_id: raffle.id,
    label: raffle.label,
    expires_at: expiresAt,
    ends_at: endsAt,
    qr_data_url: qrDataUrl,
  })
}
