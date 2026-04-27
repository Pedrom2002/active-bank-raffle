import { randomInt } from 'crypto'

// Cryptographically secure Fisher-Yates shuffle, returns the winner
export function pickWinner<T>(pool: T[]): T {
  if (pool.length === 0) throw new Error('Pool is empty')
  if (pool.length === 1) return pool[0]

  const arr = [...pool]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr[0]
}
