import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Called daily by Vercel cron (see vercel.json).
// Deletes closed raffles (and their participants via cascade) older than 90 days.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [rafflesResult, auditResult] = await Promise.all([
    supabaseAdmin.rpc('cleanup_old_raffles', { p_retention_days: 90 }),
    supabaseAdmin.rpc('cleanup_old_audit_log', { p_retention_days: 365 }),
  ])

  if (rafflesResult.error) {
    console.error('[cron/cleanup] raffles error:', rafflesResult.error.message)
    return Response.json({ error: 'Cleanup failed.' }, { status: 500 })
  }
  if (auditResult.error) {
    console.error('[cron/cleanup] audit_log error:', auditResult.error.message)
  }

  console.log('[cron/cleanup] deleted raffles:', rafflesResult.data, 'audit entries:', auditResult.data)
  return Response.json({ deleted_raffles: rafflesResult.data, deleted_audit: auditResult.data })
}
