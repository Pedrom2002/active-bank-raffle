import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRpc } = vi.hoisted(() => ({ mockRpc: vi.fn() }))

vi.mock('../supabase', () => ({
  supabaseAdmin: {
    rpc: mockRpc,
  },
}))

import { checkRateLimit } from '../rate-limit'

beforeEach(() => {
  mockRpc.mockReset()
})

describe('checkRateLimit', () => {
  it('allows request when count is below the limit', async () => {
    mockRpc.mockResolvedValue({ data: 3, error: null })
    expect(await checkRateLimit('test-key', 5, 60)).toBe(true)
  })

  it('allows request when count equals the limit', async () => {
    mockRpc.mockResolvedValue({ data: 5, error: null })
    expect(await checkRateLimit('test-key', 5, 60)).toBe(true)
  })

  it('blocks request when count exceeds the limit', async () => {
    mockRpc.mockResolvedValue({ data: 6, error: null })
    expect(await checkRateLimit('test-key', 5, 60)).toBe(false)
  })

  it('fails closed on DB error (returns false)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } })
    expect(await checkRateLimit('test-key', 5, 60)).toBe(false)
  })

  it('fails closed on unexpected exception (returns false)', async () => {
    mockRpc.mockRejectedValue(new Error('network timeout'))
    expect(await checkRateLimit('test-key', 5, 60)).toBe(false)
  })

  it('passes the correct key and window_start to the RPC', async () => {
    mockRpc.mockResolvedValue({ data: 1, error: null })
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:30Z'))

    await checkRateLimit('register:1.2.3.4', 5, 60)

    expect(mockRpc).toHaveBeenCalledWith('increment_rate_limit', {
      p_key: 'register:1.2.3.4',
      p_window_start: '2026-01-01T00:00:00.000Z',
    })
    vi.useRealTimers()
  })
})
