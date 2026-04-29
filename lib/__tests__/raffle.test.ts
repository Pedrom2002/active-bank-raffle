import { describe, it, expect } from 'vitest'
import { pickWinner } from '../raffle'

describe('pickWinner', () => {
  it('throws on empty pool', () => {
    expect(() => pickWinner([])).toThrow('Pool is empty')
  })

  it('returns the only element in a single-item pool', () => {
    expect(pickWinner(['alice'])).toBe('alice')
  })

  it('always returns an element that exists in the pool', () => {
    const pool = ['a', 'b', 'c', 'd', 'e']
    for (let i = 0; i < 100; i++) {
      expect(pool).toContain(pickWinner(pool))
    }
  })

  it('does not mutate the original pool', () => {
    const pool = [1, 2, 3, 4, 5]
    const original = [...pool]
    pickWinner(pool)
    expect(pool).toEqual(original)
  })

  it('returns every element at least once across many draws (distribution check)', () => {
    const pool = ['a', 'b', 'c', 'd']
    const seen = new Set<string>()
    for (let i = 0; i < 500; i++) {
      seen.add(pickWinner(pool) as string)
    }
    expect(seen.size).toBe(pool.length)
  })

  it('works with object pool — returns by reference', () => {
    const a = { id: 1 }
    const b = { id: 2 }
    const pool = [a, b]
    const winner = pickWinner(pool)
    expect(winner === a || winner === b).toBe(true)
  })
})
