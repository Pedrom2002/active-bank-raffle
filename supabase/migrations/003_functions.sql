-- ─────────────────────────────────────────────────────────────────────────────
-- P14: Atomic session creation
-- Closes the current active session and opens a new one in a single
-- transaction, eliminating the race condition in the original two-step code.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function create_session(p_name text)
returns sessions
language plpgsql
security definer
as $$
declare
  v_session sessions;
begin
  -- Atomically close any active session
  update sessions
  set status = 'closed', closed_at = now()
  where status = 'active';

  -- Create the new session
  insert into sessions (name)
  values (p_name)
  returning * into v_session;

  return v_session;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- P15: GDPR — Right to erasure
-- Deletes a participant and nulls any draw/session winner references to them.
-- Called by DELETE /api/participants?id=<uuid> (admin-authenticated).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function delete_participant_data(p_participant_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Null out draw winner references (keeps the draw record, redacts the winner)
  update draws
  set winner_id = null
  where winner_id = p_participant_id;

  -- Null out session winner reference
  update sessions
  set winner_id = null
  where winner_id = p_participant_id;

  -- Delete the participant record (phone, name)
  delete from participants
  where id = p_participant_id;
end;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- P15: GDPR — Data retention cleanup
-- Deletes sessions and all their participants older than N days.
-- Call manually or via pg_cron: SELECT cleanup_old_sessions(90);
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function cleanup_old_sessions(p_retention_days int default 90)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  delete from sessions
  where status = 'closed'
    and coalesce(closed_at, created_at) < now() - (p_retention_days || ' days')::interval;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
