# ActivoBank Fan Zone — Raffle System

Real-time raffle system for the ActivoBank Fan Zone at the 2026 World Cup. Fans scan a QR code on a TV screen to register for a draw. An admin panel activates raffles and draws winners live.

## Architecture

- **Next.js 16** (App Router) deployed on Vercel
- **Supabase** (PostgreSQL + RLS) — data layer
- **JWT** (`jose`, HS256) — admin session cookies (2h expiry)
- **HMAC-SHA256** time-windowed tokens — QR code anti-replay (120s windows)
- **Vercel Cron** — daily GDPR cleanup at 03:00 UTC

### Pages

| Route | Description |
|---|---|
| `/entry` | Fan lounge check-in form (name, phone, email + GDPR consent) |
| `/register#t=TOKEN&s=RAFFLE_ID` | Per-raffle registration form, loaded via QR code scan |
| `/screen` | TV display — shows active raffles, QR codes, and winner overlays |
| `/admin` | Admin panel — create raffles, close, draw winners |

### API Routes

| Endpoint | Description |
|---|---|
| `POST /api/entry` | Submit lounge entry |
| `GET /api/raffles` | List all raffles (strips winner_id for non-admin) |
| `POST /api/raffles` | Create raffle (admin) |
| `GET /api/raffles/[id]` | Raffle detail + winner (admin) |
| `PATCH /api/raffles/[id]` | Close or draw winner (admin) |
| `GET /api/raffles/[id]/qr` | Get QR data URL + token |
| `GET/POST/DELETE /api/raffles/[id]/participants` | Participants (POST: public with token; GET/DELETE: admin) |
| `POST /api/admin/login` | Issue admin JWT cookie |
| `POST /api/admin/logout` | Clear admin cookie |
| `GET /api/admin/me` | Check admin session |
| `GET /api/cron/cleanup` | GDPR cleanup (Vercel Cron, bearer auth) |

## Setup

### 1. Supabase

Run migrations in order from `supabase/migrations/`:

```
001_raffles.sql       — core tables (raffles, raffle_participants, lounge_entrants)
002_rate_limits.sql   — api_rate_limits table + increment_rate_limit RPC
003_fix_rls.sql       — drop permissive anon policies
004_functions.sql     — GDPR erasure + cleanup functions
005_audit_log.sql     — audit_log table + cleanup function
```

Or use `supabase/schema.sql` for the full combined schema.

### 2. Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
JWT_SECRET=<min-32-char-random-string>
ADMIN_PIN=<min-12-char-mixed-password>
QR_HMAC_SECRET=<min-32-char-random-string>
CRON_SECRET=<min-32-char-random-string>
```

Generate secrets: `openssl rand -base64 32`

### 3. Development

```bash
npm install
npm run dev
```

### 4. Deploy

Push to the connected Vercel project. `vercel.json` configures the daily cleanup cron.

## Operational Flow

1. **Event starts** — operator opens `/admin`
2. **Fans enter the lounge** — they scan a static QR or visit `/entry` to register
3. **Raffle moment** — operator clicks "Novo sorteio", selects a label and duration
4. **QR appears on TV** — `/screen` polls every 3s; fans scan the QR to go to `/register`
5. **Registration closes** — raffle closes automatically at `ends_at` or operator clicks "Encerrar"
6. **Draw** — operator clicks "Sortear vencedor"; winner is shown on the TV screen for 12s
7. **GDPR cleanup** — cron deletes raffles and participants older than 90 days; audit log after 365 days

## Security

- Admin PIN: minimum 12 characters, mixed case + digits + symbols, 5 attempt lockout
- QR tokens: HMAC-SHA256, 120s sliding window, single-use per phone per raffle
- Rate limits: registration (5/10min per IP), admin login (10/15min per IP)
- CSP: nonce-based per request, no `unsafe-inline`
- All PII (phone, email) accessible only via service role key; anon key has no RLS policies
- Audit log: all security-relevant events persisted to `audit_log` table
