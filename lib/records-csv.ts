function escape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv<T extends Record<string, unknown>>(
  columns: (keyof T & string)[],
  rows: T[],
): string {
  const header = columns.join(',')
  const body = rows.map(r => columns.map(c => escape(r[c])).join(',')).join('\n')
  const content = rows.length === 0 ? `${header}\n` : `${header}\n${body}\n`
  return `﻿${content}`
}
