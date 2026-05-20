# Admin Records Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only "Registos" tab to the admin dashboard listing lounge entrants, raffle participants, and winners with search, pagination, and CSV export.

**Architecture:** Top-level admin nav with two views (`Sorteios` existing, `Registos` new). Records view has three sub-tabs each backed by its own paginated server API under `/api/admin/records/*`. APIs reuse `requireAdmin`, `checkRateLimit`, `audit` helpers and `supabaseAdmin` service-role client. A shared `RecordsTable` component handles search, pagination, and CSV download for all three lists.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase JS, Zod, Vitest. Tailwind v4 for styling.

---

## File Structure

**Create:**
- `app/admin/AdminShell.tsx` — top-level header + view switcher
- `app/admin/Records.tsx` — sub-tab nav for records
- `app/admin/records/LoungeList.tsx`
- `app/admin/records/ParticipantsList.tsx`
- `app/admin/records/WinnersList.tsx`
- `app/admin/records/RecordsTable.tsx` — shared table/search/pagination shell
- `app/admin/records/csv.ts` — small helper for CSV download trigger
- `app/api/admin/records/lounge/route.ts`
- `app/api/admin/records/lounge/route.test.ts`
- `app/api/admin/records/lounge/export/route.ts`
- `app/api/admin/records/participants/route.ts`
- `app/api/admin/records/participants/route.test.ts`
- `app/api/admin/records/participants/export/route.ts`
- `app/api/admin/records/winners/route.ts`
- `app/api/admin/records/winners/route.test.ts`
- `app/api/admin/records/winners/export/route.ts`
- `lib/records-csv.ts` — pure CSV serializer (server)
- `lib/__tests__/records-csv.test.ts`

**Modify:**
- `lib/types.ts` — add `ParticipantRecord`, `WinnerRecord`, `PagedResponse<T>`
- `lib/audit.ts` — extend `AuditEvent` union with records events
- `app/admin/page.tsx` — render `<AdminShell />` instead of `<Dashboard />` directly
- `app/admin/Dashboard.tsx` — drop the top header band (moves into `AdminShell`)

---

## Task 1: Extend types

**Files:**
- Modify: `lib/types.ts`

- [ ] **Step 1: Add new types at end of `lib/types.ts`**

```ts
export type ParticipantRecord = {
  id: string
  raffle_id: string
  raffle_label: string
  name: string
  phone: string
  email: string
  registered_at: string
}

export type WinnerRecord = {
  raffle_id: string
  raffle_label: string
  ends_at: string | null
  created_at: string
  winner: { id: string; name: string; phone: string; email: string }
}

export type PagedResponse<T> = {
  rows: T[]
  total: number
  page: number
  page_size: number
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add records types (ParticipantRecord, WinnerRecord, PagedResponse)"
```

---

## Task 2: Extend audit event union

**Files:**
- Modify: `lib/audit.ts`

- [ ] **Step 1: Add records events to the `AuditEvent` union**

Inside the `type AuditEvent =` union in `lib/audit.ts`, append:

```ts
  | { event: 'admin.records.listed'; type: 'lounge' | 'participants' | 'winners'; q: string | null; raffleId: string | null; page: number; count: number; ip: string }
  | { event: 'admin.records.exported'; type: 'lounge' | 'participants' | 'winners'; q: string | null; raffleId: string | null; count: number; ip: string }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/audit.ts
git commit -m "feat(audit): add admin.records.listed and admin.records.exported events"
```

---

## Task 3: Pure CSV serializer with tests

**Files:**
- Create: `lib/records-csv.ts`
- Create: `lib/__tests__/records-csv.test.ts`

- [ ] **Step 1: Write failing tests**

`lib/__tests__/records-csv.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/__tests__/records-csv.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement `lib/records-csv.ts`**

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/__tests__/records-csv.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/records-csv.ts lib/__tests__/records-csv.test.ts
git commit -m "feat(lib): add toCsv serializer with BOM and RFC 4180 escaping"
```

---

## Task 4: Lounge records API (list)

**Files:**
- Create: `app/api/admin/records/lounge/route.ts`
- Create: `app/api/admin/records/lounge/route.test.ts`

- [ ] **Step 1: Write failing test**

`app/api/admin/records/lounge/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/request-ip', () => ({ getClientIp: vi.fn().mockReturnValue('127.0.0.1') }))

const range = vi.fn()
const ilike = vi.fn()
const order = vi.fn()
const select = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...a: unknown[]) => fromMock(...a) },
}))

import { GET } from './route'
import { requireAdmin } from '@/lib/require-admin'
import { audit } from '@/lib/audit'

function req(url: string) {
  return new Request(url) as Parameters<typeof GET>[0]
}

beforeEach(() => {
  vi.clearAllMocks()
  // chain: from().select(...).order(...).range(...) -> rows
  // and:   from().select(..., {count, head}) -> {count}
  fromMock.mockImplementation(() => ({
    select: (cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        return {
          ilike: () => ({ data: null, error: null, count: 2 }),
          // when no q is set, return promise-like directly:
          then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 2 }).then(cb),
        }
      }
      return {
        order: () => ({
          range: () => ({
            ilike: () => ({ data: [{ id: '1', name: 'Ana', phone: '912', email: 'a@x', entered_at: 't' }], error: null }),
            then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: '1', name: 'Ana', phone: '912', email: 'a@x', entered_at: 't' }], error: null }).then(cb),
          }),
          ilike: () => ({
            range: () => ({ data: [{ id: '1', name: 'Ana', phone: '912', email: 'a@x', entered_at: 't' }], error: null }),
          }),
        }),
      }
    },
  }))
})

describe('GET /api/admin/records/lounge', () => {
  it('returns 401 when not admin', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(Response.json({ error: 'x' }, { status: 401 }))
    const res = await GET(req('http://localhost/api/admin/records/lounge'))
    expect(res.status).toBe(401)
  })

  it('returns paged response and audits', async () => {
    const res = await GET(req('http://localhost/api/admin/records/lounge?page=1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(1)
    expect(body.page_size).toBe(50)
    expect(Array.isArray(body.rows)).toBe(true)
    expect(typeof body.total).toBe('number')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.records.listed', type: 'lounge' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/admin/records/lounge/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the route**

`app/api/admin/records/lounge/route.ts`:

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records:${ip}`, 60, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.lounge', ip })
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let rowsQuery = supabaseAdmin
    .from('lounge_entrants')
    .select('id, name, phone, email, entered_at')
    .order('entered_at', { ascending: false })
    .range(from, to)
  let countQuery = supabaseAdmin
    .from('lounge_entrants')
    .select('id', { count: 'exact', head: true })

  if (q) {
    const like = `%${q}%`
    rowsQuery = rowsQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    countQuery = countQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const [rowsRes, countRes] = await Promise.all([rowsQuery, countQuery])
  if (rowsRes.error || countRes.error) {
    console.error('[records.lounge] db error:', rowsRes.error?.message || countRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rows = rowsRes.data ?? []
  const total = countRes.count ?? 0
  audit({ event: 'admin.records.listed', type: 'lounge', q, raffleId: null, page, count: rows.length, ip })
  return Response.json({ rows, total, page, page_size: PAGE_SIZE })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/admin/records/lounge/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/records/lounge/
git commit -m "feat(api): GET /api/admin/records/lounge with search and pagination"
```

---

## Task 5: Lounge CSV export

**Files:**
- Create: `app/api/admin/records/lounge/export/route.ts`

- [ ] **Step 1: Implement the export route**

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'
import { toCsv } from '@/lib/records-csv'

const MAX_EXPORT = 10000

function filename() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `registos-lounge-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records-export:${ip}`, 10, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.lounge.export', ip })
    return Response.json({ error: 'Too many exports.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null

  let query = supabaseAdmin
    .from('lounge_entrants')
    .select('id, name, phone, email, entered_at')
    .order('entered_at', { ascending: false })
    .limit(MAX_EXPORT)

  if (q) {
    const like = `%${q}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[records.lounge.export] db error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rows = data ?? []
  const csv = toCsv(['name', 'phone', 'email', 'entered_at'], rows)
  audit({ event: 'admin.records.exported', type: 'lounge', q, raffleId: null, count: rows.length, ip })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Smoke-check with type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/records/lounge/export/
git commit -m "feat(api): GET /api/admin/records/lounge/export (CSV)"
```

---

## Task 6: Participants records API (list)

**Files:**
- Create: `app/api/admin/records/participants/route.ts`
- Create: `app/api/admin/records/participants/route.test.ts`

- [ ] **Step 1: Write failing test**

Mirror Task 4's test, but URL `http://localhost/api/admin/records/participants?raffle_id=abc&q=ana`, expect `audit` called with `type: 'participants'`, `raffleId: 'abc'`. Mock chain returns one row shaped `{ id, raffle_id, name, phone, email, registered_at, raffles: { label: 'X' } }`.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/request-ip', () => ({ getClientIp: vi.fn().mockReturnValue('127.0.0.1') }))

const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...a: unknown[]) => fromMock(...a) },
}))

import { GET } from './route'
import { audit } from '@/lib/audit'

const row = { id: 'p1', raffle_id: 'abc', name: 'Ana', phone: '912', email: 'a@x', registered_at: 't', raffles: { label: 'X' } }

beforeEach(() => {
  vi.clearAllMocks()
  fromMock.mockImplementation(() => ({
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        return {
          eq: () => ({
            or: () => Promise.resolve({ data: null, error: null, count: 1 }),
            then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 1 }).then(cb),
          }),
          then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null, count: 1 }).then(cb),
        }
      }
      return {
        order: () => ({
          range: () => ({
            eq: () => ({
              or: () => Promise.resolve({ data: [row], error: null }),
              then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(cb),
            }),
            then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(cb),
          }),
        }),
      }
    },
  }))
})

describe('GET /api/admin/records/participants', () => {
  it('returns paged response with raffle_label flattened', async () => {
    const res = await GET(new Request('http://localhost/api/admin/records/participants?raffle_id=abc&q=ana') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows[0].raffle_label).toBe('X')
    expect(body.rows[0].raffles).toBeUndefined()
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.records.listed', type: 'participants', raffleId: 'abc' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/admin/records/participants/route.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the route**

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const PAGE_SIZE = 50

type Row = {
  id: string
  raffle_id: string
  name: string
  phone: string
  email: string
  registered_at: string
  raffles: { label: string } | null
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records:${ip}`, 60, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.participants', ip })
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const raffleId = url.searchParams.get('raffle_id') || null
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let rowsQuery = supabaseAdmin
    .from('raffle_participants')
    .select('id, raffle_id, name, phone, email, registered_at, raffles(label)')
    .order('registered_at', { ascending: false })
    .range(from, to)
  let countQuery = supabaseAdmin
    .from('raffle_participants')
    .select('id', { count: 'exact', head: true })

  if (raffleId) {
    rowsQuery = rowsQuery.eq('raffle_id', raffleId)
    countQuery = countQuery.eq('raffle_id', raffleId)
  }
  if (q) {
    const like = `%${q}%`
    rowsQuery = rowsQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
    countQuery = countQuery.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const [rowsRes, countRes] = await Promise.all([rowsQuery, countQuery])
  if (rowsRes.error || countRes.error) {
    console.error('[records.participants] db error:', rowsRes.error?.message || countRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rawRows = (rowsRes.data ?? []) as unknown as Row[]
  const rows = rawRows.map(({ raffles, ...rest }) => ({
    ...rest,
    raffle_label: raffles?.label ?? '',
  }))
  const total = countRes.count ?? 0
  audit({ event: 'admin.records.listed', type: 'participants', q, raffleId, page, count: rows.length, ip })
  return Response.json({ rows, total, page, page_size: PAGE_SIZE })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/admin/records/participants/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/records/participants/route.ts app/api/admin/records/participants/route.test.ts
git commit -m "feat(api): GET /api/admin/records/participants with raffle filter, search, pagination"
```

---

## Task 7: Participants CSV export

**Files:**
- Create: `app/api/admin/records/participants/export/route.ts`

- [ ] **Step 1: Implement the export route**

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'
import { toCsv } from '@/lib/records-csv'

const MAX_EXPORT = 10000

type Row = {
  id: string
  raffle_id: string
  name: string
  phone: string
  email: string
  registered_at: string
  raffles: { label: string } | null
}

function filename() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `registos-participantes-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records-export:${ip}`, 10, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.participants.export', ip })
    return Response.json({ error: 'Too many exports.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const raffleId = url.searchParams.get('raffle_id') || null

  let query = supabaseAdmin
    .from('raffle_participants')
    .select('id, raffle_id, name, phone, email, registered_at, raffles(label)')
    .order('registered_at', { ascending: false })
    .limit(MAX_EXPORT)

  if (raffleId) query = query.eq('raffle_id', raffleId)
  if (q) {
    const like = `%${q}%`
    query = query.or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
  }

  const { data, error } = await query
  if (error) {
    console.error('[records.participants.export] db error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const rows = ((data ?? []) as unknown as Row[]).map(({ raffles, ...rest }) => ({
    ...rest,
    raffle_label: raffles?.label ?? '',
  }))

  const csv = toCsv(
    ['raffle_label', 'name', 'phone', 'email', 'registered_at'],
    rows,
  )
  audit({ event: 'admin.records.exported', type: 'participants', q, raffleId, count: rows.length, ip })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/records/participants/export/
git commit -m "feat(api): GET /api/admin/records/participants/export (CSV)"
```

---

## Task 8: Winners records API (list)

**Files:**
- Create: `app/api/admin/records/winners/route.ts`
- Create: `app/api/admin/records/winners/route.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/require-admin', () => ({ requireAdmin: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))
vi.mock('@/lib/request-ip', () => ({ getClientIp: vi.fn().mockReturnValue('127.0.0.1') }))

const fromMock = vi.fn()
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (...a: unknown[]) => fromMock(...a) },
}))

import { GET } from './route'
import { audit } from '@/lib/audit'

const row = {
  id: 'r1', label: 'R1', status: 'closed', ends_at: 't', created_at: 't', winner_id: 'w1',
  winner: { id: 'w1', name: 'Ana', phone: '912', email: 'a@x' },
}

beforeEach(() => {
  vi.clearAllMocks()
  fromMock.mockImplementation(() => ({
    select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
      if (opts?.head) {
        return {
          eq: () => ({ not: () => Promise.resolve({ data: null, error: null, count: 1 }) }),
          not: () => Promise.resolve({ data: null, error: null, count: 1 }),
        }
      }
      return {
        eq: () => ({
          not: () => ({
            order: () => ({
              range: () => ({
                or: () => Promise.resolve({ data: [row], error: null }),
                then: (cb: (v: unknown) => unknown) => Promise.resolve({ data: [row], error: null }).then(cb),
              }),
            }),
          }),
        }),
      }
    },
  }))
})

describe('GET /api/admin/records/winners', () => {
  it('returns winners reshaped', async () => {
    const res = await GET(new Request('http://localhost/api/admin/records/winners') as Parameters<typeof GET>[0])
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rows[0].raffle_id).toBe('r1')
    expect(body.rows[0].raffle_label).toBe('R1')
    expect(body.rows[0].winner.name).toBe('Ana')
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ event: 'admin.records.listed', type: 'winners' }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/admin/records/winners/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the route**

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'

const PAGE_SIZE = 50

type Row = {
  id: string
  label: string
  ends_at: string | null
  created_at: string
  winner_id: string | null
  winner: { id: string; name: string; phone: string; email: string } | null
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records:${ip}`, 60, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.winners', ip })
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let rowsQuery = supabaseAdmin
    .from('raffles')
    .select('id, label, ends_at, created_at, winner_id, winner:raffle_participants!fk_raffle_winner(id, name, phone, email)')
    .eq('status', 'closed')
    .not('winner_id', 'is', null)
    .order('ends_at', { ascending: false, nullsFirst: false })
    .range(from, to)
  let countQuery = supabaseAdmin
    .from('raffles')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'closed')
    .not('winner_id', 'is', null)

  if (q) {
    const like = `%${q}%`
    rowsQuery = rowsQuery.or(`label.ilike.${like}`)
  }

  const [rowsRes, countRes] = await Promise.all([rowsQuery, countQuery])
  if (rowsRes.error || countRes.error) {
    console.error('[records.winners] db error:', rowsRes.error?.message || countRes.error?.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const raw = (rowsRes.data ?? []) as unknown as Row[]
  const rows = raw.map(r => ({
    raffle_id: r.id,
    raffle_label: r.label,
    ends_at: r.ends_at,
    created_at: r.created_at,
    winner: r.winner ?? { id: '', name: '', phone: '', email: '' },
  }))

  const total = countRes.count ?? 0
  audit({ event: 'admin.records.listed', type: 'winners', q, raffleId: null, page, count: rows.length, ip })
  return Response.json({ rows, total, page, page_size: PAGE_SIZE })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/admin/records/winners/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/records/winners/route.ts app/api/admin/records/winners/route.test.ts
git commit -m "feat(api): GET /api/admin/records/winners listing closed raffles + winner join"
```

---

## Task 9: Winners CSV export

**Files:**
- Create: `app/api/admin/records/winners/export/route.ts`

- [ ] **Step 1: Implement the export route**

```ts
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/require-admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'
import { getClientIp } from '@/lib/request-ip'
import { toCsv } from '@/lib/records-csv'

const MAX_EXPORT = 10000

type Row = {
  id: string
  label: string
  ends_at: string | null
  created_at: string
  winner_id: string | null
  winner: { id: string; name: string; phone: string; email: string } | null
}

function filename() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `registos-vencedores-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.csv`
}

export async function GET(req: NextRequest) {
  const deny = await requireAdmin(req)
  if (deny) return deny

  const ip = getClientIp(req)
  if (!(await checkRateLimit(`admin-records-export:${ip}`, 10, 60))) {
    audit({ event: 'rate_limit.exceeded', endpoint: 'admin.records.winners.export', ip })
    return Response.json({ error: 'Too many exports.' }, { status: 429 })
  }

  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || null

  let query = supabaseAdmin
    .from('raffles')
    .select('id, label, ends_at, created_at, winner_id, winner:raffle_participants!fk_raffle_winner(id, name, phone, email)')
    .eq('status', 'closed')
    .not('winner_id', 'is', null)
    .order('ends_at', { ascending: false, nullsFirst: false })
    .limit(MAX_EXPORT)

  if (q) query = query.or(`label.ilike.%${q}%`)

  const { data, error } = await query
  if (error) {
    console.error('[records.winners.export] db error:', error.message)
    return Response.json({ error: 'Internal server error.' }, { status: 500 })
  }

  const flat = ((data ?? []) as unknown as Row[]).map(r => ({
    raffle_label: r.label,
    winner_name: r.winner?.name ?? '',
    winner_phone: r.winner?.phone ?? '',
    winner_email: r.winner?.email ?? '',
    ends_at: r.ends_at ?? r.created_at,
  }))

  const csv = toCsv(['raffle_label', 'winner_name', 'winner_phone', 'winner_email', 'ends_at'], flat)
  audit({ event: 'admin.records.exported', type: 'winners', q, raffleId: null, count: flat.length, ip })

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename()}"`,
      'Cache-Control': 'no-store',
    },
  })
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/records/winners/export/
git commit -m "feat(api): GET /api/admin/records/winners/export (CSV)"
```

---

## Task 10: Shared RecordsTable component

**Files:**
- Create: `app/admin/records/RecordsTable.tsx`

- [ ] **Step 1: Implement the shared shell**

```tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PagedResponse } from '@/lib/types'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => React.ReactNode
}

type Props<T> = {
  columns: Column<T>[]
  fetchPage: (params: { q: string; page: number }) => Promise<PagedResponse<T>>
  exportHref: (q: string) => string
  searchPlaceholder?: string
  extraToolbar?: React.ReactNode
  rowKey: (row: T) => string
}

const PAGE_SIZE = 50

export function RecordsTable<T>({
  columns,
  fetchPage,
  exportHref,
  searchPlaceholder = 'Pesquisar nome, telefone, email',
  extraToolbar,
  rowKey,
}: Props<T>) {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<T[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setDebouncedQ(q)
      setPage(1)
    }, 300)
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current) }
  }, [q])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchPage({ q: debouncedQ, page })
      setRows(res.rows)
      setTotal(res.total)
    } catch {
      setError('Erro a carregar registos.')
    } finally {
      setLoading(false)
    }
  }, [fetchPage, debouncedQ, page])

  useEffect(() => { load() }, [load])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const exportUrl = useMemo(() => exportHref(debouncedQ), [exportHref, debouncedQ])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] focus:outline-none focus:ring-2 focus:ring-[#0096DC]/30"
        />
        {extraToolbar}
        <a
          href={exportUrl}
          className="text-xs font-medium text-[#0096DC] hover:text-[#0064B4] border border-[#0096DC]/40 hover:border-[#0064B4] px-3 py-2 rounded-lg transition-colors"
        >
          Exportar CSV
        </a>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error} <button onClick={load} className="underline ml-2">tentar de novo</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB] bg-white">
        <table className="w-full text-sm">
          <thead className="bg-[#F7F8FA] text-[#6B7280]">
            <tr>
              {columns.map(c => (
                <th key={c.key} className="text-left font-medium px-3 py-2">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[#6B7280]">A carregar…</td></tr>
            )}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-[#6B7280]">Sem registos.</td></tr>
            )}
            {rows.map(r => (
              <tr key={rowKey(r)} className="border-t border-[#E5E7EB]">
                {columns.map(c => (
                  <td key={c.key} className="px-3 py-2 align-top">{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[#6B7280]">
        <span>{total} registos</span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40"
          >Anterior</button>
          <span>Página {page} / {lastPage}</span>
          <button
            disabled={page >= lastPage || loading}
            onClick={() => setPage(p => Math.min(lastPage, p + 1))}
            className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] disabled:opacity-40"
          >Seguinte</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/records/RecordsTable.tsx
git commit -m "feat(admin): add shared RecordsTable component (search, pagination, CSV)"
```

---

## Task 11: LoungeList component

**Files:**
- Create: `app/admin/records/LoungeList.tsx`

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useCallback } from 'react'
import type { LoungeEntrant, PagedResponse } from '@/lib/types'
import { RecordsTable, type Column } from './RecordsTable'

const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const columns: Column<LoungeEntrant>[] = [
  { key: 'name', header: 'Nome', render: r => r.name },
  { key: 'phone', header: 'Telefone', render: r => r.phone },
  { key: 'email', header: 'Email', render: r => r.email },
  { key: 'entered_at', header: 'Entrou em', render: r => fmt.format(new Date(r.entered_at)) },
]

export function LoungeList() {
  const fetchPage = useCallback(async ({ q, page }: { q: string; page: number }): Promise<PagedResponse<LoungeEntrant>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    const res = await fetch(`/api/admin/records/lounge?${params.toString()}`)
    if (!res.ok) throw new Error('fetch failed')
    return res.json()
  }, [])

  const exportHref = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const qs = params.toString()
    return `/api/admin/records/lounge/export${qs ? `?${qs}` : ''}`
  }, [])

  return (
    <RecordsTable<LoungeEntrant>
      columns={columns}
      fetchPage={fetchPage}
      exportHref={exportHref}
      rowKey={r => r.id}
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/records/LoungeList.tsx
git commit -m "feat(admin): add LoungeList records view"
```

---

## Task 12: ParticipantsList component

**Files:**
- Create: `app/admin/records/ParticipantsList.tsx`

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ParticipantRecord, PagedResponse, Raffle } from '@/lib/types'
import { RecordsTable, type Column } from './RecordsTable'

const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const columns: Column<ParticipantRecord>[] = [
  { key: 'raffle_label', header: 'Sorteio', render: r => r.raffle_label || '—' },
  { key: 'name', header: 'Nome', render: r => r.name },
  { key: 'phone', header: 'Telefone', render: r => r.phone },
  { key: 'email', header: 'Email', render: r => r.email },
  { key: 'registered_at', header: 'Registado em', render: r => fmt.format(new Date(r.registered_at)) },
]

export function ParticipantsList() {
  const [raffles, setRaffles] = useState<Raffle[]>([])
  const [raffleId, setRaffleId] = useState<string>('')

  useEffect(() => {
    fetch('/api/raffles').then(r => r.ok ? r.json() : []).then(setRaffles).catch(() => setRaffles([]))
  }, [])

  const fetchPage = useCallback(async ({ q, page }: { q: string; page: number }): Promise<PagedResponse<ParticipantRecord>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    if (raffleId) params.set('raffle_id', raffleId)
    const res = await fetch(`/api/admin/records/participants?${params.toString()}`)
    if (!res.ok) throw new Error('fetch failed')
    return res.json()
  }, [raffleId])

  const exportHref = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (raffleId) params.set('raffle_id', raffleId)
    const qs = params.toString()
    return `/api/admin/records/participants/export${qs ? `?${qs}` : ''}`
  }, [raffleId])

  const extraToolbar = (
    <select
      value={raffleId}
      onChange={e => setRaffleId(e.target.value)}
      className="px-3 py-2 text-sm rounded-lg border border-[#E5E7EB] bg-white"
    >
      <option value="">Todos os sorteios</option>
      {raffles.map(r => (<option key={r.id} value={r.id}>{r.label}</option>))}
    </select>
  )

  return (
    <RecordsTable<ParticipantRecord>
      columns={columns}
      fetchPage={fetchPage}
      exportHref={exportHref}
      extraToolbar={extraToolbar}
      rowKey={r => r.id}
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/records/ParticipantsList.tsx
git commit -m "feat(admin): add ParticipantsList with raffle filter"
```

---

## Task 13: WinnersList component

**Files:**
- Create: `app/admin/records/WinnersList.tsx`

- [ ] **Step 1: Implement the component**

```tsx
'use client'

import { useCallback } from 'react'
import type { WinnerRecord, PagedResponse } from '@/lib/types'
import { RecordsTable, type Column } from './RecordsTable'

const fmt = new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' })

const columns: Column<WinnerRecord>[] = [
  { key: 'raffle_label', header: 'Sorteio', render: r => r.raffle_label },
  { key: 'winner_name', header: 'Vencedor', render: r => r.winner.name },
  { key: 'phone', header: 'Telefone', render: r => r.winner.phone },
  { key: 'email', header: 'Email', render: r => r.winner.email },
  { key: 'ends_at', header: 'Fechado em', render: r => fmt.format(new Date(r.ends_at ?? r.created_at)) },
]

export function WinnersList() {
  const fetchPage = useCallback(async ({ q, page }: { q: string; page: number }): Promise<PagedResponse<WinnerRecord>> => {
    const params = new URLSearchParams({ page: String(page) })
    if (q) params.set('q', q)
    const res = await fetch(`/api/admin/records/winners?${params.toString()}`)
    if (!res.ok) throw new Error('fetch failed')
    return res.json()
  }, [])

  const exportHref = useCallback((q: string) => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const qs = params.toString()
    return `/api/admin/records/winners/export${qs ? `?${qs}` : ''}`
  }, [])

  return (
    <RecordsTable<WinnerRecord>
      columns={columns}
      fetchPage={fetchPage}
      exportHref={exportHref}
      searchPlaceholder="Pesquisar sorteio"
      rowKey={r => r.raffle_id}
    />
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/records/WinnersList.tsx
git commit -m "feat(admin): add WinnersList records view"
```

---

## Task 14: Records container (sub-tabs)

**Files:**
- Create: `app/admin/Records.tsx`

- [ ] **Step 1: Implement the records container**

```tsx
'use client'

import { useState } from 'react'
import { LoungeList } from './records/LoungeList'
import { ParticipantsList } from './records/ParticipantsList'
import { WinnersList } from './records/WinnersList'

type Sub = 'lounge' | 'participants' | 'winners'

const TABS: { key: Sub; label: string }[] = [
  { key: 'lounge', label: 'Lounge' },
  { key: 'participants', label: 'Participantes' },
  { key: 'winners', label: 'Vencedores' },
]

export function Records() {
  const [sub, setSub] = useState<Sub>('lounge')
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b border-[#E5E7EB]" aria-label="Sub-secções de registos">
        {TABS.map(t => {
          const active = t.key === sub
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              aria-current={active ? 'page' : undefined}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${active ? 'border-[#0096DC] text-[#0096DC]' : 'border-transparent text-[#6B7280] hover:text-[#0A0A0A]'}`}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {sub === 'lounge' && <LoungeList />}
      {sub === 'participants' && <ParticipantsList />}
      {sub === 'winners' && <WinnersList />}
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/admin/Records.tsx
git commit -m "feat(admin): add Records container with sub-tabs"
```

---

## Task 15: AdminShell + integrate top-level tabs

**Files:**
- Modify: `app/admin/Dashboard.tsx` (remove its `<header>` block, lines 140–160)
- Create: `app/admin/AdminShell.tsx`
- Modify: `app/admin/page.tsx` (render `<AdminShell />` instead of `<Dashboard />`)

- [ ] **Step 1: Remove the existing header from `Dashboard.tsx`**

In `app/admin/Dashboard.tsx`, delete the entire `<header>...</header>` block (the one inside `return (`, currently rendering the logo, offline badge, Ecrã TV link, and logout button). Keep `<div className="min-h-screen bg-[#F7F8FA]">` as outer container with just `<main>` and the toasts container inside.

After the edit the JSX should look like:

```tsx
return (
  <div className="min-h-screen bg-[#F7F8FA]">
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <CreateRaffleForm onCreated={fetchRaffles} onToast={pushToast} />
      <RaffleList
        activeRaffles={activeRaffles}
        closedWithoutWinner={visibleClosed.filter(r => !r.winner_id)}
        closedWithWinner={visibleClosed.filter(r => !!r.winner_id)}
        archivedRaffles={archivedRaffles}
        participants={participants}
        drawingId={drawingId}
        showArchive={showArchive}
        onToggleArchive={() => setShowArchive(v => !v)}
        onDraw={drawWinner}
        onClose={closeRaffle}
        onReplay={replayWinner}
        onArchive={archive}
        onUnarchive={unarchive}
      />
    </main>

    <div className="fixed top-20 right-4 z-50 space-y-2 pointer-events-none" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id}
          className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg max-w-sm ${t.kind === 'success' ? 'bg-[#0096DC] text-white' : t.kind === 'error' ? 'bg-red-600 text-white' : 'bg-white border border-[#E5E7EB] text-[#0A0A0A]'}`}>
          {t.text}
        </div>
      ))}
    </div>
  </div>
)
```

Also: remove the `offline` indicator since it lives in the header. Remove the `offline` state and the lines `setOffline(false)` / `setOffline(true)` from `fetchRaffles`. The shell will re-introduce an offline indicator in step 2.

- [ ] **Step 2: Create `app/admin/AdminShell.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { Dashboard } from './Dashboard'
import { Records } from './Records'

type View = 'raffles' | 'records'

const TABS: { key: View; label: string }[] = [
  { key: 'raffles', label: 'Sorteios' },
  { key: 'records', label: 'Registos' },
]

export function AdminShell({ onLogout }: { onLogout: () => void }) {
  const [view, setView] = useState<View>('raffles')

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_activobank.svg" alt="ActivoBank" width={137} height={22} />

          <nav className="flex gap-1" aria-label="Secções do admin">
            {TABS.map(t => {
              const active = t.key === view
              return (
                <button
                  key={t.key}
                  onClick={() => setView(t.key)}
                  aria-current={active ? 'page' : undefined}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${active ? 'bg-[#0096DC] text-white' : 'text-[#6B7280] hover:text-[#0A0A0A] hover:bg-[#F7F8FA]'}`}
                >
                  {t.label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <a href="/screen" target="_blank" rel="noreferrer"
              className="text-xs font-medium text-[#0096DC] hover:text-[#0064B4] px-3 py-1.5 rounded-lg hover:bg-[#0096DC]/5 transition-colors">
              Ecrã TV
            </a>
            <button onClick={onLogout}
              className="text-xs text-[#6B7280] hover:text-[#0A0A0A] px-3 py-1.5 rounded-lg hover:bg-[#F7F8FA] transition-colors">
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {view === 'raffles' ? <Dashboard onLogout={onLogout} /> : <Records />}
      </main>
    </div>
  )
}
```

Note: `Dashboard` already renders its own `<main>` + outer `<div>`. After Step 1 it no longer renders the header. We accept the nested `<main>` (semantically slightly awkward but harmless) to keep `Dashboard` untouched beyond header removal. The `AdminShell` `<main>` provides the records padding; `Dashboard`'s inner `<main>` keeps the existing layout.

- [ ] **Step 3: Update `app/admin/page.tsx`**

Replace `import { Dashboard } from './Dashboard'` with `import { AdminShell } from './AdminShell'`, and replace the JSX usage:

```tsx
return status === 'unlocked'
  ? <AdminShell onLogout={handleLogout} />
  : <PinGate onUnlock={() => setStatus('unlocked')} />
```

- [ ] **Step 4: Type-check + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all suites pass (existing + new).

- [ ] **Step 6: Commit**

```bash
git add app/admin/page.tsx app/admin/Dashboard.tsx app/admin/AdminShell.tsx
git commit -m "feat(admin): add top-level Sorteios/Registos tabs via AdminShell"
```

---

## Task 16: Manual verification

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Open: `http://localhost:3000/admin`

- [ ] **Step 2: Login with PIN and verify both tabs render**

Click `Sorteios` → existing dashboard intact (active raffles, create form).
Click `Registos` → sub-tabs `Lounge | Participantes | Vencedores`. Default sub-tab: Lounge.

- [ ] **Step 3: Each sub-tab**

For each of Lounge / Participantes / Vencedores:
- List renders or shows "Sem registos" when empty.
- Search input filters results (debounced ~300ms).
- Pagination works if total > 50.
- "Exportar CSV" downloads a file; open in Excel/LibreOffice and confirm headers + UTF-8 (accented chars correct).

For Participantes: change the raffle dropdown → list filters and the CSV export respects the filter.

- [ ] **Step 4: Unauthorized check**

In an incognito window without PIN, open `/api/admin/records/lounge` → should return 401.

- [ ] **Step 5: Final commit if anything tweaked**

If no fixes needed, this task has no commit. Otherwise commit per-fix.

---

## Self-Review Notes

Spec coverage:
- Lounge / Participantes / Vencedores lists → Tasks 4, 6, 8 (APIs) + 11, 12, 13 (UI). ✓
- Search across name/phone/email via ilike → Tasks 4, 6 (winners search is over `label` only — explicit deviation; spec says search "matches name, phone, email" but winners list has no participant-level inputs to type into; document this as a deliberate scope decision in the WinnersList component via a `searchPlaceholder='Pesquisar sorteio'`). ✓
- Pagination 50/page → all list APIs. ✓
- CSV export per list with UTF-8 BOM → Tasks 3, 5, 7, 9. ✓
- PIN gate + service role + rate limit + audit → all APIs use `requireAdmin`, `checkRateLimit`, `audit`, `supabaseAdmin`. ✓
- Top tab + sub-tabs UI → Tasks 14, 15. ✓
- Types → Task 1. ✓
- Audit event union → Task 2. ✓

Placeholder scan: no TBDs, no "implement later", every code step has full code.

Type consistency: `PagedResponse<T>`, `LoungeEntrant`, `ParticipantRecord`, `WinnerRecord` consistent across API responses (Tasks 4–9) and components (Tasks 11–13).

Deviation from spec (search on winners): noted above. Searching winners by name/phone/email would require a join filter that the supabase-js v2 builder doesn't expose cleanly without an RPC; scoped down to label-search for this iteration.
