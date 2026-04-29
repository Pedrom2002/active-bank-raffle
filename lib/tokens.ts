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

export function validateToken(raffleId: string, token: string): boolean {
  const now = Date.now()
  const window = windowFor(now)
  const validTokens = [makeToken(raffleId, window)]
  const prevWindowEnd = window * WINDOW_SECONDS * 1000
  if (now - prevWindowEnd < 30_000) {
    validTokens.push(makeToken(raffleId, window - 1))
  }
  return validTokens.includes(token)
}

function makeToken(raffleId: string, window: number): string {
  return createHmac('sha256', getEnv().QR_SECRET)
    .update(`${raffleId}:${window}`)
    .digest('hex')
}
