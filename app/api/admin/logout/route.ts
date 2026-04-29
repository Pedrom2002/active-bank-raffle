import { NextRequest } from 'next/server'
import { ADMIN_COOKIE } from '@/lib/admin-auth'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  audit({ event: 'admin.logout', ip })

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    },
  })
}
