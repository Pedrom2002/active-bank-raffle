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

const row = {
  id: 'r1', label: 'R1', ends_at: 't', created_at: 't', winner_id: 'w1',
  winner: { id: 'w1', name: 'Ana', phone: '912', email: 'a@x' },
}

beforeEach(() => {
  vi.clearAllMocks()
  fromMock.mockImplementation(() => ({
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        return {
          eq: () => ({ not: () => Promise.resolve({ data: null, error: null, count: 1 }) }),
        }
      }
      return {
        eq: () => ({
          not: () => ({
            order: () => ({
              range: () => ({
                or: () => Promise.resolve({ data: [row], error: null }),
                then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(cb),
              }),
            }),
          }),
        }),
      }
    },
  }))
})

describe('GET /api/admin/records/winners', () => {
  it('returns winners reshaped', async () => {
    const res = await GET(new Request('http://localhost/api/admin/records/winners') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows[0].raffle_id).toBe('r1')
    expect(body.rows[0].raffle_label).toBe('R1')
    expect(body.rows[0].winner.name).toBe('Ana')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.records.listed', type: 'winners' }))
  })
})
