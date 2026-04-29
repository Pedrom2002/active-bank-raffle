import { describe, it, expect, vi, afterEach } from 'vitest'

// Stub getEnv before importing tokens so the module resolves the secret
vi.mock('../env', () => ({
  getEnv: () => ({ QR_SECRET: 'test-secret-that-is-at-least-32-chars-long!!' }),
}))

import { currentToken, validateToken } from '../tokens'

const WINDOW_MS = 120_000
const RAFFLE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

afterEach(() => {
  vi.useRealTimers()
})

describe('currentToken', () => {
  it('returns a hex token and a future expiresAt', () => {
    const { token, expiresAt } = currentToken(RAFFLE_ID)
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(expiresAt).toBeGreaterThan(Date.now())
  })

  it('expiresAt is always on a window boundary', () => {
    const { expiresAt } = currentToken(RAFFLE_ID)
    expect(expiresAt % WINDOW_MS).toBe(0)
  })

  it('produces the same token for the same window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'))
    const t1 = currentToken(RAFFLE_ID).token
    vi.setSystemTime(new Date('2026-01-01T00:01:59Z'))
    const t2 = currentToken(RAFFLE_ID).token
    expect(t1).toBe(t2)
  })

  it('produces a different token in the next window', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:01:59Z'))
    const t1 = currentToken(RAFFLE_ID).token
    vi.setSystemTime(new Date('2026-01-01T00:02:00Z'))
    const t2 = currentToken(RAFFLE_ID).token
    expect(t1).not.toBe(t2)
  })

  it('different raffleIds produce different tokens', () => {
    const t1 = currentToken('raffle-aaa').token
    const t2 = currentToken('raffle-bbb').token
    expect(t1).not.toBe(t2)
  })
})

describe('validateToken', () => {
  it('accepts the current window token', () => {
    const { token } = currentToken(RAFFLE_ID)
    expect(validateToken(RAFFLE_ID, token)).toBe(true)
  })

  it('rejects a garbage token', () => {
    expect(validateToken(RAFFLE_ID, 'not-a-valid-token')).toBe(false)
  })

  it('rejects a token for a different raffle', () => {
    const { token } = currentToken('other-raffle-id')
    expect(validateToken(RAFFLE_ID, token)).toBe(false)
  })

  it('accepts the previous window token within 30s grace period', () => {
    vi.useFakeTimers()
    // Set time to the very start of a window
    const windowStart = Math.ceil(Date.now() / WINDOW_MS) * WINDOW_MS
    vi.setSystemTime(windowStart)
    const prevToken = currentToken(RAFFLE_ID).token

    // Advance to 29s into the next window (within grace)
    vi.setSystemTime(windowStart + WINDOW_MS + 29_000)
    expect(validateToken(RAFFLE_ID, prevToken)).toBe(true)
  })

  it('rejects the previous window token after 30s grace period', () => {
    vi.useFakeTimers()
    const windowStart = Math.ceil(Date.now() / WINDOW_MS) * WINDOW_MS
    vi.setSystemTime(windowStart)
    const prevToken = currentToken(RAFFLE_ID).token

    // Advance to 31s into the next window (outside grace)
    vi.setSystemTime(windowStart + WINDOW_MS + 31_000)
    expect(validateToken(RAFFLE_ID, prevToken)).toBe(false)
  })
})
