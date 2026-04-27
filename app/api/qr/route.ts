import { supabaseAdmin } from '@/lib/supabase'
import { currentToken } from '@/lib/tokens'
import QRCode from 'qrcode'

// GET /api/qr — returns QR token info + data URL for active session
export async function GET() {
  const { data: session } = await supabaseAdmin
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .single()

  if (!session) {
    return Response.json({ error: 'Nenhum jogo activo' }, { status: 404 })
  }

  const { token, expiresAt } = currentToken(session.id)

  const registerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/register?token=${token}&session_id=${session.id}`

  const qrDataUrl = await QRCode.toDataURL(registerUrl, {
    width: 600,
    margin: 2,
    color: { dark: '#1a1a2e', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  return Response.json({
    session_id: session.id,
    session_name: session.name,
    token,
    expires_at: expiresAt,
    qr_data_url: qrDataUrl,
    register_url: registerUrl,
  })
}
