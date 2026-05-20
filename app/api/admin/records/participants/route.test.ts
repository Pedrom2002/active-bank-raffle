import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/request-ip', () => ({ getClientIp: vi.fn().mockReturnValue('127.0.0.1') }))

const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...a: unknown[]) => fromMock(...a) },
}))

import { GET } from './route'
import { audit } from '@/lib/audit'

const row = { id: 'p1', raffle_id: 'abc', name: 'Ana', phone: '912', email: 'a@x', registered_at: 't', raffles: { label: 'X' } }

beforeEach(() => {
  vi.clearAllMocks()
  fromMock.mockImplementation(() => ({
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        return {
          eq: () => ({
            or: () => Promise.resolve({ data: null, error: null, count: 1 }),
            then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 1 }).then(cb),
          }),
          then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 1 }).then(cb),
        }
      }
      return {
        order: () => ({
          range: () => ({
            eq: () => ({
              or: () => Promise.resolve({ data: [row], error: null }),
              then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(cb),
            }),
            then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(cb),
          }),
        }),
      }
    },
  }))
})

describe('GET /api/admin/records/participants', () => {
  it('returns paged response with raffle_label flattened', async () => {
    const res = await GET(new Request('http://localhost/api/admin/records/participants?raffle_id=abc&q=ana') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows[0].raffle_label).toBe('X')
    expect(body.rows[0].raffles).toBeUndefined()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.records.listed', type: 'participants', raffleId: 'abc' }))
  })
})
