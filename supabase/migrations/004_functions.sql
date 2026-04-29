-- GDPR — Right to erasure for raffle participants.
-- Nulls the winner_id FK on the raffle before deleting the participant,
-- preserving the raffle record while removing all PII.
-- Called by DELETE /api/raffles/[id]/participants?participant_id=<uuid> (admin only).
create or replace function delete_raffle_participant_data(p_participant_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update raffles
  set winner_id = null
  where winner_id = p_participant_id;

  delete from raffle_participants
  where id = p_participant_id;
end;
$$;

-- GDPR — Data retention cleanup.
-- Deletes closed raffles (and their participants via cascade) older than N days.
-- Call manually or schedule via pg_cron: SELECT cleanup_old_raffles(90);
create or replace function cleanup_old_raffles(p_retention_days int default 90)
returns int
language plpgsql
security definer
as $$
declare
  v_count int;
begin
  delete from raffles
  where status = 'closed'
    and coalesce(ends_at, created_at) < now() - (p_retention_days || ' days')::interval;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- GDPR — Lounge entrant erasure.
create or replace function delete_lounge_entrant_data(p_entrant_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  delete from lounge_entrants where id = p_entrant_id;
end;
$$;
