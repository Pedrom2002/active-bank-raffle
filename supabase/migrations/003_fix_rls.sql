-- Drop the permissive "using (true)" policies created in 001_raffles.sql.
-- Those policies grant the anon key (NEXT_PUBLIC_, visible in every browser)
-- full read/write access, bypassing the Next.js auth layer entirely.
-- Removing them means only the service-role key (server-side only) can access
-- the tables. The service-role key bypasses RLS by default in Supabase.

drop policy if exists "service_role_all_lounge_entrants"     on lounge_entrants;
drop policy if exists "service_role_all_raffles"             on raffles;
drop policy if exists "service_role_all_raffle_participants" on raffle_participants;
drop policy if exists "service_role_all_rate_limits"         on api_rate_limits;
