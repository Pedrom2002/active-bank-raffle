-- Active Bank Raffle System — Full Schema
-- This file documents the complete schema. Apply migrations in order from supabase/migrations/.

create extension if not exists "pgcrypto";

-- Lounge entrants (permanent, not tied to a raffle)
create table if not exists lounge_entrants (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null,
  email        text not null,
  entered_at   timestamptz not null default now(),
  unique(phone)
);

-- Raffles — each activated moment is one raffle
create table if not exists raffles (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  status       text not null default 'active' check (status in ('active', 'closed')),
  duration_sec int  not null default 120,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  winner_id    uuid,
  excluded_winner_ids uuid[] not null default '{}', -- winners marked absent, excluded from redraw (scoped to this raffle)
  created_at   timestamptz not null default now()
);

-- Participants per raffle
create table if not exists raffle_participants (
  id            uuid primary key default gen_random_uuid(),
  raffle_id     uuid not null references raffles(id) on delete cascade,
  name          text not null,
  phone         text not null,
  email         text not null,
  registered_at timestamptz not null default now(),
  unique(raffle_id, phone)
);

alter table raffles add constraint fk_raffle_winner
  foreign key (winner_id) references raffle_participants(id) on delete set null;

create index if not exists idx_raffle_participants_raffle on raffle_participants(raffle_id);
create index if not exists idx_raffles_status on raffles(status);

-- Rate limiting
create table if not exists api_rate_limits (
  id           uuid primary key default gen_random_uuid(),
  key          text not null,
  window_start timestamptz not null,
  count        int not null default 1,
  unique (key, window_start)
);

create index if not exists idx_rate_limits_key_window on api_rate_limits (key, window_start);

-- Audit log
create table if not exists audit_log (
  id         uuid primary key default gen_random_uuid(),
  event      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_event      on audit_log (event);
create index if not exists idx_audit_log_created_at on audit_log (created_at desc);

-- RLS: all tables accessible only via service role key (server-side)
alter table lounge_entrants    enable row level security;
alter table raffles             enable row level security;
alter table raffle_participants enable row level security;
alter table api_rate_limits     enable row level security;
alter table audit_log           enable row level security;

-- Functions
create or replace function increment_rate_limit(p_key text, p_window_start timestamptz)
returns int language plpgsql security definer as $$
declare v_count int;
begin
  insert into api_rate_limits (key, window_start, count) values (p_key, p_window_start, 1)
  on conflict (key, window_start) do update set count = api_rate_limits.count + 1
  returning count into v_count;
  return v_count;
end;
$$;

create or replace function cleanup_rate_limits()
returns void language sql security definer as $$
  delete from api_rate_limits where window_start < now() - interval '1 hour';
$$;

create or replace function delete_raffle_participant_data(p_participant_id uuid)
returns void language plpgsql security definer as $$
begin
  update raffles set winner_id = null where winner_id = p_participant_id;
  delete from raffle_participants where id = p_participant_id;
end;
$$;

create or replace function cleanup_old_raffles(p_retention_days int default 90)
returns int language plpgsql security definer as $$
declare v_count int;
begin
  delete from raffles
  where status = 'closed'
    and coalesce(ends_at, created_at) < now() - (p_retention_days || ' days')::interval;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function delete_lounge_entrant_data(p_entrant_id uuid)
returns void language plpgsql security definer as $$
begin
  delete from lounge_entrants where id = p_entrant_id;
end;
$$;

-- Redraw — atomically exclude the current (absent) winner and draw a new one
-- from the remaining participants of this raffle. Row lock serializes concurrent
-- redraws so no exclusion is ever lost. Raises: raffle_not_found,
-- no_current_winner, no_eligible_participants (rolls back on any of these).
create or replace function redraw_raffle_winner(p_raffle_id uuid)
returns table (winner_id uuid, winner_name text, winner_phone text, excluded_id uuid)
language plpgsql security definer as $$
declare
  v_current  uuid;
  v_excluded uuid[];
  v_new      raffle_participants%rowtype;
begin
  select r.winner_id, r.excluded_winner_ids into v_current, v_excluded
    from raffles r where r.id = p_raffle_id for update;
  if not found then raise exception 'raffle_not_found'; end if;
  if v_current is null then raise exception 'no_current_winner'; end if;

  v_excluded := (select array(select distinct unnest(array_append(v_excluded, v_current))));

  select p.* into v_new from raffle_participants p
   where p.raffle_id = p_raffle_id and not (p.id = any (v_excluded))
   order by random() limit 1;
  if not found then raise exception 'no_eligible_participants'; end if;

  update raffles set winner_id = v_new.id, excluded_winner_ids = v_excluded
   where id = p_raffle_id;

  winner_id := v_new.id; winner_name := v_new.name;
  winner_phone := v_new.phone; excluded_id := v_current;
  return next;
end;
$$;

create or replace function cleanup_old_audit_log(p_retention_days int default 365)
returns int language plpgsql security definer as $$
declare v_count int;
begin
  delete from audit_log
  where created_at < now() - (p_retention_days || ' days')::interval;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
