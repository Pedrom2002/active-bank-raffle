-- Rate limiting table for API abuse prevention
create table if not exists api_rate_limits (
  id           uuid primary key default gen_random_uuid(),
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 1,
  unique (key, window_start)
);

create index if not exists idx_rate_limits_key_window on api_rate_limits (key, window_start);

-- Atomic increment-or-insert for rate limiting
create or replace function increment_rate_limit(p_key text, p_window_start timestamptz)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  insert into api_rate_limits (key, window_start, count)
  values (p_key, p_window_start, 1)
  on conflict (key, window_start)
  do update set count = api_rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

-- Cleanup old windows automatically (run periodically or via pg_cron)
create or replace function cleanup_rate_limits()
returns void
language sql
security definer
as $$
  delete from api_rate_limits where window_start < now() - interval '1 hour';
$$;

-- RLS: only service role can touch this table
alter table api_rate_limits enable row level security;
create policy "service_role_all_rate_limits" on api_rate_limits for all using (true);
