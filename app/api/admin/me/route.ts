import { NextRequest } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'

export async function GET(req: NextRequest) {
  if (!(await isAdminAuthenticated(req))) {
    return Response.json({ authenticated: false }, { status: 401 })
  }
  return Response.json({ authenticated: true })
}
