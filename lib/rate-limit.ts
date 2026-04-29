import { supabaseAdmin } from './supabase'

/**
 * Sliding-window rate limiter backed by Supabase.
 * Returns true if the request is allowed, false if the limit is exceeded.
 * Fails open on DB error to avoid blocking legitimate users.
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
      return true // fail open
    }

    return (data as number) <= limit
  } catch (err) {
    console.error('[rate-limit] unexpected error:', err)
    return true // fail open
  }
}
