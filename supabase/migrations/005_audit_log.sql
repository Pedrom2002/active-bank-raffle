-- Persistent audit log table.
-- Populated server-side only via service role key (never accessible by anon key).
-- Retains all security-relevant events for incident response and GDPR compliance.
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_event      on audit_log (event);
create index if not exists idx_audit_log_created_at on audit_log (created_at desc);

alter table audit_log enable row level security;
-- No public policies — only service role (server-side) can read/write.

-- Cleanup: remove audit entries older than 1 year (GDPR minimum retention satisfied).
create or replace function cleanup_old_audit_log(p_retention_days int default 365)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  delete from audit_log
  where created_at < now() - (p_retention_days || ' days')::interval;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
