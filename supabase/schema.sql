-- Active Bank Raffle System — Database Schema
-- Run this in Supabase SQL Editor

create extension if not exists "pgcrypto";

-- Game sessions
create table sessions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  status      text not null default 'active' check (status in ('active', 'closed')),
  created_at  timestamptz not null default now(),
  closed_at   timestamptz,
  winner_id   uuid
);

-- Participants — one entry per (session, phone)
create table participants (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  name          text not null,
  phone         text not null,
  registered_at timestamptz not null default now(),
  unique(session_id, phone)
);

-- Add winner FK after participants table exists
alter table sessions
  add constraint fk_winner
  foreign key (winner_id) references participants(id) on delete set null;

-- QR tokens — one active token per session window
create table qr_tokens (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  token_hash  text not null,
  valid_from  timestamptz not null,
  valid_until timestamptz not null
);

create index idx_qr_tokens_session on qr_tokens(session_id);
create index idx_participants_session on participants(session_id);

-- Row Level Security
alter table sessions     enable row level security;
alter table participants  enable row level security;
alter table qr_tokens    enable row level security;

-- Allow all ops via service_role key (used server-side only)
create policy "service_role_all_sessions"     on sessions     for all using (true);
create policy "service_role_all_participants" on participants  for all using (true);
create policy "service_role_all_qr_tokens"   on qr_tokens    for all using (true);
