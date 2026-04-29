import { NextRequest } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { checkRateLimit } from '@/lib/rate-limit'
import { audit } from '@/lib/audit'

const entrySchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+?[0-9\s\-]{7,20}$/, 'Invalid phone number'),
  email: z.string().email().max(200),
  consent: z.boolean().refine((v) => v === true, 'Consent required'),
})

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const allowed = await checkRateLimit(`entry:${ip}`, 10, 3600)
  if (!allowed) {
    return Response.json({ error: 'Demasiadas tentativas. Tenta mais tarde.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'Dados inválidos. Verifica o formulário.' }, { status: 400 })
  }

  const { name, phone, email } = parsed.data

  const { data, error } = await supabaseAdmin
    .from('lounge_entrants')
    .upsert(
      { name: name.trim(), phone: phone.trim(), email: email.trim() },
      { onConflict: 'phone', ignoreDuplicates: false }
    )
    .select('id, name, entered_at')
    .single()

  if (error) {
    console.error('[entry] POST error:', error.message)
    return Response.json({ error: 'Erro ao registar. Tenta de novo.' }, { status: 500 })
  }

  audit({ event: 'lounge.entry', entrantId: data.id, ip })
  return Response.json(data, { status: 201 })
}
