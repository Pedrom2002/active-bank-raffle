import { NextRequest } from 'next/server'
import { isAdminAuthenticated } from './admin-auth'

export async function requireAdmin(req: NextRequest): Promise<Response | null> {
  if (!(await isAdminAuthenticated(req))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
