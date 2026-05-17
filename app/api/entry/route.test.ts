import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
}))

vi.mock('@/lib/audit', () => ({
  audit: vi.fn(),
}))

vi.mock('@/lib/request-ip', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

const mockUpsert = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      upsert: mockUpsert,
    })),
  },
}))

import { POST } from './route'
import { checkRateLimit } from '@/lib/rate-limit'

const validBody = {
  name: 'Maria Silva',
  phone: '+351912345678',
  email: 'maria@example.com',
  consent: true,
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/entry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Parameters<typeof POST>[0]
}

describe('POST /api/entry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(checkRateLimit).mockResolvedValue(true)
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'uuid-1', name: 'Maria Silva', entered_at: new Date().toISOString() },
          error: null,
        }),
      }),
    })
  })

  it('returns 201 on valid entry', async () => {
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Maria Silva')
  })

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(false)
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(429)
  })

  it('returns 400 when consent is false', async () => {
    const res = await POST(makeRequest({ ...validBody, consent: false }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid phone', async () => {
    const res = await POST(makeRequest({ ...validBody, phone: 'notaphone' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on invalid email', async () => {
    const res = await POST(makeRequest({ ...validBody, email: 'notanemail' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 on empty name', async () => {
    const res = await POST(makeRequest({ ...validBody, name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 500 on database error', async () => {
    mockUpsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      }),
    })
    const res = await POST(makeRequest(validBody))
    expect(res.status).toBe(500)
  })
})
