import { createHmac } from 'crypto'

const SECRET = process.env.QR_SECRET!
const WINDOW_SECONDS = 120 // 2 minutes per QR window

function windowFor(timestamp: number): number {
  return Math.floor(timestamp / (WINDOW_SECONDS * 1000))
}

export function currentToken(sessionId: string): { token: string; expiresAt: number } {
  const now = Date.now()
  const window = windowFor(now)
  const token = makeToken(sessionId, window)
  const expiresAt = (window + 1) * WINDOW_SECONDS * 1000
  return { token, expiresAt }
}

export function validateToken(sessionId: string, token: string): boolean {
  const now = Date.now()
  const window = windowFor(now)

  // Accept current window and previous window (30s grace period)
  const validTokens = [makeToken(sessionId, window)]
  const prevWindowEnd = window * WINDOW_SECONDS * 1000
  if (now - prevWindowEnd < 30_000) {
    validTokens.push(makeToken(sessionId, window - 1))
  }

  return validTokens.includes(token)
}

function makeToken(sessionId: string, window: number): string {
  return createHmac('sha256', SECRET)
    .update(`${sessionId}:${window}`)
    .digest('hex')
}
