-- supabase/migrations/001_raffles.sql
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

create index idx_raffle_participants_raffle on raffle_participants(raffle_id);
create index idx_raffles_status on raffles(status);

alter table lounge_entrants      enable row level security;
alter table raffles               enable row level security;
alter table raffle_participants   enable row level security;

create policy "service_role_all_lounge_entrants"    on lounge_entrants    for all using (true);
create policy "service_role_all_raffles"            on raffles            for all using (true);
create policy "service_role_all_raffle_participants" on raffle_participants for all using (true);
