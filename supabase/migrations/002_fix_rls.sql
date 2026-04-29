-- Fix overly-permissive RLS policies.
--
-- The original "using (true)" policies granted the anon key (NEXT_PUBLIC_,
-- visible in every browser) full read/write access to every table, bypassing
-- the Next.js auth layer entirely. Dropping them means only the service-role
-- key (server-only) can access the tables, which is correct: every table
-- operation goes through authenticated API routes, never directly from the client.

-- Drop permissive anon policies
drop policy if exists "service_role_all_sessions"     on sessions;
drop policy if exists "service_role_all_participants" on participants;
drop policy if exists "service_role_all_qr_tokens"   on qr_tokens;
drop policy if exists "service_role_all_draws"        on draws;
drop policy if exists "service_role_all_rate_limits"  on api_rate_limits;

-- No anon policies = anon key is fully blocked from all tables.
-- The service-role key bypasses RLS by default in Supabase, so all
-- server-side operations (which always use supabaseAdmin) continue to work.
--
-- If you ever need a PostgREST endpoint with anon access, add a policy here
-- with the minimum required scope — never "using (true)" for writes.
