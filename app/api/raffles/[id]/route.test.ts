import { describe, it, expect, vi, beforeEach } from 'vitest'

const requireAdminMock = vi.fn().mockResolvedValue(null)
vi.mock('@/lib/require-admin', () => ({ requireAdmin: (...a: unknown[]) => requireAdminMock(...a) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/request-ip', () => ({ getClientIp: vi.fn().mockReturnValue('127.0.0.1') }))
vi.mock('@/lib/admin-auth', () => ({ isAdminAuthenticated: vi.fn().mockResolvedValue(true) }))

const rpcMock = vi.fn()
const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (...a: unknown[]) => fromMock(...a),
  },
}))

import { PATCH } from './route'
import { audit } from '@/lib/audit'

const RAFFLE_ID = '11111111-1111-1111-1111-111111111111'

function redrawReq(id = RAFFLE_ID) {
  const req = new Request(`http://localhost/api/raffles/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'redraw' }),
  })
  return PATCH(req as Parameters<typeof PATCH>[0], { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireAdminMock.mockResolvedValue(null)
})

describe('PATCH /api/raffles/[id] — redraw', () => {
  it('excludes the absent winner, draws a new one, and audits it', async () => {
    rpcMock.mockResolvedValue({
      data: [{ winner_id: 'w2', winner_name: 'Bruno', winner_phone: '912000000', excluded_id: 'w1' }],
      error: null,
    })

    const res = await redrawReq()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.winner).toEqual({ id: 'w2', name: 'Bruno', phone: '912000000' })

    // Scoped to THIS raffle: the RPC is called with only this raffle's id.
    expect(rpcMock).toHaveBeenCalledWith('redraw_raffle_winner', { p_raffle_id: RAFFLE_ID })
    // The route delegates the exclusion+draw to the atomic RPC — it never does
    // its own read-modify-write against the raffles table.
    expect(fromMock).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({
      event: 'raffle.winner.redrawn', raffleId: RAFFLE_ID, winnerId: 'w2', excludedId: 'w1',
    }))
  })

  it('returns a clear 409 when no eligible participants remain', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'no_eligible_participants' } })

    const res = await redrawReq()
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/elegíveis/i)
    expect(audit).not.toHaveBeenCalled()
  })

  it('returns 400 when the raffle has no drawn winner yet', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'no_current_winner' } })

    const res = await redrawReq()
    expect(res.status).toBe(400)
  })

  it('requires admin auth (401, RPC never called)', async () => {
    requireAdminMock.mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }))

    const res = await redrawReq()
    expect(res.status).toBe(401)
    expect(rpcMock).not.toHaveBeenCalled()
  })

  it('two concurrent redraws do not lose an exclusion (atomic RPC)', async () => {
    // Model the SQL guarantee: a shared excluded set the RPC appends to atomically.
    const pool = ['w1', 'w2', 'w3', 'w4']
    let currentWinner = 'w1'
    const excluded: string[] = []
    rpcMock.mockImplementation(async () => {
      if (currentWinner && !excluded.includes(currentWinner)) excluded.push(currentWinner)
      const next = pool.find(p => !excluded.includes(p))
      if (!next) return { data: null, error: { message: 'no_eligible_participants' } }
      currentWinner = next
      return {
        data: [{ winner_id: next, winner_name: next, winner_phone: '900', excluded_id: excluded[excluded.length - 1] }],
        error: null,
      }
    })

    const [r1, r2] = await Promise.all([redrawReq(), redrawReq()])
    const [b1, b2] = await Promise.all([r1.json(), r2.json()])

    // Both exclusions persisted (w1 and w2), and the two draws produced
    // different winners — no exclusion was overwritten/lost.
    expect(excluded).toEqual(['w1', 'w2'])
    expect(b1.winner.id).not.toBe(b2.winner.id)
    expect(new Set([b1.winner.id, b2.winner.id])).toEqual(new Set(['w2', 'w3']))
  })
})
