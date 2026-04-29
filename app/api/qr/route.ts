import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { currentToken } from '@/lib/tokens'
import { checkRateLimit } from '@/lib/rate-limit'
import { getEnv } from '@/lib/env'
import QRCode from 'qrcode'

// GET /api/qr — returns QR token info + data URL for active session
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // 30 req/min per IP (screen polls every ~60s; admin page polls every 60s)
  const allowed = await checkRateLimit(`qr:${ip}`, 30, 60)
  if (!allowed) {
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .single()

  if (!session) {
    return Response.json({ error: 'Nenhum jogo activo' }, { status: 404 })
  }

  const { token, expiresAt } = currentToken(session.id)

  // Token goes in the URL fragment (#) — never sent to the server in HTTP logs,
  // never included in Referer headers, keeping it out of access logs on the backend.
  const registerUrl = `${getEnv().NEXT_PUBLIC_APP_URL}/register#t=${token}&s=${session.id}`

  const qrDataUrl = await QRCode.toDataURL(registerUrl, {
    width: 600,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  return Response.json({
    session_id: session.id,
    session_name: session.name,
    expires_at: expiresAt,
    qr_data_url: qrDataUrl,
    register_url: registerUrl,
  })
}
