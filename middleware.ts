import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'

export function middleware(request: NextRequest) {
  const nonce = randomBytes(16).toString('base64')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' ${supabaseUrl}`,
    "frame-ancestors 'none'",
  ].join('; ')

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', csp)
  // Pass nonce to layout so it can be applied to inline Next.js scripts
  response.headers.set('x-nonce', nonce)
  return response
}

export const config = {
  matcher: [
    // Apply to all routes except static assets and _next internals
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
