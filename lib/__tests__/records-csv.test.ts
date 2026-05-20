import { describe, it, expect } from 'vitest'
import { toCsv } from '../records-csv'

describe('toCsv', () => {
  it('renders header + rows with BOM', () => {
    const out = toCsv(
      ['name', 'phone'],
      [{ name: 'Ana', phone: '912' }, { name: 'Beto', phone: '913' }],
    )
    expect(out.startsWith('﻿')).toBe(true)
    expect(out).toContain('name,phone')
    expect(out).toContain('Ana,912')
    expect(out).toContain('Beto,913')
  })

  it('escapes commas, quotes, and newlines', () => {
    const out = toCsv(
      ['a'],
      [{ a: 'has,comma' }, { a: 'has "quote"' }, { a: 'line1\nline2' }],
    )
    expect(out).toContain('"has,comma"')
    expect(out).toContain('"has ""quote"""')
    expect(out).toContain('"line1\nline2"')
  })

  it('renders empty rows as just header + BOM', () => {
    const out = toCsv(['a', 'b'], [])
    expect(out).toBe('﻿a,b\n')
  })

  it('renders null/undefined as empty string', () => {
    const out = toCsv(['a', 'b'], [{ a: null, b: undefined }])
    expect(out).toContain(',')
    expect(out).not.toContain('null')
    expect(out).not.toContain('undefined')
  })
})
