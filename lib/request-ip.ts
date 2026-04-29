import { NextRequest } from 'next/server'

/**
 * Returns the real client IP from a Vercel-proxied request.
 * Vercel appends the real IP as the LAST entry in x-forwarded-for,
 * so we trust the last value, not the first (which is attacker-controlled).
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim()
    if (last) return last
  }
  return req.headers.get('x-real-ip') ?? 'unknown'
}
