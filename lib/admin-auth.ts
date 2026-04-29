import { SignJWT, jwtVerify } from 'jose'
import { NextRequest } from 'next/server'
import { getEnv } from './env'

const COOKIE = 'admin_session'
const ALGORITHM = 'HS256'

function getSecret(): Uint8Array {
  return new TextEncoder().encode(getEnv().ADMIN_SESSION_SECRET)
}

export async function signAdminToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getSecret())
}

export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: [ALGORITHM] })
    return payload.role === 'admin'
  } catch {
    return false
  }
}

export function getAdminToken(req: NextRequest): string | undefined {
  return req.cookies.get(COOKIE)?.value
}

export async function isAdminAuthenticated(req: NextRequest): Promise<boolean> {
  const token = getAdminToken(req)
  return !!token && verifyAdminToken(token)
}

export { COOKIE as ADMIN_COOKIE }
