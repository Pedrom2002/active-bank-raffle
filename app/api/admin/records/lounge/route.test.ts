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
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

function req(url: string) {
  return new Request(url) as Parameters<typeof GET>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  fromMock.mockImplementation(() => ({
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        return {
          or: () => Promise.resolve({ data: null, error: null, count: 2 }),
          then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 2 }).then(cb),
        }
      }
      const rows = [{ id: '1', name: 'Ana', phone: '912', email: 'a@x', entered_at: 't' }]
      return {
        order: () => ({
          range: () => ({
            or: () => Promise.resolve({ data: rows, error: null }),
            then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(cb),
          }),
        }),
      }
    },
  }))
})

describe('GET /api/admin/records/lounge', () => {
  it('returns 401 when not admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(Response.json({ error: 'x' }, { status: 401 }))
    const res = await GET(req('http://localhost/api/admin/records/lounge'))
    expect(res.status).toBe(401)
  })

  it('returns paged response and audits', async () => {
    const res = await GET(req('http://localhost/api/admin/records/lounge?page=1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.page_size).toBe(50)
    expect(Array.isArray(body.rows)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.records.listed', type: 'lounge' }))
  })
})
