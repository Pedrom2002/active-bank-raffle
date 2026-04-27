# Multi-Draw Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow multiple named draws (Golo, Final, Personalizado) within a single active session, each picking from the full participant pool and persisting results.

**Architecture:** New `draws` table in Supabase linked to `sessions`. New `/api/draws` route handles create + list + latest. Admin UI gains 3 quick-draw buttons + draw history. `/screen` polls latest draw and shows winner overlay for 10s then returns to QR.

**Tech Stack:** Next.js 16 App Router, Supabase (supabaseAdmin), TypeScript, Tailwind CSS v4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/draws/route.ts` | POST (create draw), GET (list + latest) |
| Modify | `lib/supabase.ts` | Add `Draw` type |
| Modify | `app/admin/page.tsx` | 3 draw buttons + draw history list |
| Modify | `app/screen/page.tsx` | Poll latest draw, show winner overlay 10s |

---

## Task 1: Add `draws` table to Supabase

**Files:**
- Modify: `supabase/schema.sql` (append)

- [ ] **Step 1: Append draws table to schema.sql**

Add to the end of `supabase/schema.sql`:

```sql
-- Draws — multiple draws per session
create table draws (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  label       text not null,
  winner_id   uuid not null references participants(id),
  drawn_at    timestamptz not null default now()
);

create index idx_draws_session on draws(session_id);

alter table draws enable row level security;
create policy "service_role_all_draws" on draws for all using (true);
```

- [ ] **Step 2: Run the SQL against Supabase via Management API**

```bash
node -e "
const fs = require('fs');
const sql = \`
create table draws (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  label       text not null,
  winner_id   uuid not null references participants(id),
  drawn_at    timestamptz not null default now()
);
create index idx_draws_session on draws(session_id);
alter table draws enable row level security;
create policy \"service_role_all_draws\" on draws for all using (true);
\`;
const { execSync } = require('child_process');
const result = execSync(
  'curl -s -X POST https://api.supabase.com/v1/projects/jpvoqacpkduqdcsjljxp/database/query ' +
  '-H \"Authorization: Bearer sbp_22a8b23f0315ec189e229ade64e61f5dacf7f0bf\" ' +
  '-H \"Content-Type: application/json\" ' +
  '--data-binary @-',
  { input: JSON.stringify({ query: sql }) }
);
console.log(result.toString());
"
```

Expected output: `[]`

- [ ] **Step 3: Verify table exists**

```bash
node -e "
const { execSync } = require('child_process');
const body = JSON.stringify({ query: \"SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='draws'\" });
const result = execSync(
  'curl -s -X POST https://api.supabase.com/v1/projects/jpvoqacpkduqdcsjljxp/database/query ' +
  '-H \"Authorization: Bearer sbp_22a8b23f0315ec189e229ade64e61f5dacf7f0bf\" ' +
  '-H \"Content-Type: application/json\" ' +
  '--data-binary @-',
  { input: body }
);
console.log(result.toString());
"
```

Expected: `[{"tablename":"draws"}]`

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat(db): add draws table for multi-draw support"
```

---

## Task 2: Add `Draw` type to `lib/supabase.ts`

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Add Draw type at end of file**

Append to `lib/supabase.ts`:

```typescript
export type Draw = {
  id: string
  session_id: string
  label: string
  winner_id: string
  drawn_at: string
  participants?: {
    name: string
    phone: string
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(types): add Draw type"
```

---

## Task 3: Create `/api/draws` route

**Files:**
- Create: `app/api/draws/route.ts`

- [ ] **Step 1: Create the route file**

Create `app/api/draws/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { pickWinner } from '@/lib/raffle'

// POST /api/draws — create a new draw for the active session
// Body: { label: string }
export async function POST(req: NextRequest) {
  const { label } = await req.json()
  if (!label?.trim()) return Response.json({ error: 'label required' }, { status: 400 })

  const { data: session, error: sessionErr } = await supabaseAdmin
    .from('sessions')
    .select('id, name')
    .eq('status', 'active')
    .single()

  if (sessionErr || !session) {
    return Response.json({ error: 'Nenhum jogo activo' }, { status: 404 })
  }

  const { data: participants, error: partErr } = await supabaseAdmin
    .from('participants')
    .select('*')
    .eq('session_id', session.id)

  if (partErr) return Response.json({ error: partErr.message }, { status: 500 })
  if (!participants || participants.length === 0) {
    return Response.json({ error: 'Nenhum participante inscrito' }, { status: 400 })
  }

  const winner = pickWinner(participants)

  const { data: draw, error: drawErr } = await supabaseAdmin
    .from('draws')
    .insert({ session_id: session.id, label: label.trim(), winner_id: winner.id })
    .select('*, participants!draws_winner_id_fkey(name, phone)')
    .single()

  if (drawErr) return Response.json({ error: drawErr.message }, { status: 500 })

  return Response.json({
    draw,
    winner: { name: winner.name, phone: winner.phone },
    total_participants: participants.length,
    session_name: session.name,
  }, { status: 201 })
}

// GET /api/draws?session_id=X — list all draws for a session
// GET /api/draws?session_id=X&latest=1 — get only the latest draw
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  const latest = req.nextUrl.searchParams.get('latest') === '1'

  if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 })

  const query = supabaseAdmin
    .from('draws')
    .select('*, participants!draws_winner_id_fkey(name, phone)')
    .eq('session_id', sessionId)
    .order('drawn_at', { ascending: false })

  if (latest) {
    const { data, error } = await query.limit(1).single()
    if (error) return Response.json({ draw: null })
    return Response.json({ draw: data })
  }

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
```

- [ ] **Step 2: Test locally (dev server must be running)**

```bash
# Start dev server in background then test
curl -s -X POST http://localhost:3000/api/draws \
  -H "Content-Type: application/json" \
  -d '{"label":"Teste Golo"}'
```

Expected: JSON with `draw`, `winner`, `total_participants`, `session_name` — or `400/404` if no active session/participants (that's fine, route is correct).

- [ ] **Step 3: Commit**

```bash
git add app/api/draws/route.ts
git commit -m "feat(api): add /api/draws route for multi-draw"
```

---

## Task 4: Update Admin UI with draw buttons + history

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add draw state and types at top of Dashboard component**

In `app/admin/page.tsx`, inside the `Dashboard` function, add after the existing state declarations:

```typescript
const [draws, setDraws] = useState<DrawResult[]>([])
const [drawWinner, setDrawWinner] = useState<{ name: string; phone: string; label: string } | null>(null)
const [customLabel, setCustomLabel] = useState('')
const [showCustomInput, setShowCustomInput] = useState(false)
const [drawLoading, setDrawLoading] = useState(false)
```

Add the `DrawResult` type near the top of the file (after existing types):

```typescript
type DrawResult = {
  id: string
  label: string
  drawn_at: string
  participants: { name: string; phone: string } | null
}
```

- [ ] **Step 2: Add fetchDraws function and wire it up**

Inside `Dashboard`, after `fetchParticipants`:

```typescript
const fetchDraws = useCallback(async (sessionId: string) => {
  const res = await fetch(`/api/draws?session_id=${sessionId}`)
  if (res.ok) setDraws(await res.json())
}, [])
```

In the `useEffect` that watches `activeSession?.id`, add `fetchDraws` call:

```typescript
useEffect(() => {
  if (!activeSession) { setParticipants([]); setDraws([]); return }
  fetchParticipants(activeSession.id)
  fetchDraws(activeSession.id)
  const iv = setInterval(() => {
    fetchParticipants(activeSession.id)
    fetchDraws(activeSession.id)
  }, 4000)
  return () => clearInterval(iv)
}, [activeSession?.id, fetchParticipants, fetchDraws])
```

Also add `fetchDraws` to dependency array of the `fetchSessions` `useCallback`.

- [ ] **Step 3: Add runDraw function**

Inside `Dashboard`:

```typescript
async function runDraw(label: string) {
  if (drawLoading) return
  setDrawLoading(true)
  const res = await fetch('/api/draws', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  const data = await res.json()
  setDrawLoading(false)
  if (res.ok) {
    setDrawWinner({ ...data.winner, label: data.draw.label })
    if (activeSession) fetchDraws(activeSession.id)
  } else {
    alert(data.error)
  }
}
```

- [ ] **Step 4: Replace the existing raffle button with draw buttons**

Find this block in the JSX:
```tsx
<div className="flex gap-2 flex-wrap">
  <button
    onClick={runRaffle}
    disabled={participants.length === 0}
    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-lg py-3 rounded-xl transition-colors disabled:opacity-40"
  >
    🎰 SORTEAR AGORA
  </button>
  <button
    onClick={exportCSV}
    disabled={participants.length === 0}
    className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-40"
  >
    CSV
  </button>
</div>
```

Replace with:

```tsx
<div className="flex flex-col gap-2">
  <div className="flex gap-2 flex-wrap">
    <button
      onClick={() => runDraw('🥅 Golo')}
      disabled={participants.length === 0 || drawLoading}
      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-black py-3 rounded-xl transition-colors disabled:opacity-40"
    >
      🥅 Golo
    </button>
    <button
      onClick={() => runDraw('🏆 Final')}
      disabled={participants.length === 0 || drawLoading}
      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black py-3 rounded-xl transition-colors disabled:opacity-40"
    >
      🏆 Final
    </button>
    <button
      onClick={() => setShowCustomInput(v => !v)}
      disabled={participants.length === 0 || drawLoading}
      className="flex-1 bg-[#004AAD] hover:bg-[#00205B] text-white font-black py-3 rounded-xl transition-colors disabled:opacity-40"
    >
      ✏️ Personalizado
    </button>
    <button
      onClick={exportCSV}
      disabled={participants.length === 0}
      className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold px-4 py-3 rounded-xl transition-colors disabled:opacity-40"
    >
      CSV
    </button>
  </div>
  {showCustomInput && (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!customLabel.trim()) return
        runDraw(customLabel.trim())
        setCustomLabel('')
        setShowCustomInput(false)
      }}
      className="flex gap-2"
    >
      <input
        autoFocus
        value={customLabel}
        onChange={e => setCustomLabel(e.target.value)}
        placeholder="Nome do sorteio (ex: Melhor Adepto)"
        className="flex-1 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[#004AAD]"
      />
      <button type="submit" className="bg-[#004AAD] text-white font-bold px-4 rounded-xl hover:bg-[#00205B]">
        Sortear
      </button>
    </form>
  )}
</div>
```

- [ ] **Step 5: Add draw winner overlay**

After the `if (raffleState === 'drawing')` block and before the `if (raffleState === 'done' && winner)` block, add:

```tsx
if (drawWinner) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#00205B] to-[#004AAD] flex flex-col items-center justify-center text-white text-center p-8">
      <div className="text-6xl mb-2">{drawWinner.label.startsWith('🥅') ? '🥅' : drawWinner.label.startsWith('🏆') ? '🏆' : '🎉'}</div>
      <p className="text-xl opacity-70 mb-1 uppercase tracking-widest">{drawWinner.label}</p>
      <p className="text-5xl font-black mb-2">{drawWinner.name}</p>
      <p className="text-2xl opacity-70 mb-8">{drawWinner.phone}</p>
      <button
        onClick={() => setDrawWinner(null)}
        className="bg-white text-[#00205B] font-black px-8 py-3 rounded-xl text-lg hover:bg-gray-100 transition-colors"
      >
        Continuar Jogo
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Add draws history section**

In the return JSX of `Dashboard`, after the participants list card, before the "New game" button, add:

```tsx
{draws.length > 0 && (
  <div className="bg-white rounded-2xl shadow p-5">
    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Sorteios</h3>
    <div className="space-y-2">
      {draws.map(d => (
        <div key={d.id} className="flex justify-between items-center py-1 text-sm">
          <span className="font-medium text-gray-700">{d.label}</span>
          <span className="font-semibold text-[#004AAD]">{d.participants?.name ?? '—'}</span>
          <span className="text-gray-400 text-xs">{new Date(d.drawn_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): multi-draw buttons (Golo, Final, Personalizado) + history"
```

---

## Task 5: Update `/screen` to show each draw winner for 10s

**Files:**
- Modify: `app/screen/page.tsx`

- [ ] **Step 1: Add draw state and polling**

In `app/screen/page.tsx`, add after existing state declarations:

```typescript
const [latestDraw, setLatestDraw] = useState<{ label: string; winner: { name: string; phone: string } } | null>(null)
const [drawVisible, setDrawVisible] = useState(false)
const lastDrawId = useRef<string | null>(null)
```

Add `useRef` to the React import.

- [ ] **Step 2: Add fetchLatestDraw function**

Inside `ScreenPage`, after `fetchWinner`:

```typescript
const fetchLatestDraw = useCallback(async () => {
  if (!qr?.session_id) return
  const res = await fetch(`/api/draws?session_id=${qr.session_id}&latest=1`)
  if (!res.ok) return
  const data = await res.json()
  if (!data.draw) return
  if (data.draw.id === lastDrawId.current) return
  lastDrawId.current = data.draw.id
  setLatestDraw({
    label: data.draw.label,
    winner: data.draw.participants,
  })
  setDrawVisible(true)
  setTimeout(() => setDrawVisible(false), 10_000)
}, [qr?.session_id])
```

- [ ] **Step 3: Wire up the poll**

Add new `useEffect` after the winner poll effect:

```typescript
useEffect(() => {
  if (!qr?.session_id) return
  fetchLatestDraw()
  const interval = setInterval(fetchLatestDraw, 3000)
  return () => clearInterval(interval)
}, [qr?.session_id, fetchLatestDraw])
```

- [ ] **Step 4: Add draw overlay in JSX**

In the return, after the `if (winner)` block and before `if (noSession)`, add:

```tsx
if (drawVisible && latestDraw) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a6b1a] to-[#004AAD] flex flex-col items-center justify-center text-white text-center p-8">
      <div className="text-6xl mb-2">🎉</div>
      <p className="text-xl opacity-70 mb-1 uppercase tracking-widest">{latestDraw.label}</p>
      <p className="text-5xl font-black mb-2">{latestDraw.winner.name}</p>
      <p className="text-2xl opacity-70">{latestDraw.winner.phone}</p>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add app/screen/page.tsx
git commit -m "feat(screen): show each draw winner overlay for 10s"
```

---

## Task 6: Deploy to Vercel

- [ ] **Step 1: Deploy**

```bash
npx vercel --prod --yes
```

Expected: `Production: https://active-bank-raffle.vercel.app`

- [ ] **Step 2: Smoke test**

```bash
curl -s https://active-bank-raffle.vercel.app/api/draws?session_id=REPLACE_WITH_ACTIVE_SESSION_ID
```

Expected: `[]` (empty array, no error)

- [ ] **Step 3: Manual test flow**
  1. Open `/admin` → enter PIN → create new game
  2. Open `/screen` in another tab
  3. Click `🥅 Golo` in admin → winner overlay appears in admin and in `/screen` within 3s
  4. Click "Continuar Jogo" in admin → back to dashboard
  5. Draws history shows the golo draw
  6. Click `🏆 Final` → same flow
