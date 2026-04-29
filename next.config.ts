import type { NextConfig } from "next";

// CSP is set dynamically per-request in middleware.ts (nonce-based).
// These static headers apply to all routes and don't require a nonce.
const staticSecurityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: staticSecurityHeaders }]
  },
}

export default nextConfig;
