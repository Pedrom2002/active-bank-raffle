import { supabaseAdmin } from './supabase'

/**
 * Sliding-window rate limiter backed by Supabase.
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Fails closed on DB error — denies the request rather than bypassing limits.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  try {
    const windowStart = new Date(
      Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000,
    ).toISOString()

    const { data, error } = await supabaseAdmin.rpc('increment_rate_limit', {
      p_key: key,
      p_window_start: windowStart,
    })

    if (error) {
      console.error('[rate-limit] db error:', error.message)
      return false // fail closed — deny on uncertainty
    }

    return (data as number) <= limit
  } catch (err) {
    console.error('[rate-limit] unexpected error:', err)
    return false // fail closed — deny on uncertainty
  }
}
