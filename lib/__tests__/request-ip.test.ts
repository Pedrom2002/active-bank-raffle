import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { getClientIp } from '../request-ip'

function makeReq(headers: Record<string, string>): NextRequest {
  return new NextRequest('https://example.com/', { headers })
}

describe('getClientIp', () => {
  it('returns the last entry of x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3' })
    expect(getClientIp(req)).toBe('3.3.3.3')
  })

  it('handles single value in x-forwarded-for', () => {
    const req = makeReq({ 'x-forwarded-for': '5.5.5.5' })
    expect(getClientIp(req)).toBe('5.5.5.5')
  })

  it('trims whitespace from the extracted IP', () => {
    const req = makeReq({ 'x-forwarded-for': '1.1.1.1,  2.2.2.2 ' })
    expect(getClientIp(req)).toBe('2.2.2.2')
  })

  it('falls back to x-real-ip when x-forwarded-for is absent', () => {
    const req = makeReq({ 'x-real-ip': '9.9.9.9' })
    expect(getClientIp(req)).toBe('9.9.9.9')
  })

  it('returns "unknown" when no IP headers are present', () => {
    const req = makeReq({})
    expect(getClientIp(req)).toBe('unknown')
  })

  it('prefers x-forwarded-for over x-real-ip', () => {
    const req = makeReq({
      'x-forwarded-for': '1.1.1.1, 2.2.2.2',
      'x-real-ip': '9.9.9.9',
    })
    expect(getClientIp(req)).toBe('2.2.2.2')
  })
})
