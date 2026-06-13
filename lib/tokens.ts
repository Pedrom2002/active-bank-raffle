import { createHmac } from 'crypto'
import { getEnv } from './env'

const WINDOW_SECONDS = 120

function windowFor(timestamp: number): number {
  return Math.floor(timestamp / (WINDOW_SECONDS * 1000))
}

export function currentToken(raffleId: string): { token: string; expiresAt: number } {
  const now = Date.now()
  const window = windowFor(now)
  const token = makeToken(raffleId, window)
  const expiresAt = (window + 1) * WINDOW_SECONDS * 1000
  return { token, expiresAt }
}

// Accepts any token generated since the raffle started (raffleStartedAt).
// This means a participant who scans at minute 1 of a 5-minute raffle can
// still submit at minute 4 without getting "QR code expirado".
// Falls back to current + previous window if raffleStartedAt is not provided.
export function validateToken(raffleId: string, token: string, raffleStartedAt?: number): boolean {
  const now = Date.now()
  const currentWindow = windowFor(now)

  if (raffleStartedAt) {
    const startWindow = windowFor(raffleStartedAt)
    // Accept all windows from raffle start up to current, plus 30s grace into next
    const validTokens: string[] = []
    for (let w = startWindow; w <= currentWindow; w++) {
      validTokens.push(makeToken(raffleId, w))
    }
    // 30s grace period for the window that just ended
    const prevWindowEnd = currentWindow * WINDOW_SECONDS * 1000
    if (now - prevWindowEnd < 30_000) {
      validTokens.push(makeToken(raffleId, currentWindow - 1))
    }
    return validTokens.includes(token)
  }

  // Fallback: current window + 30s grace on previous
  const validTokens = [makeToken(raffleId, currentWindow)]
  const prevWindowEnd = currentWindow * WINDOW_SECONDS * 1000
  if (now - prevWindowEnd < 30_000) {
    validTokens.push(makeToken(raffleId, currentWindow - 1))
  }
  return validTokens.includes(token)
}

function makeToken(raffleId: string, window: number): string {
  return createHmac('sha256', getEnv().QR_SECRET)
    .update(`${raffleId}:${window}`)
    .digest('hex')
}
