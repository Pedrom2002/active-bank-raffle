import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  getEnv: vi.fn(() => ({ ADMIN_PIN: 'supersecretpin123' })),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  audit: vi.fn(),
}))

vi.mock('@/lib/admin-auth', () => ({
  signAdminToken: vi.fn().mockResolvedValue('mock-jwt-token'),
  ADMIN_COOKIE: 'admin_token',
}))

vi.mock('@/lib/request-ip', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

import { POST } from './route'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0]
}

describe('POST /api/admin/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue(true)
  })

  it('returns 200 and sets cookie on correct PIN', async () => {
    const res = await POST(makeRequest({ pin: 'supersecretpin123' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(res.headers.get('Set-Cookie')).toContain('admin_token=mock-jwt-token')
    expect(res.headers.get('Set-Cookie')).toContain('HttpOnly')
  })

  it('returns 401 on wrong PIN', async () => {
    const res = await POST(makeRequest({ pin: 'wrongpin' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/PIN/)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.login.failure' }))
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false)
    const res = await POST(makeRequest({ pin: 'supersecretpin123' }))
    expect(res.status).toBe(429)
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'rate_limit.exceeded' }))
  })

  it('returns 400 on invalid body (missing pin)', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 on malformed JSON', async () => {
    const req = new Request('http://localhost/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    }) as Parameters<typeof POST>[0]
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('logs success on correct PIN', async () => {
    await POST(makeRequest({ pin: 'supersecretpin123' }))
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.login.success' }))
  })
})
