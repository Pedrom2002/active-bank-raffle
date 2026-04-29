import { z } from 'zod'

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  QR_SECRET: z.string().min(32, 'QR_SECRET must be at least 32 characters'),
  ADMIN_PIN: z
    .string()
    .min(12, 'ADMIN_PIN must be at least 12 characters')
    .regex(/^[A-Za-z0-9!@#$%^&*]{12,}$/, 'ADMIN_PIN must contain only alphanumeric and !@#$%^&* characters'),
  ADMIN_SESSION_SECRET: z
    .string()
    .min(32, 'ADMIN_SESSION_SECRET must be at least 32 characters — generate with: openssl rand -hex 32'),
  NEXT_PUBLIC_APP_URL: z.string().min(1, 'NEXT_PUBLIC_APP_URL is required'),
  CRON_SECRET: z.string().min(32, 'CRON_SECRET must be at least 32 characters — generate with: openssl rand -hex 32'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let _env: ServerEnv | null = null

/**
 * Validates and returns all required server-side environment variables.
 * Throws a clear error listing every missing/invalid variable.
 * Result is cached — validation only runs once per cold start.
 * Only call from server-side code (API routes, server actions).
 */
export function getEnv(): ServerEnv {
  if (_env) return _env

  const result = serverEnvSchema.safeParse(process.env)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`[env] Missing or invalid environment variables:\n${issues}`)
  }

  _env = result.data
  return _env
}
